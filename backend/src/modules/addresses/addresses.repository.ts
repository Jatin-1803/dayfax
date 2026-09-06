import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export interface AddressRow {
  id: string;
  user_id: string;
  service_area_id: string | null;
  delivery_zone_id: string | null;
  label: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: number;
}

export class AddressesRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async listByUser(userId: string): Promise<AddressRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, user_id, service_area_id, delivery_zone_id, label, line1, line2, landmark,
              city, state, pincode, latitude, longitude, is_default
       FROM addresses
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY is_default DESC, updated_at DESC`,
      [userId],
    );
    return rows as AddressRow[];
  }

  async findByIdForUser(id: string, userId: string): Promise<AddressRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, user_id, service_area_id, delivery_zone_id, label, line1, line2, landmark,
              city, state, pincode, latitude, longitude, is_default
       FROM addresses
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id, userId],
    );
    return (rows[0] as AddressRow) ?? null;
  }

  async resolveDefaultServiceAreaId(): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM service_areas
       WHERE deleted_at IS NULL AND is_active = 1
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async resolveDefaultZoneId(serviceAreaId: string): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM delivery_zones
       WHERE service_area_id = ? AND deleted_at IS NULL AND is_active = 1
       ORDER BY created_at ASC
       LIMIT 1`,
      [serviceAreaId],
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async clearDefault(userId: string, conn: Pool | PoolConnection = this.db): Promise<void> {
    await conn.query(
      `UPDATE addresses SET is_default = 0
       WHERE user_id = ? AND deleted_at IS NULL AND is_default = 1`,
      [userId],
    );
  }

  async create(
    input: {
      userId: string;
      serviceAreaId: string | null;
      deliveryZoneId: string | null;
      label: string;
      line1: string;
      line2?: string;
      landmark?: string;
      city: string;
      state?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      isDefault: boolean;
    },
    conn: Pool | PoolConnection = this.db,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO addresses (
         id, user_id, service_area_id, delivery_zone_id, label, line1, line2, landmark,
         city, state, pincode, latitude, longitude, is_default
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.serviceAreaId,
        input.deliveryZoneId,
        input.label,
        input.line1,
        input.line2 ?? null,
        input.landmark ?? null,
        input.city,
        input.state ?? null,
        input.pincode ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.isDefault ? 1 : 0,
      ],
    );
    return id;
  }

  async update(
    id: string,
    userId: string,
    fields: Record<string, unknown>,
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    const columns = Object.keys(fields);
    if (columns.length === 0) return;
    const sets = columns.map((col) => `${col} = ?`).join(', ');
    const values = columns.map((col) => fields[col]);
    await conn.query(
      `UPDATE addresses SET ${sets}
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [...values, id, userId],
    );
  }

  async softDelete(id: string, userId: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE addresses SET deleted_at = CURRENT_TIMESTAMP, is_default = 0
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    return result.affectedRows > 0;
  }

  async setDefault(id: string, userId: string, conn: PoolConnection): Promise<void> {
    await this.clearDefault(userId, conn);
    await conn.query(
      `UPDATE addresses SET is_default = 1
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
  }

  async countActive(userId: string, conn: Pool | PoolConnection = this.db): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM addresses
       WHERE user_id = ? AND deleted_at IS NULL`,
      [userId],
    );
    return Number(rows[0]?.total ?? 0);
  }
}
