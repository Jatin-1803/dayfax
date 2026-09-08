import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { logger } from '../../common/logger/logger.js';
import { pickLocalized, pickLocalizedRequired } from '../../common/utils/localize.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import type { AppLang } from '../i18n/i18n.schema.js';
import { SearchIndexService } from '../search/search-index.service.js';
import { SearchRepository, type SearchMatchVia } from '../search/search.repository.js';
import { ProductsRepository, type ProductListRow } from './products.repository.js';
import type {
  GetProductQuery,
  ListProductsQuery,
  SimilarProductsQuery,
} from './products.schema.js';

function mapListItem(row: ProductListRow, lang: AppLang) {
  const pricePaise = row.price_paise ?? 0;
  const mrpPaise = row.mrp_paise ?? pricePaise;
  const discountPercent =
    mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;

  return {
    id: row.id,
    name: pickLocalizedRequired(lang, row.name, row.name_hi),
    slug: row.slug,
    description: pickLocalized(lang, row.description, row.description_hi),
    brand: row.brand,
    imageUrl: toPublicAssetUrl(row.image_url),
    category: {
      id: row.category_id,
      name: pickLocalizedRequired(lang, row.category_name, row.category_name_hi),
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
  constructor(
    private readonly repo = new ProductsRepository(),
    private readonly searchRepo = new SearchRepository(),
    private readonly searchIndex = new SearchIndexService(),
  ) {}

  async list(query: ListProductsQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );

    const categoryId = await this.repo.resolveCategoryId({
      categoryId: query.categoryId,
      categorySlug: query.categorySlug,
    });

    if ((query.categoryId || query.categorySlug) && !categoryId) {
      throw new NotFoundError('Category not found');
    }

    // Cross-store search/popular when storeId is omitted and q or popular is set.
    const acrossStores = !query.storeId && Boolean(query.q || query.popular);
    let storeId: string | undefined = query.storeId;
    if (!acrossStores) {
      const resolved = await this.repo.resolveDefaultStoreId(query.storeId);
      if (!resolved) {
        throw new ValidationError('No active store available');
      }
      storeId = resolved;
    }

    let rows: ProductListRow[];
    let total: number;
    let matchedVia: SearchMatchVia = 'direct';
    let canonicalTerm: string | null = null;
    let normalizedQ: string | null = null;

    if (query.q && storeId && !acrossStores) {
      const expanded = await this.searchRepo.expandQuery(query.q);
      normalizedQ = expanded?.normalized ?? null;
      canonicalTerm = expanded?.canonicalTerm ?? null;

      const meiliResult =
        expanded && this.searchIndex.enabled
          ? await this.searchIndex.search({
              q: query.q,
              storeId,
              categoryId,
              limit,
              offset,
            })
          : null;

      if (meiliResult) {
        rows = await this.repo.listByIdsForStore(storeId, meiliResult.ids);
        total = meiliResult.total;
        matchedVia = 'meili';
      } else {
        const mysqlResult = await this.repo.list({
          storeId,
          categoryId,
          q: query.q,
          searchTerms: expanded?.terms,
          limit,
          offset,
        });
        rows = mysqlResult.rows;
        total = mysqlResult.total;
        matchedVia = expanded?.matchedViaSynonym
          ? 'synonym'
          : this.searchIndex.enabled
            ? 'fallback'
            : 'direct';
      }

      void this.searchRepo
        .logQuery({
          q: query.q,
          normalizedQ: normalizedQ ?? query.q,
          storeId,
          resultCount: total,
          matchedVia,
          canonicalTerm,
        })
        .catch((error) => {
          logger.warn('Failed to log search query', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } else if (query.q && acrossStores) {
      const expanded = await this.searchRepo.expandQuery(query.q);
      normalizedQ = expanded?.normalized ?? null;
      canonicalTerm = expanded?.canonicalTerm ?? null;
      const mysqlResult = await this.repo.list({
        acrossStores: true,
        categoryId,
        q: query.q,
        searchTerms: expanded?.terms,
        limit,
        offset,
      });
      rows = mysqlResult.rows;
      total = mysqlResult.total;
      matchedVia = expanded?.matchedViaSynonym ? 'synonym' : 'direct';

      void this.searchRepo
        .logQuery({
          q: query.q,
          normalizedQ: normalizedQ ?? query.q,
          storeId: null,
          resultCount: total,
          matchedVia,
          canonicalTerm,
        })
        .catch((error) => {
          logger.warn('Failed to log search query', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    } else {
      const result = await this.repo.list({
        storeId: acrossStores ? undefined : storeId,
        acrossStores,
        categoryId,
        popular: query.popular,
        limit,
        offset,
      });
      rows = result.rows;
      total = result.total;
    }

    return {
      items: rows.map((row) => mapListItem(row, query.lang)),
      pagination: paginatedMeta(total, page, limit),
      searchMeta:
        query.q && normalizedQ
          ? {
              query: query.q,
              normalizedQuery: normalizedQ,
              matchedVia,
              canonicalTerm,
              rewrittenFor:
                matchedVia === 'synonym' && canonicalTerm && canonicalTerm !== normalizedQ
                  ? canonicalTerm
                  : null,
            }
          : undefined,
    };
  }

  async getByIdOrSlug(idOrSlug: string, query: GetProductQuery) {
    const product = await this.repo.findByIdOrSlug(idOrSlug);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const resolvedStoreId = await this.repo.resolveDefaultStoreId(query.storeId);
    if (!resolvedStoreId) {
      throw new ValidationError('No active store available');
    }

    const variants = await this.repo.listVariantsForStore(product.id, resolvedStoreId);
    const lang = query.lang;

    return {
      id: product.id,
      name: pickLocalizedRequired(lang, product.name, product.name_hi),
      slug: product.slug,
      description: pickLocalized(lang, product.description, product.description_hi),
      brand: product.brand,
      imageUrl: toPublicAssetUrl(product.image_url),
      subCategory: pickLocalized(lang, product.sub_category, product.sub_category_hi),
      category: {
        id: product.category_id,
        name: pickLocalizedRequired(lang, product.category_name, product.category_name_hi),
        slug: product.category_slug,
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

  async listSimilar(idOrSlug: string, query: SimilarProductsQuery) {
    const product = await this.repo.findByIdOrSlug(idOrSlug);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const storeId = await this.repo.resolveDefaultStoreId(query.storeId);
    if (!storeId) {
      throw new ValidationError('No active store available');
    }

    const limit = query.limit ?? 12;

    const overrides = await this.repo.listOverrideSimilar({
      productId: product.id,
      storeId,
      limit,
    });

    const remaining = limit - overrides.length;
    const auto =
      remaining > 0
        ? await this.repo.listAutoSimilar({
            productId: product.id,
            storeId,
            categoryId: product.category_id,
            parentCategoryId: product.category_parent_id,
            brand: product.brand,
            excludeIds: overrides.map((row) => row.id),
            limit: remaining,
          })
        : [];

    return {
      items: [...overrides, ...auto].map((row) => mapListItem(row, query.lang)),
      source: {
        hasManualOverrides: overrides.length > 0,
      },
    };
  }
}
