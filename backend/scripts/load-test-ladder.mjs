/**
 * Auth once, then run concurrent journeys at each level.
 * Usage: node scripts/load-test-ladder.mjs
 */
import http from 'node:http';
import https from 'node:https';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

// Raise default agent limits so the load generator is not the bottleneck.
http.globalAgent.maxSockets = 2048;
https.globalAgent.maxSockets = 2048;

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:3000/api/v1').replace(/\/$/, '');
const OTP = process.env.OTP_DEV_CODE ?? '1234';
const PHONE_PREFIX = process.env.LOAD_PHONE_PREFIX ?? '96';
const AUTH_POOL = Math.max(1, Number(process.env.AUTH_POOL ?? 12));
const LEVELS = (process.env.LOAD_LEVELS ?? '50,100,250,500,750')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);
const TOKEN_FILE = new URL('./.load-test-tokens.json', import.meta.url);

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body?.success !== false, status: res.status, body };
}

async function buildAuthPool() {
  if (process.env.REUSE_TOKENS === '1' && existsSync(TOKEN_FILE)) {
    const saved = JSON.parse(readFileSync(TOKEN_FILE, 'utf8'));
    if (Array.isArray(saved.tokens) && saved.tokens.length > 0) {
      console.log(`Reusing ${saved.tokens.length} saved tokens`);
      return saved.tokens;
    }
  }

  const tokens = [];
  console.log(`Building auth pool of ${AUTH_POOL}…`);
  for (let i = 0; i < AUTH_POOL; i += 1) {
    const phone = `${PHONE_PREFIX}${String(20000000 + i).slice(0, 8)}`;
    const req = await jsonFetch('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ phoneCountryCode: '+91', phone }),
    });
    if (!req.ok) {
      console.log(`otp_request ${i} failed: ${req.body?.error?.code ?? req.status}`);
      continue;
    }
    const verify = await jsonFetch('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phoneCountryCode: '+91', phone, otp: OTP }),
    });
    const token = verify.body?.data?.accessToken;
    if (token) tokens.push(token);
    else console.log(`otp_verify ${i} failed`);
  }
  writeFileSync(TOKEN_FILE, JSON.stringify({ tokens, at: new Date().toISOString() }, null, 2));
  console.log(`Authenticated: ${tokens.length}/${AUTH_POOL}`);
  return tokens;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function journey(accessToken) {
  const auth = { Authorization: `Bearer ${accessToken}` };
  const paths = [
    ['categories', '/categories?lang=en', null],
    ['products', '/products?page=1&limit=20&lang=en', null],
    ['stores', '/stores?popular=true', null],
    ['i18n', '/i18n/bundle?lang=en', null],
    ['health', '/health', null],
    ['me', '/auth/me', auth],
    ['cart', '/cart', auth],
    ['addresses', '/addresses', auth],
    ['quote', '/orders/quote', auth],
    ['orders', '/orders?page=1&limit=20', auth],
    ['notifications', '/notifications?page=1&limit=20', auth],
  ];
  const samples = [];
  for (const [name, path, headers] of paths) {
    const started = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
          Accept: 'application/json',
          ...(headers ?? {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      const ok = res.ok && body?.success !== false;
      samples.push({
        name,
        ok,
        ms: performance.now() - started,
        error: ok ? null : (body?.error?.code ?? `HTTP_${res.status}`),
      });
    } catch (err) {
      samples.push({
        name,
        ok: false,
        ms: performance.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return samples;
}

async function runLevel(concurrency, tokens) {
  const started = performance.now();
  const workers = Array.from({ length: concurrency }, (_, i) =>
    journey(tokens[i % tokens.length]),
  );
  const flat = (await Promise.all(workers)).flat();
  const elapsedSec = (performance.now() - started) / 1000;
  const latencies = flat.map((s) => s.ms).sort((a, b) => a - b);
  const okCount = flat.filter((s) => s.ok).length;
  const successRate = okCount / flat.length;
  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);
  const errors = new Map();
  for (const s of flat) {
    if (!s.ok) errors.set(s.error ?? 'unknown', (errors.get(s.error ?? 'unknown') ?? 0) + 1);
  }

  const pass = successRate >= 0.99 && p95 <= 2000;
  console.log(
    `\n[${concurrency} VU] success=${(successRate * 100).toFixed(1)}% ` +
      `p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms p99=${p99.toFixed(0)}ms ` +
      `rps=${(flat.length / elapsedSec).toFixed(0)} ` +
      `${pass ? 'PASS' : 'FAIL'}`,
  );
  if (errors.size) {
    console.log(
      '  errors:',
      [...errors.entries()].map(([k, v]) => `${k}:${v}`).join(', '),
    );
  }
  return { concurrency, successRate, p50, p95, p99, pass, total: flat.length };
}

async function main() {
  console.log(`Ladder → ${BASE_URL}`);
  console.log(`Levels: ${LEVELS.join(', ')}`);
  const tokens = await buildAuthPool();
  if (tokens.length === 0) {
    console.error('No tokens — aborting');
    process.exit(1);
  }

  const results = [];
  for (const level of LEVELS) {
    results.push(await runLevel(level, tokens));
  }

  console.log('\n=== Ladder summary ===');
  for (const r of results) {
    console.log(
      `${String(r.concurrency).padStart(4)} VU  ` +
        `${(r.successRate * 100).toFixed(1)}%  ` +
        `p95=${r.p95.toFixed(0)}ms  ${r.pass ? 'PASS' : 'FAIL'}`,
    );
  }
  if (results.some((r) => !r.pass)) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
