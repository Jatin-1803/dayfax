import { createHash } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { REFRESH_REUSE_GRACE_SECONDS, sqlFlag } from '../../common/auth/token-session.js';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export interface AdminUserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class AdminAuthRepository {
  constructor(private readonly db: Pool = getPool()) {}

  hashToken(value: string): string {
    return hashValue(value);
  }

  async findByEmail(email: string): Promise<AdminUserRecord | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, email, password_hash, full_name, status
       FROM admin_users
       WHERE email = ? AND deleted_at IS NULL
       LIMIT 1`,
      [email.toLowerCase()],
    );
    return (rows[0] as AdminUserRecord) ?? null;
  }

  async findById(id: string): Promise<AdminUserRecord | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, email, password_hash, full_name, status
       FROM admin_users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return (rows[0] as AdminUserRecord) ?? null;
  }

  async touchLogin(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
  }

  async storeRefreshToken(
    adminUserId: string,
    token: string,
    expiresInSeconds: number,
    conn?: Pool | PoolConnection,
    sessionId?: string,
  ): Promise<void> {
    const db = conn ?? this.db;
    await db.execute(
      `INSERT INTO admin_refresh_tokens (id, admin_user_id, session_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [createId(), adminUserId, sessionId ?? null, hashValue(token), expiresInSeconds],
    );
  }

  async findRefreshTokenForUpdate(
    token: string,
    conn: Pool | PoolConnection,
  ): Promise<{ id: string; admin_user_id: string; sessionId: string | null; active: boolean; withinGrace: boolean } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, admin_user_id, session_id,
              (revoked_at IS NULL AND expires_at > NOW()) AS active,
              (revoked_at IS NOT NULL
                AND revoked_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
                AND expires_at > NOW()) AS within_grace
       FROM admin_refresh_tokens
       WHERE token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [REFRESH_REUSE_GRACE_SECONDS, hashValue(token)],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id as string,
      admin_user_id: row.admin_user_id as string,
      sessionId: (row.session_id as string | null) ?? null,
      active: sqlFlag(row.active),
      withinGrace: sqlFlag(row.within_grace),
    };
  }

  async revokeRefreshToken(id: string, conn?: Pool | PoolConnection): Promise<void> {
    const db = conn ?? this.db;
    await db.execute(
      `UPDATE admin_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
  }

  async upsertAdminUser(input: {
    email: string;
    passwordHash: string;
    fullName?: string;
  }): Promise<{ id: string; created: boolean }> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      await this.db.execute(
        `UPDATE admin_users
         SET password_hash = ?, full_name = COALESCE(?, full_name), status = 'ACTIVE', deleted_at = NULL
         WHERE id = ?`,
        [input.passwordHash, input.fullName ?? null, existing.id],
      );
      return { id: existing.id, created: false };
    }

    const id = createId();
    await this.db.execute(
      `INSERT INTO admin_users (id, email, password_hash, full_name, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [id, input.email.toLowerCase(), input.passwordHash, input.fullName ?? null],
    );
    return { id, created: true };
  }
}
