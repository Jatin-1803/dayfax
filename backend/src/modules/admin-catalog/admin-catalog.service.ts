import { ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import { slugify } from '../../common/database/catalog-data.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { SearchIndexService } from '../search/search-index.service.js';
import { AdminCatalogRepository } from './admin-catalog.repository.js';
import type {
  CreateCategoryInput,
  PatchCategoryInput,
  PatchProductInput,
} from './admin-catalog.schema.js';

function mapCategory(row: NonNullable<Awaited<ReturnType<AdminCatalogRepository['findCategoryById']>>>) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    nameHi: row.name_hi,
    slug: row.slug,
    iconKey: row.icon_key,
    imageUrl: toPublicAssetUrl(row.image_url),
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
  };
}

export class AdminCatalogService {
  constructor(
    private readonly repo = new AdminCatalogRepository(),
    private readonly searchIndex = new SearchIndexService(),
  ) {}

  async createCategory(input: CreateCategoryInput) {
    if (input.parentId) {
      const parent = await this.repo.findCategoryById(input.parentId);
      if (!parent) {
        throw new NotFoundError('Parent category not found');
      }
    }
    const slug = input.slug?.trim() || slugify(input.name);
    try {
      const id = await this.repo.createCategory({ ...input, slug });
      const row = await this.repo.findCategoryById(id);
      return mapCategory(row!);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ER_DUP_ENTRY') {
        throw new ConflictError('Category slug already exists');
      }
      throw error;
    }
  }

  async patchCategory(id: string, input: PatchCategoryInput) {
    const existing = await this.repo.findCategoryById(id);
    if (!existing) {
      throw new NotFoundError('Category not found');
    }
    await this.repo.updateCategory(id, input);
    const row = await this.repo.findCategoryById(id);
    return mapCategory(row!);
  }

  async patchProduct(id: string, input: PatchProductInput) {
    const existing = await this.repo.findProductById(id);
    if (!existing) {
      throw new NotFoundError('Product not found');
    }
    await this.repo.updateProduct(id, input);
    await this.searchIndex.upsertProduct(id);
    return this.getProduct(id);
  }

  async getProduct(id: string) {
    const row = await this.repo.findProductById(id);
    if (!row) {
      throw new NotFoundError('Product not found');
    }
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      nameHi: row.name_hi,
      slug: row.slug,
      description: row.description,
      descriptionHi: row.description_hi,
      brand: row.brand,
      subCategory: (row.sub_category as string | null) ?? null,
      subCategoryHi: (row.sub_category_hi as string | null) ?? null,
      imageUrl: toPublicAssetUrl(row.image_url as string | null),
      isActive: Boolean(row.is_active),
      storeId: (row.store_id as string | null) ?? null,
      isAvailable: row.is_available != null ? Boolean(row.is_available) : null,
      defaultVariant: row.variant_id
        ? {
            id: row.variant_id as string,
            unitLabel: row.unit_label as string,
            pricePaise: Number(row.price_paise ?? 0),
            mrpPaise: Number(row.mrp_paise ?? 0),
            quantityAvailable: Number(row.quantity_available ?? 0),
          }
        : null,
    };
  }
}
