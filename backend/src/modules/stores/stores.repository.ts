import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

export interface StoreRow extends RowDataPacket {
  id: string;
  service_area_id: string;
  name: string;
  slug: string;
  store_type: string;
  image_url: string | null;
  description: string | null;
  phone_country_code: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  is_popular: number;
  is_active: number;
}

export class StoresRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async list(options: {
    popular?: boolean;
    storeType?: string;
    serviceAreaId?: string;
    includeInactive?: boolean;
  }): Promise<StoreRow[]> {
    const where: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (!options.includeInactive) {
      where.push('is_active = 1');
    }
    if (options.popular) {
      where.push('is_popular = 1');
    }
    if (options.storeType) {
      where.push('store_type = ?');
      params.push(options.storeType);
    }
    if (options.serviceAreaId) {
      where.push('service_area_id = ?');
      params.push(options.serviceAreaId);
    }

    const [rows] = await this.db.query<StoreRow[]>(
      `SELECT id, service_area_id, name, slug, store_type, image_url, description,
              phone_country_code, phone, address_line1, address_line2, landmark,
              city, pincode, latitude, longitude, is_popular, is_active
       FROM stores
       WHERE ${where.join(' AND ')}
       ORDER BY is_popular DESC, name ASC`,
      params,
    );
    return rows;
  }

  async findByIdOrSlug(idOrSlug: string): Promise<StoreRow | null> {
    const [rows] = await this.db.query<StoreRow[]>(
      `SELECT id, service_area_id, name, slug, store_type, image_url, description,
              phone_country_code, phone, address_line1, address_line2, landmark,
              city, pincode, latitude, longitude, is_popular, is_active
       FROM stores
       WHERE deleted_at IS NULL AND (id = ? OR slug = ?)
       LIMIT 1`,
      [idOrSlug, idOrSlug],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<StoreRow | null> {
    const [rows] = await this.db.query<StoreRow[]>(
      `SELECT id, service_area_id, name, slug, store_type, image_url, description,
              phone_country_code, phone, address_line1, address_line2, landmark,
              city, pincode, latitude, longitude, is_popular, is_active
       FROM stores
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findBySlug(slug: string): Promise<StoreRow | null> {
    const [rows] = await this.db.query<StoreRow[]>(
      `SELECT id, service_area_id, name, slug, store_type, image_url, description,
              phone_country_code, phone, address_line1, address_line2, landmark,
              city, pincode, latitude, longitude, is_popular, is_active
       FROM stores
       WHERE slug = ? AND deleted_at IS NULL
       LIMIT 1`,
      [slug],
    );
    return rows[0] ?? null;
  }
}
