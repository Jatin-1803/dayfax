import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { ProductsRepository } from './products.repository.js';
import type { ListProductsQuery } from './products.schema.js';

function mapListItem(row: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  store_id: string;
  store_name: string;
  default_variant_id: string | null;
  unit_label: string | null;
  price_paise: number | null;
  mrp_paise: number | null;
  quantity_available: number | null;
}) {
  const pricePaise = row.price_paise ?? 0;
  const mrpPaise = row.mrp_paise ?? pricePaise;
  const discountPercent =
    mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    brand: row.brand,
    imageUrl: row.image_url,
    category: {
      id: row.category_id,
      name: row.category_name,
    },
    store: {
      id: row.store_id,
      name: row.store_name,
    },
    defaultVariant: row.default_variant_id
      ? {
          id: row.default_variant_id,
          unitLabel: row.unit_label,
          pricePaise,
          mrpPaise,
          discountPercent,
          quantityAvailable: row.quantity_available ?? 0,
          inStock: (row.quantity_available ?? 0) > 0,
        }
      : null,
  };
}

export class ProductsService {
  constructor(private readonly repo = new ProductsRepository()) {}

  async list(query: ListProductsQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const storeId = await this.repo.resolveDefaultStoreId(query.storeId);
    if (!storeId) {
      throw new ValidationError('No active store available');
    }

    const categoryId = await this.repo.resolveCategoryId({
      categoryId: query.categoryId,
      categorySlug: query.categorySlug,
    });

    if ((query.categoryId || query.categorySlug) && !categoryId) {
      throw new NotFoundError('Category not found');
    }

    const { rows, total } = await this.repo.list({
      storeId,
      categoryId,
      q: query.q,
      limit,
      offset,
    });

    return {
      items: rows.map(mapListItem),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async getByIdOrSlug(idOrSlug: string, storeId?: string) {
    const product = await this.repo.findByIdOrSlug(idOrSlug);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const resolvedStoreId = await this.repo.resolveDefaultStoreId(storeId);
    if (!resolvedStoreId) {
      throw new ValidationError('No active store available');
    }

    const variants = await this.repo.listVariantsForStore(product.id, resolvedStoreId);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      brand: product.brand,
      imageUrl: product.image_url,
      category: {
        id: product.category_id,
        name: product.category_name,
      },
      storeId: resolvedStoreId,
      variants: variants.map((v) => {
        const discountPercent =
          v.mrp_paise > v.price_paise
            ? Math.round(((v.mrp_paise - v.price_paise) / v.mrp_paise) * 100)
            : 0;
        return {
          id: v.id,
          sku: v.sku,
          unitLabel: v.unit_label,
          unitValue: v.unit_value === null ? null : Number(v.unit_value),
          unitType: v.unit_type,
          pricePaise: v.price_paise,
          mrpPaise: v.mrp_paise,
          discountPercent,
          isDefault: Boolean(v.is_default),
          quantityAvailable: v.quantity_available ?? 0,
          inStock: (v.quantity_available ?? 0) > 0,
        };
      }),
    };
  }
}
