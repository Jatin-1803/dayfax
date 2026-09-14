import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../database/pool.js';
import { createId } from '../utils/id.js';
import type { ClientContext } from '../http/client-context.js';

type Db = Pool | PoolConnection;

export interface SessionRow {
  id: string;
  user_id: string;
  revoked_at: Date | null;
  last_active_at: Date;
  created_at: Date;
  expires_at: Date;
}

const lastTouch = new Map<string, number>();
const TOUCH_MS = 60_000;

export async function createUserSession(
  input: {
    userId: string;
    client: ClientContext;
    absoluteMinutes: number;
  },
  db: Db = getPool(),
): Promise<string> {
  const id = createId();
  await db.execute(
    `INSERT INTO user_sessions (
       id, user_id, device_id, platform, device_name, device_model, os_version,
       app_version, app_build, ip_address, user_agent, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [
      id,
      input.userId,
      input.client.deviceId,
      input.client.platform,
      input.client.deviceName,
      input.client.deviceModel,
      input.client.osVersion,
      input.client.appVersion,
      input.client.appBuild,
      input.client.ipAddress,
      input.client.userAgent,
      input.absoluteMinutes,
    ],
  );
  return id;
}

export async function createAdminSession(
  input: {
    adminUserId: string;
    client: ClientContext;
    absoluteMinutes: number;
  },
  db: Db = getPool(),
): Promise<string> {
  const id = createId();
  await db.execute(
    `INSERT INTO admin_sessions (
       id, admin_user_id, device_id, platform, device_name, user_agent, ip_address, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [
      id,
      input.adminUserId,
      input.client.deviceId,
      input.client.platform,
      input.client.deviceName,
      input.client.userAgent,
      input.client.ipAddress,
      input.absoluteMinutes,
    ],
  );
  return id;
}

export async function findUserSession(id: string): Promise<SessionRow | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, user_id, revoked_at, last_active_at, created_at, expires_at
     FROM user_sessions WHERE id = ? LIMIT 1`,
    [id],
  );
  return (rows[0] as SessionRow) ?? null;
}

export async function findAdminSession(id: string): Promise<{
  id: string;
  admin_user_id: string;
  revoked_at: Date | null;
  last_active_at: Date;
  created_at: Date;
  expires_at: Date;
} | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, admin_user_id, revoked_at, last_active_at, created_at, expires_at
     FROM admin_sessions WHERE id = ? LIMIT 1`,
    [id],
  );
  return (rows[0] as SessionRow & { admin_user_id: string }) ?? null;
}

export async function touchSession(table: 'user_sessions' | 'admin_sessions', id: string): Promise<void> {
  const now = Date.now();
  const previous = lastTouch.get(id) ?? 0;
  if (now - previous < TOUCH_MS) return;
  lastTouch.set(id, now);
  await getPool().execute(
    `UPDATE ${table} SET last_active_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL`,
    [id],
  );
}

export async function revokeUserSessions(input: {
  userId: string;
  sessionId?: string;
  exceptSessionId?: string;
  reason: string;
}): Promise<void> {
  const params: string[] = [input.reason, input.userId];
  let extra = '';
  if (input.sessionId) {
    extra += ' AND id = ?';
    params.push(input.sessionId);
  }
  if (input.exceptSessionId) {
    extra += ' AND id <> ?';
    params.push(input.exceptSessionId);
  }
  await getPool().execute(
    `UPDATE user_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = ?
     WHERE user_id = ? AND revoked_at IS NULL ${extra}`,
    params,
  );
  await getPool().execute(
    `UPDATE refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE user_id = ?
       AND revoked_at IS NULL
       ${input.sessionId ? 'AND session_id = ?' : ''}
       ${input.exceptSessionId ? 'AND (session_id IS NULL OR session_id <> ?)' : ''}`,
    [
      input.userId,
      ...(input.sessionId ? [input.sessionId] : []),
      ...(input.exceptSessionId ? [input.exceptSessionId] : []),
    ],
  );
}

export async function revokeAdminSessions(adminUserId: string, reason: string): Promise<void> {
  await getPool().execute(
    `UPDATE admin_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = ?
     WHERE admin_user_id = ? AND revoked_at IS NULL`,
    [reason, adminUserId],
  );
  await getPool().execute(
    `UPDATE admin_refresh_tokens
     SET revoked_at = CURRENT_TIMESTAMP
     WHERE admin_user_id = ? AND revoked_at IS NULL`,
    [adminUserId],
  );
}

export function sessionExpired(session: {
  revoked_at: Date | null;
  last_active_at: Date;
  created_at: Date;
  expires_at: Date;
}, idleMinutes: number): 'revoked' | 'idle' | 'expired' | null {
  if (session.revoked_at) return 'revoked';
  const now = Date.now();
  if (new Date(session.expires_at).getTime() <= now) return 'expired';
  const idleMs = idleMinutes * 60_000;
  if (now - new Date(session.last_active_at).getTime() > idleMs) return 'idle';
  return null;
}
