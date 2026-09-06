/**
 * Realistic mixed workload load test for DayFax API.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000/api/v1 node scripts/load-test.mjs [concurrency]
 *
 * Authenticates a small user pool (OTP is rate-limited per IP), then runs
 * concurrent journeys that reuse those tokens — matches real multi-request
 * pressure without burning OTP quota.
 */
import { performance } from 'node:perf_hooks';

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Number(process.argv[2] ?? process.env.CONCURRENCY ?? 50));
const OTP = process.env.OTP_DEV_CODE ?? '1234';
const PHONE_PREFIX = process.env.LOAD_PHONE_PREFIX ?? '97';
/** Cap unique OTP logins so we stay under auth rate limits (20/15min default). */
const AUTH_POOL = Math.min(
  CONCURRENCY,
  Math.max(1, Number(process.env.AUTH_POOL ?? 15)),
);

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function jsonFetch(path, options = {}) {
  const started = performance.now();
  let status = 0;
  let ok = false;
  let error = null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers ?? {}),
      },
    });
    status = res.status;
    const body = await res.json().catch(() => ({}));
    ok = res.ok && body?.success !== false;
    if (!ok) error = body?.error?.code ?? `HTTP_${status}`;
    return { ok, status, body, ms: performance.now() - started, error };
  } catch (err) {
    return {
      ok: false,
      status,
      body: null,
      ms: performance.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function authenticateUser(workerId) {
  const phone = `${PHONE_PREFIX}${String(10000000 + workerId).slice(0, 8)}`;
  const otpReq = await jsonFetch('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phoneCountryCode: '+91', phone }),
  });
  if (!otpReq.ok) {
    return { token: null, samples: [{ name: 'otp_request', ...otpReq }] };
  }
  const otpVerify = await jsonFetch('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phoneCountryCode: '+91', phone, otp: OTP }),
  });
  return {
    token: otpVerify.body?.data?.accessToken ?? null,
    samples: [
      { name: 'otp_request', ...otpReq },
      { name: 'otp_verify', ...otpVerify },
    ],
  };
}

async function userJourney(workerId, accessToken) {
  const samples = [];
  const record = (name, result) => {
    samples.push({ name, ...result });
  };

  const auth = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  record('categories', await jsonFetch('/categories?lang=en'));
  record('products', await jsonFetch('/products?page=1&limit=20&lang=en'));
  record('stores', await jsonFetch('/stores?popular=true'));
  record('i18n', await jsonFetch('/i18n/bundle?lang=en'));
  record('health', await jsonFetch('/health'));

  if (accessToken) {
    record('me', await jsonFetch('/auth/me', { headers: auth }));
    record('cart', await jsonFetch('/cart', { headers: auth }));
    record('addresses', await jsonFetch('/addresses', { headers: auth }));
    record('quote', await jsonFetch('/orders/quote', { headers: auth }));
    record('orders', await jsonFetch('/orders?page=1&limit=20', { headers: auth }));
    record(
      'notifications',
      await jsonFetch('/notifications?page=1&limit=20', { headers: auth }),
    );
  }

  return samples;
}

async function run() {
  console.log(`DayFax load test → ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY} | Auth pool: ${AUTH_POOL}`);

  const started = performance.now();
  const allSamples = [];

  console.log('\n--- Auth pool ---');
  const tokens = [];
  for (let i = 0; i < AUTH_POOL; i += 1) {
    const { token, samples } = await authenticateUser(i);
    allSamples.push(...samples);
    if (token) tokens.push(token);
    else console.log(`auth ${i}: failed (${samples.at(-1)?.error ?? 'unknown'})`);
  }
  console.log(`Authenticated sessions: ${tokens.length}/${AUTH_POOL}`);
  if (tokens.length === 0) {
    console.error('No auth tokens — aborting (check OTP rate limit / server).');
    process.exitCode = 1;
    return;
  }

  console.log('\n--- Concurrent journeys ---');
  const workers = Array.from({ length: CONCURRENCY }, (_, i) =>
    userJourney(i, tokens[i % tokens.length]),
  );
  const results = await Promise.all(workers);
  allSamples.push(...results.flat());

  const elapsedSec = (performance.now() - started) / 1000;
  const flat = allSamples;
  const latencies = flat.map((s) => s.ms).sort((a, b) => a - b);
  const okCount = flat.filter((s) => s.ok).length;
  const failCount = flat.length - okCount;
  const byName = new Map();
  const errors = new Map();

  for (const sample of flat) {
    const bucket = byName.get(sample.name) ?? { count: 0, ok: 0, ms: [] };
    bucket.count += 1;
    if (sample.ok) bucket.ok += 1;
    bucket.ms.push(sample.ms);
    byName.set(sample.name, bucket);
    if (!sample.ok) {
      errors.set(sample.error ?? 'unknown', (errors.get(sample.error ?? 'unknown') ?? 0) + 1);
    }
  }

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const successRate = okCount / flat.length;

  console.log('\n=== Summary ===');
  console.log(`Total requests: ${flat.length}`);
  console.log(`Success: ${okCount} (${(successRate * 100).toFixed(1)}%)`);
  console.log(`Errors: ${failCount}`);
  console.log(`Wall time: ${elapsedSec.toFixed(2)}s`);
  console.log(`Approx RPS: ${(flat.length / elapsedSec).toFixed(1)}`);
  console.log(
    `Latency ms — P50: ${p50.toFixed(1)} | P95: ${p95.toFixed(1)} | P99: ${p99.toFixed(1)}`,
  );

  console.log('\n=== By endpoint ===');
  for (const [name, bucket] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ms = bucket.ms.sort((a, b) => a - b);
    console.log(
      `${name.padEnd(16)} n=${String(bucket.count).padStart(4)} ok=${bucket.ok} p95=${percentile(ms, 95).toFixed(0)}ms`,
    );
  }

  if (errors.size) {
    console.log('\n=== Errors ===');
    for (const [code, count] of errors) {
      console.log(`${code}: ${count}`);
    }
  }

  // Auth pool OTP failures are expected when rate-limited; gate on journey APIs.
  const journey = flat.filter((s) => !s.name.startsWith('otp_'));
  const journeyOk = journey.filter((s) => s.ok).length / Math.max(1, journey.length);
  const journeyLat = journey.map((s) => s.ms).sort((a, b) => a - b);
  const journeyP95 = percentile(journeyLat, 95);

  console.log(
    `\nJourney-only success: ${(journeyOk * 100).toFixed(1)}% | P95: ${journeyP95.toFixed(1)}ms`,
  );

  if (journeyOk < 0.99 || journeyP95 > 2000) {
    console.log('\nVerdict: NEEDS ATTENTION (journey success < 99% or p95 > 2s)');
    process.exitCode = 1;
  } else {
    console.log('\nVerdict: PASS for this concurrency level');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
