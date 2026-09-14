import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export type DevicePlatform = 'android' | 'ios';
export type DeviceLocale = 'en' | 'hi';
export type DeviceAppRole = 'CUSTOMER' | 'DELIVERY_PARTNER';

export interface DeviceTokenRow {
  fcm_token: string;
  locale: DeviceLocale;
}

export class DevicesRepository {
  constructor(private readonly db = getPool()) {}

  async upsert(input: {
    userId: string;
    token: string;
    platform: DevicePlatform;
    locale: DeviceLocale;
    appRole: DeviceAppRole;
  }): Promise<void> {
    const id = createId();
    await this.db.query(
      `INSERT INTO user_devices (id, user_id, fcm_token, platform, locale, app_role)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         platform = VALUES(platform),
         locale = VALUES(locale),
         app_role = VALUES(app_role),
         updated_at = CURRENT_TIMESTAMP`,
      [id, input.userId, input.token, input.platform, input.locale, input.appRole],
    );
  }

  async deleteForUser(userId: string, token: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM user_devices
       WHERE user_id = ? AND fcm_token = ?`,
      [userId, token],
    );
    return result.affectedRows > 0;
  }

  async listForUser(userId: string, appRole: DeviceAppRole): Promise<DeviceTokenRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT fcm_token, locale
       FROM user_devices
       WHERE user_id = ? AND app_role = ?`,
      [userId, appRole],
    );
    return rows as DeviceTokenRow[];
  }

  async listForPromo(audience: 'CUSTOMERS' | 'PARTNERS' | 'ALL'): Promise<
    Array<{ user_id: string; fcm_token: string; locale: DeviceLocale; app_role: DeviceAppRole }>
  > {
    const roles =
      audience === 'ALL' ? ['CUSTOMER', 'DELIVERY_PARTNER'] : audience === 'PARTNERS' ? ['DELIVERY_PARTNER'] : ['CUSTOMER'];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT d.user_id, d.fcm_token, d.locale, d.app_role
       FROM user_devices d
       INNER JOIN users u ON u.id = d.user_id
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id AND r.code = d.app_role
       WHERE d.app_role IN (?)
         AND u.status = 'ACTIVE'
         AND u.deleted_at IS NULL`,
      [roles],
    );
    return rows as Array<{
      user_id: string;
      fcm_token: string;
      locale: DeviceLocale;
      app_role: DeviceAppRole;
    }>;
  }

  async listForDeliveryPartners(): Promise<DeviceTokenRow[]> {
    const rows = await this.listEligiblePartnerDevices();
    return rows.map((row) => ({ fcm_token: row.fcm_token, locale: row.locale }));
  }

  async listEligiblePartnerDevices(): Promise<
    Array<{ user_id: string; fcm_token: string; locale: DeviceLocale }>
  > {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT d.user_id, d.fcm_token, d.locale
       FROM user_devices d
       INNER JOIN users u ON u.id = d.user_id
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE d.app_role = 'DELIVERY_PARTNER'
         AND u.status = 'ACTIVE'
         AND u.deleted_at IS NULL
         AND r.code = 'DELIVERY_PARTNER'`,
    );
    return rows as Array<{ user_id: string; fcm_token: string; locale: DeviceLocale }>;
  }

  async listDevicesForPartners(
    partnerIds: string[],
  ): Promise<Array<{ user_id: string; fcm_token: string; locale: DeviceLocale }>> {
    if (partnerIds.length === 0) return [];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT d.user_id, d.fcm_token, d.locale
       FROM user_devices d
       INNER JOIN users u ON u.id = d.user_id
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE d.app_role = 'DELIVERY_PARTNER'
         AND d.user_id IN (?)
         AND u.status = 'ACTIVE'
         AND u.deleted_at IS NULL
         AND r.code = 'DELIVERY_PARTNER'`,
      [partnerIds],
    );
    return rows as Array<{ user_id: string; fcm_token: string; locale: DeviceLocale }>;
  }

  async deleteTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.db.query(`DELETE FROM user_devices WHERE fcm_token IN (?)`, [tokens]);
  }
}
