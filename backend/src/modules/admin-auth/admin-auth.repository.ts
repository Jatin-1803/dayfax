import { createHash } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
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
    expiresAt: Date,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO admin_refresh_tokens (id, admin_user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [createId(), adminUserId, hashValue(token), expiresAt],
    );
  }

  async findValidRefreshToken(
    token: string,
  ): Promise<(RowDataPacket & { id: string; admin_user_id: string }) | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, admin_user_id
       FROM admin_refresh_tokens
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [hashValue(token)],
    );
    return (rows[0] as typeof rows[0] & { id: string; admin_user_id: string }) ?? null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.db.execute(
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
