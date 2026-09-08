import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type {
  CreateDeliveryZoneInput,
  CreateLocationInput,
  CreateServiceAreaInput,
  PatchDeliveryZoneInput,
} from './admin-zones.schema.js';

export class AdminZonesRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async listLocations() {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, name, state, country_code, latitude, longitude
       FROM locations
       WHERE deleted_at IS NULL
       ORDER BY name ASC`,
    );
    return rows;
  }

  async createLocation(input: CreateLocationInput) {
    const id = createId();
    await this.db.execute(
      `INSERT INTO locations (id, name, state, country_code, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.state ?? null,
        input.countryCode,
        input.latitude ?? null,
        input.longitude ?? null,
      ],
    );
    return id;
  }

  async findLocationById(id: string) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, name, state, country_code, latitude, longitude
       FROM locations WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async listServiceAreas() {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT sa.id, sa.location_id, sa.name, sa.slug, sa.is_active, l.name AS location_name
       FROM service_areas sa
       INNER JOIN locations l ON l.id = sa.location_id
       WHERE sa.deleted_at IS NULL
       ORDER BY sa.name ASC`,
    );
    return rows;
  }

  async findServiceAreaById(id: string) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT sa.id, sa.location_id, sa.name, sa.slug, sa.is_active, l.name AS location_name
       FROM service_areas sa
       INNER JOIN locations l ON l.id = sa.location_id
       WHERE sa.id = ? AND sa.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createServiceArea(input: CreateServiceAreaInput & { slug: string }) {
    const id = createId();
    await this.db.execute(
      `INSERT INTO service_areas (id, location_id, name, slug, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.locationId, input.name, input.slug, input.isActive ? 1 : 0],
    );
    return id;
  }

  async listDeliveryZones() {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT dz.id, dz.service_area_id, dz.name, dz.delivery_fee_paise, dz.min_order_paise,
              dz.free_delivery_above_paise, dz.eta_minutes, dz.is_active,
              sa.name AS service_area_name
       FROM delivery_zones dz
       INNER JOIN service_areas sa ON sa.id = dz.service_area_id
       WHERE dz.deleted_at IS NULL
       ORDER BY dz.name ASC`,
    );
    return rows;
  }

  async findDeliveryZoneById(id: string) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT dz.id, dz.service_area_id, dz.name, dz.delivery_fee_paise, dz.min_order_paise,
              dz.free_delivery_above_paise, dz.eta_minutes, dz.is_active,
              sa.name AS service_area_name
       FROM delivery_zones dz
       INNER JOIN service_areas sa ON sa.id = dz.service_area_id
       WHERE dz.id = ? AND dz.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createDeliveryZone(input: CreateDeliveryZoneInput) {
    const id = createId();
    await this.db.execute(
      `INSERT INTO delivery_zones
         (id, service_area_id, name, delivery_fee_paise, min_order_paise,
          free_delivery_above_paise, eta_minutes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.serviceAreaId,
        input.name,
        input.deliveryFeePaise,
        input.minOrderPaise,
        input.freeDeliveryAbovePaise ?? null,
        input.etaMinutes,
        input.isActive ? 1 : 0,
      ],
    );
    return id;
  }

  async updateDeliveryZone(id: string, input: PatchDeliveryZoneInput): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      params.push(input.name);
    }
    if (input.deliveryFeePaise !== undefined) {
      sets.push('delivery_fee_paise = ?');
      params.push(input.deliveryFeePaise);
    }
    if (input.minOrderPaise !== undefined) {
      sets.push('min_order_paise = ?');
      params.push(input.minOrderPaise);
    }
    if (input.freeDeliveryAbovePaise !== undefined) {
      sets.push('free_delivery_above_paise = ?');
      params.push(input.freeDeliveryAbovePaise);
    }
    if (input.etaMinutes !== undefined) {
      sets.push('eta_minutes = ?');
      params.push(input.etaMinutes);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (sets.length === 0) return false;
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE delivery_zones SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }

  async listFeeSlabs(zoneId: string) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, delivery_zone_id, from_km, to_km, fee_paise
       FROM delivery_fee_slabs
       WHERE delivery_zone_id = ? AND deleted_at IS NULL
       ORDER BY from_km ASC`,
      [zoneId],
    );
    return rows;
  }

  async findFeeSlabById(id: string) {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, delivery_zone_id, from_km, to_km, fee_paise
       FROM delivery_fee_slabs
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createFeeSlab(
    zoneId: string,
    input: { fromKm: number; toKm?: number | null; feePaise: number },
  ) {
    const id = createId();
    await this.db.execute(
      `INSERT INTO delivery_fee_slabs (id, delivery_zone_id, from_km, to_km, fee_paise)
       VALUES (?, ?, ?, ?, ?)`,
      [id, zoneId, input.fromKm, input.toKm ?? null, input.feePaise],
    );
    return id;
  }

  async updateFeeSlab(
    id: string,
    input: { fromKm?: number; toKm?: number | null; feePaise?: number },
  ): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.fromKm !== undefined) {
      sets.push('from_km = ?');
      params.push(input.fromKm);
    }
    if (input.toKm !== undefined) {
      sets.push('to_km = ?');
      params.push(input.toKm);
    }
    if (input.feePaise !== undefined) {
      sets.push('fee_paise = ?');
      params.push(input.feePaise);
    }
    if (sets.length === 0) return false;
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE delivery_fee_slabs SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }

  async softDeleteFeeSlab(id: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE delivery_fee_slabs SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return result.affectedRows > 0;
  }

  async updateLocation(
    id: string,
    input: { name?: string; state?: string | null; latitude?: number | null; longitude?: number | null },
  ): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      params.push(input.name);
    }
    if (input.state !== undefined) {
      sets.push('state = ?');
      params.push(input.state);
    }
    if (input.latitude !== undefined) {
      sets.push('latitude = ?');
      params.push(input.latitude);
    }
    if (input.longitude !== undefined) {
      sets.push('longitude = ?');
      params.push(input.longitude);
    }
    if (sets.length === 0) return false;
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE locations SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }

  async updateServiceArea(
    id: string,
    input: { name?: string; isActive?: boolean },
  ): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      params.push(input.name);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (sets.length === 0) return false;
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE service_areas SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }
}
