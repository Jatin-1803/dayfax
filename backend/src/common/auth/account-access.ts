import type { RowDataPacket } from 'mysql2/promise';
import { accountDenyCode } from '../account/account-status.js';
import { getPool } from '../database/pool.js';
import { ForbiddenError, ServiceUnavailableError, UnauthorizedError } from '../errors/app-error.js';
import { logger } from '../logger/logger.js';
import { getSessionPolicy } from '../config/session-policy.js';
import {
  findAdminSession,
  findUserSession,
  sessionExpired,
  touchSession,
} from './session-store.js';

const SKEW_MS = 5_000;

function failAccountCheck(error: unknown): never {
  logger.error('Account status check failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  throw new ServiceUnavailableError('Account status could not be verified');
}

function issuedBefore(validAfter: Date | null, iatSeconds?: number): boolean {
  if (!validAfter || !iatSeconds) return false;
  return new Date(validAfter).getTime() > iatSeconds * 1000 + SKEW_MS;
}

async function releaseExpiredStatus(userId: string, status: string, expiresAt: Date | null): Promise<string> {
  if ((status === 'SUSPENDED' || status === 'SECURITY_LOCKED') && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    await getPool().execute(
      `UPDATE users
       SET status = 'ACTIVE', status_expires_at = NULL
       WHERE id = ? AND status = ?`,
      [userId, status],
    );
    return 'ACTIVE';
  }
  return status;
}

export async function assertUserAccess(input: {
  userId: string;
  sessionId?: string;
  issuedAt?: number;
}): Promise<void> {
  let rows: RowDataPacket[];
  try {
    const [found] = await getPool().query<RowDataPacket[]>(
      `SELECT status, deleted_at, sessions_valid_after, status_expires_at
       FROM users WHERE id = ? LIMIT 1`,
      [input.userId],
    );
    rows = found;
  } catch (error) {
    failAccountCheck(error);
  }

  const user = rows[0];
  if (!user || user.deleted_at) {
    throw new UnauthorizedError('Account is not available', 'ACCOUNT_INACTIVE');
  }

  const status = await releaseExpiredStatus(
    input.userId,
    user.status as string,
    user.status_expires_at as Date | null,
  );
  const deny = accountDenyCode(status);
  if (deny) {
    throw new ForbiddenError('Your account cannot use the app right now.', deny);
  }

  if (issuedBefore(user.sessions_valid_after as Date | null, input.issuedAt)) {
    throw new UnauthorizedError('Session ended. Please sign in again.', 'SESSION_REVOKED');
  }

  if (!input.sessionId) return;

  const policy = await getSessionPolicy();
  const session = await findUserSession(input.sessionId);
  if (!session || session.user_id !== input.userId) {
    throw new UnauthorizedError('Session ended. Please sign in again.', 'SESSION_REVOKED');
  }
  const expired = sessionExpired(session, policy.userIdleTimeoutMinutes);
  if (expired === 'idle') {
    throw new UnauthorizedError('Session timed out. Please sign in again.', 'SESSION_IDLE');
  }
  if (expired === 'expired' || expired === 'revoked') {
    throw new UnauthorizedError('Session ended. Please sign in again.', expired === 'revoked' ? 'SESSION_REVOKED' : 'SESSION_EXPIRED');
  }
  await touchSession('user_sessions', session.id);
}

export async function assertAdminAccess(input: {
  adminId: string;
  sessionId?: string;
  issuedAt?: number;
}): Promise<void> {
  let rows: RowDataPacket[];
  try {
    const [found] = await getPool().query<RowDataPacket[]>(
      `SELECT status, deleted_at, sessions_valid_after
       FROM admin_users WHERE id = ? LIMIT 1`,
      [input.adminId],
    );
    rows = found;
  } catch (error) {
    failAccountCheck(error);
  }

  const admin = rows[0];
  if (!admin || admin.deleted_at || admin.status !== 'ACTIVE') {
    throw new UnauthorizedError('Admin session ended', 'SESSION_REVOKED');
  }
  if (issuedBefore(admin.sessions_valid_after as Date | null, input.issuedAt)) {
    throw new UnauthorizedError('Session ended. Please sign in again.', 'SESSION_REVOKED');
  }
  if (!input.sessionId) return;

  const policy = await getSessionPolicy();
  const session = await findAdminSession(input.sessionId);
  if (!session || session.admin_user_id !== input.adminId) {
    throw new UnauthorizedError('Session ended. Please sign in again.', 'SESSION_REVOKED');
  }
  const expired = sessionExpired(session, policy.adminIdleTimeoutMinutes);
  if (expired) {
    const code = expired === 'idle' ? 'SESSION_IDLE' : expired === 'revoked' ? 'SESSION_REVOKED' : 'SESSION_EXPIRED';
    throw new UnauthorizedError('Session ended. Please sign in again.', code);
  }
  await touchSession('admin_sessions', session.id);
}
