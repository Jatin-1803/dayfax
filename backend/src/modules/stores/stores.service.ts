import { NotFoundError } from '../../common/errors/app-error.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { StoresRepository, type StoreRow } from './stores.repository.js';
import type { ListStoresQuery } from './stores.schema.js';

export function mapStorePublic(row: StoreRow) {
  return {
    id: row.id,
    serviceAreaId: row.service_area_id,
    name: row.name,
    slug: row.slug,
    storeType: row.store_type,
    imageUrl: toPublicAssetUrl(row.image_url),
    description: row.description,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    landmark: row.landmark,
    city: row.city,
    pincode: row.pincode,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    isPopular: Boolean(row.is_popular),
    isActive: Boolean(row.is_active),
    addressSummary: [
      row.address_line1,
      row.address_line2,
      row.landmark,
      row.city,
      row.pincode,
    ]
      .filter((part) => part && String(part).trim().length > 0)
      .join(', '),
  };
}

export class StoresService {
  constructor(private readonly repo = new StoresRepository()) {}

  async list(query: ListStoresQuery) {
    const rows = await this.repo.list({
      popular: query.popular,
      storeType: query.storeType,
      serviceAreaId: query.serviceAreaId,
    });
    return rows.map(mapStorePublic);
  }

  async getByIdOrSlug(idOrSlug: string) {
    const row = await this.repo.findByIdOrSlug(idOrSlug);
    if (!row || !row.is_active) {
      throw new NotFoundError('Store not found');
    }
    return mapStorePublic(row);
  }
}
