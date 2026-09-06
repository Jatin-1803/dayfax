import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { AddressesRepository } from './addresses.repository.js';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.schema.js';
import type { AddressRow } from './addresses.repository.js';

function mapAddress(row: AddressRow) {
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    landmark: row.landmark,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    serviceAreaId: row.service_area_id,
    deliveryZoneId: row.delivery_zone_id,
    isDefault: Boolean(row.is_default),
  };
}

export class AddressesService {
  constructor(private readonly repo = new AddressesRepository()) {}

  async list(userId: string) {
    const rows = await this.repo.listByUser(userId);
    return rows.map(mapAddress);
  }

  async getById(userId: string, id: string) {
    const row = await this.repo.findByIdForUser(id, userId);
    if (!row) throw new NotFoundError('Address not found');
    return mapAddress(row);
  }

  async create(userId: string, input: CreateAddressInput) {
    const serviceAreaId =
      input.serviceAreaId ?? (await this.repo.resolveDefaultServiceAreaId());
    if (!serviceAreaId) {
      throw new ValidationError('No active service area available');
    }
    const deliveryZoneId =
      input.deliveryZoneId ?? (await this.repo.resolveDefaultZoneId(serviceAreaId));

    const existingCount = await this.repo.countActive(userId);
    const isDefault = input.isDefault ?? existingCount === 0;

    const id = await withTransaction(async (conn) => {
      if (isDefault) {
        await this.repo.clearDefault(userId, conn);
      }
      return this.repo.create(
        {
          userId,
          serviceAreaId,
          deliveryZoneId,
          label: input.label,
          line1: input.line1,
          line2: input.line2,
          landmark: input.landmark,
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          latitude: input.latitude,
          longitude: input.longitude,
          isDefault,
        },
        conn,
      );
    });

    return this.getById(userId, id);
  }

  async update(userId: string, id: string, input: UpdateAddressInput) {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Address not found');

    const fields: Record<string, unknown> = {};
    if (input.label !== undefined) fields.label = input.label;
    if (input.line1 !== undefined) fields.line1 = input.line1;
    if (input.line2 !== undefined) fields.line2 = input.line2 ?? null;
    if (input.landmark !== undefined) fields.landmark = input.landmark ?? null;
    if (input.city !== undefined) fields.city = input.city;
    if (input.state !== undefined) fields.state = input.state ?? null;
    if (input.pincode !== undefined) fields.pincode = input.pincode ?? null;
    if (input.latitude !== undefined) fields.latitude = input.latitude ?? null;
    if (input.longitude !== undefined) fields.longitude = input.longitude ?? null;
    if (input.serviceAreaId !== undefined) fields.service_area_id = input.serviceAreaId;
    if (input.deliveryZoneId !== undefined) fields.delivery_zone_id = input.deliveryZoneId ?? null;
    if (input.isDefault !== undefined) fields.is_default = input.isDefault ? 1 : 0;

    await withTransaction(async (conn) => {
      if (input.isDefault === true) {
        await this.repo.clearDefault(userId, conn);
        fields.is_default = 1;
      }
      await this.repo.update(id, userId, fields, conn);
    });

    return this.getById(userId, id);
  }

  async remove(userId: string, id: string) {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Address not found');

    const deleted = await this.repo.softDelete(id, userId);
    if (!deleted) throw new NotFoundError('Address not found');

    if (existing.is_default) {
      const remaining = await this.repo.listByUser(userId);
      if (remaining[0]) {
        await withTransaction(async (conn) => {
          await this.repo.setDefault(remaining[0].id, userId, conn);
        });
      }
    }

    return { id };
  }

  async setDefault(userId: string, id: string) {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Address not found');

    await withTransaction(async (conn) => {
      await this.repo.setDefault(id, userId, conn);
    });

    return this.getById(userId, id);
  }
}
