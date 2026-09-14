import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { pickLocalizedRequired } from '../../common/utils/localize.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import type { AppLang } from '../i18n/i18n.schema.js';
import { mapProductListItem } from '../products/products.service.js';
import { ProductsRepository } from '../products/products.repository.js';
import {
  homeCollectionStatus,
  pickWinningCollectionId,
  type HomeCollectionStatus,
} from './home-collections.eligibility.js';
import {
  HomeCollectionsRepository,
  type CollectionItemAvailability,
  type HomeCollectionItemRow,
  type HomeCollectionRow,
} from './home-collections.repository.js';
import type { CreateHomeCollectionInput, PatchHomeCollectionInput } from './home-collections.schema.js';

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function itemAvailability(row: HomeCollectionItemRow): CollectionItemAvailability {
  if (!row.name || row.product_deleted_at) return 'deleted';
  if (Number(row.product_is_active) !== 1) return 'inactive';
  if (Number(row.in_stock) === 1) return 'in_stock';
  if (Number(row.listed) === 1) return 'out_of_stock';
  return 'unavailable';
}

function mapItemAdmin(row: HomeCollectionItemRow) {
  return {
    productId: row.product_id,
    sortOrder: Number(row.sort_order),
    name: row.name,
    slug: row.slug,
    imageUrl: toPublicAssetUrl(row.image_url),
    availability: itemAvailability(row),
  };
}

export class HomeCollectionsService {
  constructor(
    private readonly repo = new HomeCollectionsRepository(),
    private readonly products = new ProductsRepository(),
  ) {}

  async getActive(lang: AppLang) {
    const row = await this.repo.findActiveWinner();
    if (!row) return { collection: null };

    const productIds = await this.repo.listProductIds(row.id);
    const products = await this.products.listSellableByIds(productIds);
    if (products.length === 0) return { collection: null };

    return {
      collection: {
        id: row.id,
        headline: pickLocalizedRequired(lang, row.headline, row.headline_hi),
        products: products.map((product) => mapProductListItem(product, lang)),
      },
    };
  }

  async listAdmin() {
    const rows = await this.repo.listAdmin();
    const items = await this.repo.listItemsForCollections(rows.map((row) => row.id));
    const now = new Date();
    const winnerId = pickWinningCollectionId(
      rows.map((row) => ({
        id: row.id,
        isActive: Boolean(row.is_active),
        startAt: toDate(row.start_at),
        endAt: toDate(row.end_at),
        priority: Number(row.priority),
        createdAt: toDate(row.created_at),
      })),
      now,
    );
    const itemsByCollection = groupItems(items);
    return rows.map((row) => this.mapAdmin(row, itemsByCollection.get(row.id) ?? [], winnerId, now));
  }

  async getAdmin(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError('Collection not found');
    const listed = await this.listAdmin();
    const match = listed.find((item) => item.id === id);
    if (!match) throw new NotFoundError('Collection not found');
    return match;
  }

  async create(input: CreateHomeCollectionInput) {
    await this.assertProductsExist(input.productIds);
    const id = await this.repo.insert(input);
    return this.getAdmin(id);
  }

  async patch(id: string, input: PatchHomeCollectionInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Collection not found');

    const startAt = input.startAt ?? toDate(existing.start_at);
    const endAt = input.endAt ?? toDate(existing.end_at);
    if (endAt.getTime() <= startAt.getTime()) {
      throw new ValidationError('End time must be after start time');
    }

    if (input.productIds) {
      await this.assertProductsExist(input.productIds);
    }

    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Collection not found');
    return this.getAdmin(id);
  }

  async remove(id: string) {
    const removed = await this.repo.softDelete(id);
    if (!removed) throw new NotFoundError('Collection not found');
  }

  private async assertProductsExist(productIds: string[]) {
    const found = new Set(await this.repo.findExistingProductIds(productIds));
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new ValidationError('One or more products were not found');
    }
  }

  private mapAdmin(
    row: HomeCollectionRow,
    items: HomeCollectionItemRow[],
    winnerId: string | null,
    now: Date,
  ) {
    const status: HomeCollectionStatus = homeCollectionStatus(
      {
        isActive: Boolean(row.is_active),
        startAt: toDate(row.start_at),
        endAt: toDate(row.end_at),
      },
      now,
    );
    return {
      id: row.id,
      headline: row.headline,
      headlineHi: row.headline_hi,
      priority: Number(row.priority),
      isActive: Boolean(row.is_active),
      startAt: toDate(row.start_at).toISOString(),
      endAt: toDate(row.end_at).toISOString(),
      createdAt: toDate(row.created_at).toISOString(),
      updatedAt: toDate(row.updated_at).toISOString(),
      status,
      isLiveWinner: row.id === winnerId,
      items: items.map(mapItemAdmin),
    };
  }
}

function groupItems(rows: HomeCollectionItemRow[]) {
  const grouped = new Map<string, HomeCollectionItemRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.collection_id) ?? [];
    list.push(row);
    grouped.set(row.collection_id, list);
  }
  return grouped;
}
