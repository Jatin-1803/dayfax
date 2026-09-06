import mysql from 'mysql2/promise';
import { env } from '../../config/env.js';
import { logger } from '../logger/logger.js';

let pool: mysql.Pool | null = null;

const DEADLOCK_CODES = new Set([1213, 1205]); // ER_LOCK_DEADLOCK, ER_LOCK_WAIT_TIMEOUT

function isTransientLockError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errno = (error as { errno?: number }).errno;
  const code = (error as { code?: string }).code;
  return (
    (typeof errno === 'number' && DEADLOCK_CODES.has(errno)) ||
    code === 'ER_LOCK_DEADLOCK' ||
    code === 'ER_LOCK_WAIT_TIMEOUT'
  );
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      waitForConnections: true,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      queueLimit: env.DB_QUEUE_LIMIT,
      connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      namedPlaceholders: true,
      timezone: 'Z',
      dateStrings: false,
    });
    logger.info('MySQL pool created', {
      host: env.DB_HOST,
      database: env.DB_NAME,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      queueLimit: env.DB_QUEUE_LIMIT,
    });
  }
  return pool;
}

/**
 * Runs work in a short DB transaction on a single pooled connection.
 * Retries only the transaction on MySQL deadlock / lock-wait timeout.
 */
export async function withTransaction<T>(
  work: (conn: mysql.PoolConnection) => Promise<T>,
  options: { maxRetries?: number } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        logger.warn('Transaction rollback failed', {
          error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        });
      }

      if (attempt <= maxRetries && isTransientLockError(error)) {
        const delayMs = 25 * attempt * attempt;
        logger.warn('Retrying transaction after lock contention', {
          attempt,
          delayMs,
          errno: (error as { errno?: number }).errno,
          code: (error as { code?: string }).code,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
