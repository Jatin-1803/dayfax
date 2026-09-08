import { ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import { slugify } from '../../common/database/catalog-data.js';
import { AdminZonesRepository } from './admin-zones.repository.js';
import type {
  CreateDeliveryZoneInput,
  CreateFeeSlabInput,
  CreateLocationInput,
  CreateServiceAreaInput,
  PatchDeliveryZoneInput,
  PatchFeeSlabInput,
  PatchLocationInput,
  PatchServiceAreaInput,
} from './admin-zones.schema.js';

function mapLocation(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    state: (row.state as string | null) ?? null,
    countryCode: row.country_code as string,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
  };
}

function mapServiceArea(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    name: row.name as string,
    slug: row.slug as string,
    isActive: Boolean(row.is_active),
    locationName: (row.location_name as string | null) ?? null,
  };
}

function mapZone(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    serviceAreaId: row.service_area_id as string,
    name: row.name as string,
    deliveryFeePaise: Number(row.delivery_fee_paise),
    minOrderPaise: Number(row.min_order_paise),
    freeDeliveryAbovePaise:
      row.free_delivery_above_paise != null ? Number(row.free_delivery_above_paise) : null,
    etaMinutes: Number(row.eta_minutes),
    isActive: Boolean(row.is_active),
    serviceAreaName: (row.service_area_name as string | null) ?? null,
  };
}

function mapFeeSlab(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    deliveryZoneId: row.delivery_zone_id as string,
    fromKm: Number(row.from_km),
    toKm: row.to_km != null ? Number(row.to_km) : null,
    feePaise: Number(row.fee_paise),
  };
}

export class AdminZonesService {
  constructor(private readonly repo = new AdminZonesRepository()) {}

  async listLocations() {
    const rows = await this.repo.listLocations();
    return rows.map((r) => mapLocation(r as Record<string, unknown>));
  }

  async createLocation(input: CreateLocationInput) {
    const id = await this.repo.createLocation(input);
    const row = await this.repo.findLocationById(id);
    return mapLocation(row as Record<string, unknown>);
  }

  async listServiceAreas() {
    const rows = await this.repo.listServiceAreas();
    return rows.map((r) => mapServiceArea(r as Record<string, unknown>));
  }

  async createServiceArea(input: CreateServiceAreaInput) {
    const location = await this.repo.findLocationById(input.locationId);
    if (!location) {
      throw new NotFoundError('Location not found');
    }
    const slug = input.slug?.trim() || slugify(input.name);
    try {
      const id = await this.repo.createServiceArea({ ...input, slug });
      const row = await this.repo.findServiceAreaById(id);
      return mapServiceArea(row as Record<string, unknown>);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ConflictError('Service area slug already exists');
      }
      throw error;
    }
  }

  async listDeliveryZones() {
    const rows = await this.repo.listDeliveryZones();
    return rows.map((r) => mapZone(r as Record<string, unknown>));
  }

  async createDeliveryZone(input: CreateDeliveryZoneInput) {
    const area = await this.repo.findServiceAreaById(input.serviceAreaId);
    if (!area) {
      throw new NotFoundError('Service area not found');
    }
    const id = await this.repo.createDeliveryZone(input);
    const row = await this.repo.findDeliveryZoneById(id);
    return mapZone(row as Record<string, unknown>);
  }

  async patchDeliveryZone(id: string, input: PatchDeliveryZoneInput) {
    const existing = await this.repo.findDeliveryZoneById(id);
    if (!existing) {
      throw new NotFoundError('Delivery zone not found');
    }
    await this.repo.updateDeliveryZone(id, input);
    const row = await this.repo.findDeliveryZoneById(id);
    return mapZone(row as Record<string, unknown>);
  }

  async patchLocation(id: string, input: PatchLocationInput) {
    const existing = await this.repo.findLocationById(id);
    if (!existing) throw new NotFoundError('Location not found');
    await this.repo.updateLocation(id, input);
    const row = await this.repo.findLocationById(id);
    return mapLocation(row as Record<string, unknown>);
  }

  async patchServiceArea(id: string, input: PatchServiceAreaInput) {
    const existing = await this.repo.findServiceAreaById(id);
    if (!existing) throw new NotFoundError('Service area not found');
    await this.repo.updateServiceArea(id, input);
    const row = await this.repo.findServiceAreaById(id);
    return mapServiceArea(row as Record<string, unknown>);
  }

  async listFeeSlabs(zoneId: string) {
    const zone = await this.repo.findDeliveryZoneById(zoneId);
    if (!zone) throw new NotFoundError('Delivery zone not found');
    const rows = await this.repo.listFeeSlabs(zoneId);
    return rows.map((r) => mapFeeSlab(r as Record<string, unknown>));
  }

  async createFeeSlab(zoneId: string, input: CreateFeeSlabInput) {
    const zone = await this.repo.findDeliveryZoneById(zoneId);
    if (!zone) throw new NotFoundError('Delivery zone not found');
    const id = await this.repo.createFeeSlab(zoneId, input);
    const row = await this.repo.findFeeSlabById(id);
    return mapFeeSlab(row as Record<string, unknown>);
  }

  async patchFeeSlab(zoneId: string, slabId: string, input: PatchFeeSlabInput) {
    const existing = await this.repo.findFeeSlabById(slabId);
    if (!existing || existing.delivery_zone_id !== zoneId) {
      throw new NotFoundError('Fee slab not found');
    }
    await this.repo.updateFeeSlab(slabId, input);
    const row = await this.repo.findFeeSlabById(slabId);
    return mapFeeSlab(row as Record<string, unknown>);
  }

  async deleteFeeSlab(zoneId: string, slabId: string) {
    const existing = await this.repo.findFeeSlabById(slabId);
    if (!existing || existing.delivery_zone_id !== zoneId) {
      throw new NotFoundError('Fee slab not found');
    }
    await this.repo.softDeleteFeeSlab(slabId);
  }
}
