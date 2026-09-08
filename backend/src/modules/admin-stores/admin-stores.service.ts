import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { slugify } from '../../common/database/catalog-data.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { SearchIndexService } from '../search/search-index.service.js';
import { StoresRepository } from '../stores/stores.repository.js';
import { mapStorePublic } from '../stores/stores.service.js';
import { AdminStoresRepository } from './admin-stores.repository.js';
import type {
  CreateAdminProductInput,
  CreateStoreInput,
  PatchStoreInput,
  PatchStoreProductInput,
} from './admin-stores.schema.js';

export class AdminStoresService {
  constructor(
    private readonly repo = new AdminStoresRepository(),
    private readonly storesRepo = new StoresRepository(),
    private readonly searchIndex = new SearchIndexService(),
  ) {}

  async list() {
    const rows = await this.storesRepo.list({ includeInactive: true });
    return rows.map(mapStorePublic);
  }

  async getOne(id: string) {
    const row = await this.storesRepo.findById(id);
    if (!row) throw new NotFoundError('Store not found');
    return mapStorePublic(row);
  }

  async create(input: CreateStoreInput) {
    const serviceAreaId =
      input.serviceAreaId ?? (await this.repo.resolveDefaultServiceAreaId());
    if (!serviceAreaId) {
      throw new ValidationError('No service area available');
    }

    let slug = input.slug?.trim() || slugify(input.name);
    if (!slug) throw new ValidationError('Invalid store name for slug');
    if (await this.repo.storeSlugExists(slug)) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const id = await this.repo.insertStore({
      ...input,
      slug,
      serviceAreaId,
    });
    return this.getOne(id);
  }

  async patch(id: string, input: PatchStoreInput) {
    const existing = await this.storesRepo.findById(id);
    if (!existing) throw new NotFoundError('Store not found');
    await this.repo.updateStore(id, input);
    return this.getOne(id);
  }

  async listProducts(storeId: string) {
    const store = await this.storesRepo.findById(storeId);
    if (!store) throw new NotFoundError('Store not found');
    const rows = await this.repo.listStoreProducts(storeId);
    return rows.map((row) => this.mapStoreProduct(row));
  }

  private mapStoreProduct(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      name: row.name as string,
      nameHi: (row.name_hi as string | null) ?? null,
      slug: row.slug as string,
      description: (row.description as string | null) ?? null,
      descriptionHi: (row.description_hi as string | null) ?? null,
      brand: (row.brand as string | null) ?? null,
      imageUrl: toPublicAssetUrl(row.image_url as string | null),
      isActive: Boolean(row.is_active),
      isAvailable: Boolean(row.is_available),
      categoryId: (row.category_id as string | null) ?? null,
      variantId: (row.variant_id as string | null) ?? null,
      unitLabel: (row.unit_label as string | null) ?? null,
      pricePaise: Number(row.price_paise ?? 0),
      mrpPaise: Number(row.mrp_paise ?? 0),
      quantityAvailable: Number(row.quantity_available ?? 0),
    };
  }

  async patchStoreProduct(storeId: string, productId: string, input: PatchStoreProductInput) {
    const store = await this.storesRepo.findById(storeId);
    if (!store) throw new NotFoundError('Store not found');

    const updated = await withTransaction(async (conn) => {
      return this.repo.updateStoreProductDetails(storeId, productId, input, conn);
    });
    if (!updated) throw new NotFoundError('Store product not found');

    try {
      await this.searchIndex.upsertProduct(productId);
    } catch {
      // optional
    }

    const row = await this.repo.findStoreProduct(storeId, productId);
    if (!row) throw new NotFoundError('Store product not found');
    return this.mapStoreProduct(row as Record<string, unknown>);
  }

  async createProduct(input: CreateAdminProductInput) {
    const store = await this.storesRepo.findById(input.storeId);
    if (!store) throw new NotFoundError('Store not found');

    let categoryId = input.categoryId;
    if (!categoryId) {
      categoryId =
        (await this.repo.findCategoryIdBySlug(input.categorySlug ?? 'food')) ?? undefined;
    }
    if (!categoryId) {
      throw new ValidationError('Category not found');
    }

    let slug = slugify(`${store.slug}-${input.name}`);
    if (!slug) throw new ValidationError('Invalid product name');
    if (await this.repo.slugExists(slug)) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const skuBase = slug.toUpperCase().replace(/-/g, '').slice(0, 24);
    const sku = `${skuBase}-1`;
    const mrpPaise = input.mrpPaise ?? input.pricePaise;

    const { productId } = await withTransaction(async (conn) => {
      return this.repo.createProductForStore(
        {
          storeId: input.storeId,
          categoryId: categoryId!,
          name: input.name,
          nameHi: input.nameHi ?? null,
          slug,
          description: input.description ?? null,
          descriptionHi: input.descriptionHi ?? null,
          brand: input.brand ?? store.name,
          imageUrl: input.imageUrl ?? null,
          unitLabel: input.unitLabel ?? '1 pc',
          pricePaise: input.pricePaise,
          mrpPaise,
          quantityAvailable: input.quantityAvailable ?? 100,
          isAvailable: input.isAvailable ?? true,
          sku,
        },
        conn,
      );
    });

    try {
      await this.searchIndex.upsertProduct(productId);
    } catch {
      // Search index is optional; product create should still succeed.
    }

    const products = await this.listProducts(input.storeId);
    const created = products.find((p) => p.id === productId);
    if (!created) throw new ConflictError('Product created but could not be loaded');
    return created;
  }
}
