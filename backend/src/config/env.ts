import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('dailyfax'),
  /**
   * Per Node process. Size for expected concurrent DB-bound work, not HTTP
   * concurrency. Keep instances × limit well under MySQL max_connections.
   * Default 32: ~500 active users with short queries on a single API process.
   */
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().max(200).default(32),
  /** 0 = unlimited queue (mysql2 default). Cap to fail fast under overload. */
  DB_QUEUE_LIMIT: z.coerce.number().int().nonnegative().default(1000),
  DB_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  /**
   * Per-IP sliding window. Protects against single-client abuse; not total
   * system capacity. Raise carefully in production behind shared NATs.
   */
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  /**
   * Cancel abandoned online checkouts and restore inventory after this many minutes.
   * Razorpay checkout windows are typically ~15 minutes.
   */
  UNPAID_ORDER_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(15),
  /** How often the in-process reclaim loop runs. */
  UNPAID_ORDER_RECLAIM_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  /** Disable with UNPAID_ORDER_RECLAIM_ENABLED=false (e.g. tests / multi-writer experiments). */
  UNPAID_ORDER_RECLAIM_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  OTP_LENGTH: z.coerce.number().default(4),
  OTP_EXPIRES_SECONDS: z.coerce.number().default(300),
  OTP_DEV_CODE: z.string().default('1234'),
  OTP_PROVIDER: z.enum(['dev', 'sms']).default('dev'),
  /** Per-IP OTP request budget (tight in production to limit SMS abuse). */
  OTP_REQUEST_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  OTP_VERIFY_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  OTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('*'),
  PUBLIC_BASE_URL: z.string().default('http://127.0.0.1:3000'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  /** HMAC secret from the Razorpay dashboard webhook. Never send this to clients. */
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  MEILI_HOST: z.string().optional().default(''),
  MEILI_MASTER_KEY: z.string().optional().default(''),
  MEILI_INDEX_PRODUCTS: z.string().default('products'),
  /** Seed email/password into admin_users for the web admin console. */
  SEED_ADMIN_EMAIL: z.string().trim().default('admin@dayfax.in'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('Admin@12345'),
  SEED_ADMIN_NAME: z.string().trim().default('DayFax Admin'),
  /** Legacy: optional phone ADMIN role on app users table (not used by admin SPA). */
  SEED_ADMIN_PHONE: z.string().default(''),
  SEED_ADMIN_PHONE_COUNTRY_CODE: z.string().trim().min(1).max(8).default('+91'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type AppEnv = typeof env;
