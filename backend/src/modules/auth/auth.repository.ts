import { createHash, randomInt } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { REFRESH_REUSE_GRACE_SECONDS, sqlFlag } from '../../common/auth/token-session.js';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type { RoleCode } from '../../common/middleware/auth.js';

export interface UserRecord {
  id: string;
  phone_country_code: string | null;
  phone: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  google_sub: string | null;
  password_hash: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'SUSPENDED' | 'BANNED' | 'SECURITY_LOCKED';
  status_expires_at?: Date | null;
}

const USER_SELECT = `id, phone_country_code, phone, full_name, email, avatar_url, google_sub,
              password_hash, status, status_expires_at`;

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class AuthRepository {
  constructor(private readonly db: Pool = getPool()) {}

  hash(value: string): string {
    return hashValue(value);
  }

  generateOtp(length: number): string {
    const max = 10 ** length;
    return String(randomInt(0, max)).padStart(length, '0');
  }

  async createOtpChallenge(input: {
    phoneCountryCode: string;
    phone: string;
    code: string;
    expiresAt: Date;
  }): Promise<string> {
    const id = createId();
    await this.db.execute(
      `INSERT INTO otp_challenges
        (id, phone_country_code, phone, code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        id,
        input.phoneCountryCode,
        input.phone,
        hashValue(input.code),
        input.expiresAt,
      ],
    );
    return id;
  }

  async findLatestActiveOtp(
    phoneCountryCode: string,
    phone: string,
  ): Promise<
    | (RowDataPacket & {
        id: string;
        code_hash: string;
        expires_at: Date;
        attempts: number;
        max_attempts: number;
      })
    | null
  > {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, code_hash, expires_at, attempts, max_attempts
       FROM otp_challenges
       WHERE phone_country_code = ?
         AND phone = ?
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [phoneCountryCode, phone],
    );
    return (rows[0] as typeof rows[0] & {
      id: string;
      code_hash: string;
      expires_at: Date;
      attempts: number;
      max_attempts: number;
    }) ?? null;
  }

  async incrementOtpAttempts(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?`,
      [id],
    );
  }

  async consumeOtp(id: string): Promise<void> {
    await this.db.execute(
      `UPDATE otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
  }

  async findUserByPhone(
    phoneCountryCode: string,
    phone: string,
  ): Promise<UserRecord | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE phone_country_code = ?
         AND phone = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [phoneCountryCode, phone],
    );
    return (rows[0] as UserRecord) ?? null;
  }

  async findUserByGoogleSub(googleSub: string): Promise<UserRecord | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE google_sub = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [googleSub],
    );
    return (rows[0] as UserRecord) ?? null;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE email = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    );
    return (rows[0] as UserRecord) ?? null;
  }

  async createCustomerUser(phoneCountryCode: string, phone: string): Promise<UserRecord> {
    const userId = createId();
    await this.db.execute(
      `INSERT INTO users (id, phone_country_code, phone, status)
       VALUES (?, ?, ?, 'ACTIVE')`,
      [userId, phoneCountryCode, phone],
    );

    await this.ensureRole(userId, 'CUSTOMER');

    const user = await this.findUserByPhone(phoneCountryCode, phone);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
  }

  async createGoogleCustomerUser(input: {
    googleSub: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  }): Promise<UserRecord> {
    const userId = createId();
    await this.db.execute(
      `INSERT INTO users
        (id, phone_country_code, phone, full_name, email, avatar_url, google_sub, status)
       VALUES (?, NULL, NULL, ?, ?, ?, ?, 'ACTIVE')`,
      [
        userId,
        input.fullName,
        input.email,
        input.avatarUrl,
        input.googleSub,
      ],
    );

    await this.ensureRole(userId, 'CUSTOMER');

    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error('Failed to create Google user');
    }
    return user;
  }

  async linkGoogleSub(userId: string, googleSub: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET google_sub = ? WHERE id = ? AND google_sub IS NULL`,
      [googleSub, userId],
    );
  }

  async setUserPhone(
    userId: string,
    phoneCountryCode: string,
    phone: string,
  ): Promise<void> {
    await this.db.execute(
      `UPDATE users
       SET phone_country_code = ?, phone = ?
       WHERE id = ?`,
      [phoneCountryCode, phone, userId],
    );
  }

  async updateGoogleProfileFields(
    userId: string,
    input: { fullName?: string | null; avatarUrl?: string | null; email?: string | null },
  ): Promise<void> {
    const sets: string[] = [];
    const params: Array<string | null> = [];
    if (input.fullName !== undefined) {
      sets.push('full_name = COALESCE(full_name, ?)');
      params.push(input.fullName);
    }
    if (input.avatarUrl !== undefined) {
      sets.push('avatar_url = COALESCE(avatar_url, ?)');
      params.push(input.avatarUrl);
    }
    if (input.email !== undefined) {
      sets.push('email = COALESCE(email, ?)');
      params.push(input.email);
    }
    if (sets.length === 0) return;
    params.push(userId);
    await this.db.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  async findRoleIdByCode(code: RoleCode): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM roles WHERE code = ? LIMIT 1`,
      [code],
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async ensureRole(userId: string, code: RoleCode): Promise<boolean> {
    const roleId = await this.findRoleIdByCode(code);
    if (!roleId) {
      throw new Error(`Role ${code} not found`);
    }

    const [existing] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? LIMIT 1`,
      [userId, roleId],
    );
    if (existing[0]) {
      return false;
    }

    await this.db.execute(
      `INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)`,
      [createId(), userId, roleId],
    );
    return true;
  }

  async updateFullName(userId: string, fullName: string): Promise<void> {
    await this.db.execute(`UPDATE users SET full_name = ? WHERE id = ?`, [
      fullName,
      userId,
    ]);
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [
      passwordHash,
      userId,
    ]);
  }

  /**
   * Creates a delivery-partner-only user, or grants DELIVERY_PARTNER to an existing user.
   * Does not auto-assign CUSTOMER.
   */
  async createOrPromoteDeliveryPartner(input: {
    phoneCountryCode: string;
    phone: string;
    fullName?: string;
  }): Promise<{ user: UserRecord; created: boolean; roleAdded: boolean }> {
    const existing = await this.findUserByPhone(input.phoneCountryCode, input.phone);
    if (existing) {
      if (input.fullName) {
        await this.updateFullName(existing.id, input.fullName);
      }
      const roleAdded = await this.ensureRole(existing.id, 'DELIVERY_PARTNER');
      const user =
        (await this.findUserById(existing.id)) ??
        (await this.findUserByPhone(input.phoneCountryCode, input.phone));
      if (!user) {
        throw new Error('Failed to load delivery partner');
      }
      return { user, created: false, roleAdded };
    }

    const userId = createId();
    await this.db.execute(
      `INSERT INTO users (id, phone_country_code, phone, full_name, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [userId, input.phoneCountryCode, input.phone, input.fullName ?? null],
    );
    await this.ensureRole(userId, 'DELIVERY_PARTNER');

    const user = await this.findUserByPhone(input.phoneCountryCode, input.phone);
    if (!user) {
      throw new Error('Failed to create delivery partner');
    }
    return { user, created: true, roleAdded: true };
  }

  async getUserRoles(userId: string): Promise<RoleCode[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT r.code
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId],
    );
    return rows.map((row) => row.code as RoleCode);
  }

  async getUserRolesForUsers(userIds: string[]): Promise<Map<string, RoleCode[]>> {
    const result = new Map<string, RoleCode[]>();
    if (userIds.length === 0) return result;

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ur.user_id, r.code
       FROM user_roles ur
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id IN (?)`,
      [userIds],
    );

    for (const id of userIds) {
      result.set(id, []);
    }
    for (const row of rows) {
      const list = result.get(row.user_id as string) ?? [];
      list.push(row.code as RoleCode);
      result.set(row.user_id as string, list);
    }
    return result;
  }

  async touchLogin(userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId],
    );
  }

  async storeRefreshToken(
    userId: string,
    token: string,
    expiresInSeconds: number,
    conn?: Pool | PoolConnection,
    sessionId?: string,
  ): Promise<void> {
    const db = conn ?? this.db;
    // NOW() on both write and lookup so session timezone cannot expire a fresh token.
    await db.execute(
      `INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
      [createId(), userId, sessionId ?? null, hashValue(token), expiresInSeconds],
    );
  }

  async findRefreshTokenForUpdate(
    token: string,
    conn: Pool | PoolConnection,
  ): Promise<{ id: string; user_id: string; sessionId: string | null; active: boolean; withinGrace: boolean } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, session_id,
              (revoked_at IS NULL AND expires_at > NOW()) AS active,
              (revoked_at IS NOT NULL
                AND revoked_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
                AND expires_at > NOW()) AS within_grace
       FROM refresh_tokens
       WHERE token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [REFRESH_REUSE_GRACE_SECONDS, hashValue(token)],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      sessionId: (row.session_id as string | null) ?? null,
      active: sqlFlag(row.active),
      withinGrace: sqlFlag(row.within_grace),
    };
  }

  async revokeRefreshToken(id: string, conn?: Pool | PoolConnection): Promise<void> {
    const db = conn ?? this.db;
    await db.execute(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id],
    );
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${USER_SELECT}
       FROM users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    return (rows[0] as UserRecord) ?? null;
  }

  async recordSecurityEvent(input: {
    userId?: string | null;
    phone?: string | null;
    eventType: string;
    ipAddress?: string | null;
    deviceId?: string | null;
    meta?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO user_security_events
        (id, user_id, phone, event_type, ip_address, device_id, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        input.userId ?? null,
        input.phone ?? null,
        input.eventType,
        input.ipAddress ?? null,
        input.deviceId ?? null,
        input.meta ? JSON.stringify(input.meta) : null,
      ],
    );
  }

  async countSecurityEvents(input: {
    phone: string;
    eventType: string;
    windowMinutes: number;
  }): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM user_security_events
       WHERE phone = ?
         AND event_type = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [input.phone, input.eventType, input.windowMinutes],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async lockUser(userId: string, until: Date): Promise<void> {
    await this.db.execute(
      `UPDATE users
       SET status = 'SECURITY_LOCKED', status_expires_at = ?
       WHERE id = ? AND status = 'ACTIVE'`,
      [until, userId],
    );
  }

  async clearSecurityLock(userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE users
       SET status = 'ACTIVE', status_expires_at = NULL
       WHERE id = ? AND status = 'SECURITY_LOCKED'`,
      [userId],
    );
  }

  async invalidateOlderOtps(phoneCountryCode: string, phone: string): Promise<ResultSetHeader> {
    const [result] = await this.db.execute<ResultSetHeader>(
      `UPDATE otp_challenges
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE phone_country_code = ?
         AND phone = ?
         AND consumed_at IS NULL`,
      [phoneCountryCode, phone],
    );
    return result;
  }
}
