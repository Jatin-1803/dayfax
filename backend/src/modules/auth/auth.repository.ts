import { createHash, randomInt } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type { RoleCode } from '../../common/middleware/auth.js';

export interface UserRecord {
  id: string;
  phone_country_code: string;
  phone: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}

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
      `SELECT id, phone_country_code, phone, full_name, email, avatar_url, status
       FROM users
       WHERE phone_country_code = ?
         AND phone = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [phoneCountryCode, phone],
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
    expiresAt: Date,
    conn?: Pool | PoolConnection,
  ): Promise<void> {
    const db = conn ?? this.db;
    await db.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [createId(), userId, hashValue(token), expiresAt],
    );
  }

  async findValidRefreshToken(
    token: string,
    conn: Pool | PoolConnection,
  ): Promise<(RowDataPacket & { id: string; user_id: string }) | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id
       FROM refresh_tokens
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1
       FOR UPDATE`,
      [hashValue(token)],
    );
    return (rows[0] as typeof rows[0] & { id: string; user_id: string }) ?? null;
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
      `SELECT id, phone_country_code, phone, full_name, email, avatar_url, status
       FROM users
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    return (rows[0] as UserRecord) ?? null;
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
