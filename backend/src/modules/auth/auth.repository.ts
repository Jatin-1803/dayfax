import { createHash, randomInt } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
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

    const [roleRows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM roles WHERE code = 'CUSTOMER' LIMIT 1`,
    );
    const roleId = roleRows[0]?.id as string | undefined;
    if (roleId) {
      await this.db.execute(
        `INSERT INTO user_roles (id, user_id, role_id) VALUES (?, ?, ?)`,
        [createId(), userId, roleId],
      );
    }

    const user = await this.findUserByPhone(phoneCountryCode, phone);
    if (!user) {
      throw new Error('Failed to create user');
    }
    return user;
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

  async touchLogin(userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId],
    );
  }

  async storeRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.db.execute(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [createId(), userId, hashValue(token), expiresAt],
    );
  }

  async findValidRefreshToken(
    token: string,
  ): Promise<(RowDataPacket & { id: string; user_id: string }) | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, user_id
       FROM refresh_tokens
       WHERE token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [hashValue(token)],
    );
    return (rows[0] as typeof rows[0] & { id: string; user_id: string }) ?? null;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.db.execute(
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
