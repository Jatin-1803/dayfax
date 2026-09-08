import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

export interface ProductListRow {
  id: string;
  name: string;
  name_hi: string | null;
  slug: string;
  description: string | null;
  description_hi: string | null;
  brand: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  category_name_hi: string | null;
  store_id: string;
  store_name: string;
  default_variant_id: string | null;
  unit_label: string | null;
  price_paise: number | null;
  mrp_paise: number | null;
  quantity_available: number | null;
}

export interface ProductDetailRow {
  id: string;
  name: string;
  name_hi: string | null;
  slug: string;
  description: string | null;
  description_hi: string | null;
  brand: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
  category_name_hi: string | null;
  category_slug: string;
  category_parent_id: string | null;
  sub_category: string | null;
  sub_category_hi: string | null;
}

export interface VariantRow {
  id: string;
  product_id: string;
  sku: string;
  unit_label: string;
  unit_value: number | null;
  unit_type: string | null;
  mrp_paise: number;
  price_paise: number;
  is_default: number;
  quantity_available: number | null;
}

export class ProductsRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async resolveDefaultStoreId(storeId?: string): Promise<string | null> {
    if (storeId) return storeId;
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM stores
       WHERE deleted_at IS NULL AND is_active = 1
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async resolveCategoryId(options: {
    categoryId?: string;
    categorySlug?: string;
  }): Promise<string | undefined> {
    if (options.categoryId) return options.categoryId;
    if (!options.categorySlug) return undefined;
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM categories
       WHERE deleted_at IS NULL AND is_active = 1 AND slug = ?
       LIMIT 1`,
      [options.categorySlug],
    );
    return rows[0]?.id as string | undefined;
  }

  /** Parent plus direct child categories, so parent rails include imported products. */
  async expandCategoryIds(categoryId: string): Promise<string[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM categories
       WHERE deleted_at IS NULL
         AND is_active = 1
         AND parent_id = ?`,
      [categoryId],
    );
    return [categoryId, ...rows.map((row) => row.id as string)];
  }

  async list(options: {
    storeId?: string;
    /** When true and storeId omitted, search across all active stores. */
    acrossStores?: boolean;
    categoryId?: string;
    q?: string;
    /** Pre-expanded synonym terms (normalized). When set, used instead of raw `q` alone. */
    searchTerms?: string[];
    popular?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ rows: ProductListRow[]; total: number }> {
    const where: string[] = [
      'p.deleted_at IS NULL',
      'p.is_active = 1',
      'sp.is_available = 1',
      's.deleted_at IS NULL',
      's.is_active = 1',
    ];
    const params: unknown[] = [];

    if (options.storeId) {
      where.push('sp.store_id = ?');
      params.push(options.storeId);
    }

    if (options.categoryId) {
      const categoryIds = await this.expandCategoryIds(options.categoryId);
      const placeholders = categoryIds.map(() => '?').join(', ');
      where.push(`p.category_id IN (${placeholders})`);
      params.push(...categoryIds);
    }

    const terms =
      options.searchTerms?.filter((t) => t.length > 0) ??
      (options.q
        ? [options.q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim()].filter((t) => t.length > 0)
        : []);

    if (terms.length > 0) {
      const termClauses: string[] = [];
      for (const term of terms) {
        termClauses.push(
          `(MATCH(p.name, p.name_hi, p.description, p.description_hi, p.brand) AGAINST (? IN BOOLEAN MODE)
            OR p.name LIKE ?
            OR p.name_hi LIKE ?
            OR p.brand LIKE ?
            OR EXISTS (
              SELECT 1 FROM product_search_aliases psa
              WHERE psa.product_id = p.id
                AND (psa.alias = ? OR psa.alias LIKE ?)
            ))`,
        );
        const like = `%${term}%`;
        params.push(`${term}*`, like, like, like, term, like);
      }
      where.push(`(${termClauses.join(' OR ')})`);
    }

    const whereSql = where.join(' AND ');
    // Across stores: count store-product rows; single store: distinct products.
    const countExpr = options.acrossStores
      ? 'COUNT(*)'
      : 'COUNT(DISTINCT p.id)';

    const [countRows] = await this.db.query<RowDataPacket[]>(
      `SELECT ${countExpr} AS total
       FROM products p
       INNER JOIN store_products sp ON sp.product_id = p.id
       INNER JOIN stores s ON s.id = sp.store_id
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const orderBy = options.popular
      ? 'COALESCE(sales.sold_qty, 0) DESC, p.created_at DESC'
      : 'p.name ASC';

    const salesJoin = options.popular
      ? `LEFT JOIN (
           SELECT oi.product_id, SUM(oi.quantity) AS sold_qty
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE o.status NOT IN ('CANCELLED')
           GROUP BY oi.product_id
         ) sales ON sales.product_id = p.id`
      : '';

    const listParams = [...params, options.limit, options.offset];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.name_hi,
          p.slug,
          p.description,
          p.description_hi,
          p.brand,
          p.image_url,
          p.category_id,
          c.name AS category_name,
          c.name_hi AS category_name_hi,
          s.id AS store_id,
          s.name AS store_name,
          pv.id AS default_variant_id,
          pv.unit_label,
          pv.price_paise,
          pv.mrp_paise,
          inv.quantity_available
       FROM products p
       INNER JOIN store_products sp ON sp.product_id = p.id
       INNER JOIN stores s ON s.id = sp.store_id
       INNER JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id
        AND pv.deleted_at IS NULL
        AND pv.is_active = 1
        AND pv.is_default = 1
       LEFT JOIN inventory inv
         ON inv.store_id = sp.store_id
        AND inv.variant_id = pv.id
       ${salesJoin}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      listParams,
    );

    return { rows: rows as ProductListRow[], total };
  }

  /**
   * Hydrate store-scoped list rows for a fixed set of product IDs, preserving input order.
   */
  async listByIdsForStore(storeId: string, productIds: string[]): Promise<ProductListRow[]> {
    if (productIds.length === 0) return [];

    const placeholders = productIds.map(() => '?').join(', ');
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.name_hi,
          p.slug,
          p.description,
          p.description_hi,
          p.brand,
          p.image_url,
          p.category_id,
          c.name AS category_name,
          c.name_hi AS category_name_hi,
          s.id AS store_id,
          s.name AS store_name,
          pv.id AS default_variant_id,
          pv.unit_label,
          pv.price_paise,
          pv.mrp_paise,
          inv.quantity_available
       FROM products p
       INNER JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ?
       INNER JOIN stores s ON s.id = sp.store_id
       INNER JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id
        AND pv.deleted_at IS NULL
        AND pv.is_active = 1
        AND pv.is_default = 1
       LEFT JOIN inventory inv
         ON inv.store_id = sp.store_id
        AND inv.variant_id = pv.id
       WHERE p.deleted_at IS NULL
         AND p.is_active = 1
         AND sp.is_available = 1
         AND p.id IN (${placeholders})`,
      [storeId, ...productIds],
    );

    const byId = new Map((rows as ProductListRow[]).map((row) => [row.id, row]));
    return productIds
      .map((id) => byId.get(id))
      .filter((row): row is ProductListRow => Boolean(row));
  }

  async listIndexDocuments(options?: { productId?: string }): Promise<
    Array<{
      id: string;
      name: string;
      nameHi: string | null;
      brand: string | null;
      description: string | null;
      descriptionHi: string | null;
      categoryId: string;
      categoryName: string;
      isActive: boolean;
      storeIds: string[];
      aliases: string[];
    }>
  > {
    const params: unknown[] = [];
    let productFilter = '';
    if (options?.productId) {
      productFilter = 'AND p.id = ?';
      params.push(options.productId);
    }

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.name_hi AS nameHi,
          p.brand,
          p.description,
          p.description_hi AS descriptionHi,
          p.category_id AS categoryId,
          c.name AS categoryName,
          p.is_active AS isActive,
          (
            SELECT COALESCE(JSON_ARRAYAGG(sp.store_id), JSON_ARRAY())
            FROM store_products sp
            WHERE sp.product_id = p.id AND sp.is_available = 1
          ) AS storeIdsJson,
          (
            SELECT COALESCE(JSON_ARRAYAGG(psa.alias), JSON_ARRAY())
            FROM product_search_aliases psa
            WHERE psa.product_id = p.id
          ) AS aliasesJson
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE p.deleted_at IS NULL
         ${productFilter}
       ORDER BY p.name ASC`,
      params,
    );

    return (
      rows as Array<{
        id: string;
        name: string;
        nameHi: string | null;
        brand: string | null;
        description: string | null;
        descriptionHi: string | null;
        categoryId: string;
        categoryName: string;
        isActive: number;
        storeIdsJson: unknown;
        aliasesJson: unknown;
      }>
    ).map((row) => ({
      id: row.id,
      name: row.name,
      nameHi: row.nameHi,
      brand: row.brand,
      description: row.description,
      descriptionHi: row.descriptionHi,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      isActive: Boolean(row.isActive),
      storeIds: parseJsonStringArray(row.storeIdsJson),
      aliases: parseJsonStringArray(row.aliasesJson),
    }));
  }

  async findByIdOrSlug(idOrSlug: string): Promise<ProductDetailRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.name_hi,
          p.slug,
          p.description,
          p.description_hi,
          p.brand,
          p.image_url,
          p.category_id,
          p.sub_category,
          p.sub_category_hi,
          c.name AS category_name,
          c.name_hi AS category_name_hi,
          c.slug AS category_slug,
          c.parent_id AS category_parent_id
       FROM products p
       INNER JOIN categories c ON c.id = p.category_id
       WHERE p.deleted_at IS NULL
         AND p.is_active = 1
         AND (p.id = ? OR p.slug = ?)
       LIMIT 1`,
      [idOrSlug, idOrSlug],
    );
    return (rows[0] as ProductDetailRow) ?? null;
  }

  async listVariantsForStore(productId: string, storeId: string): Promise<VariantRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          pv.id,
          pv.product_id,
          pv.sku,
          pv.unit_label,
          pv.unit_value,
          pv.unit_type,
          pv.mrp_paise,
          pv.price_paise,
          pv.is_default,
          inv.quantity_available
       FROM product_variants pv
       LEFT JOIN inventory inv
         ON inv.variant_id = pv.id
        AND inv.store_id = ?
       WHERE pv.product_id = ?
         AND pv.deleted_at IS NULL
         AND pv.is_active = 1
       ORDER BY pv.is_default DESC, pv.price_paise ASC`,
      [storeId, productId],
    );
    return rows as VariantRow[];
  }

  /**
   * Admin-pinned similar products (sort_order ASC). Empty when none configured.
   */
  async listOverrideSimilar(options: {
    productId: string;
    storeId: string;
    limit: number;
  }): Promise<ProductListRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.name_hi,
          p.slug,
          p.description,
          p.description_hi,
          p.brand,
          p.image_url,
          p.category_id,
          c.name AS category_name,
          c.name_hi AS category_name_hi,
          s.id AS store_id,
          s.name AS store_name,
          pv.id AS default_variant_id,
          pv.unit_label,
          pv.price_paise,
          pv.mrp_paise,
          inv.quantity_available
       FROM product_similar_overrides o
       INNER JOIN products p ON p.id = o.similar_product_id
       INNER JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ?
       INNER JOIN stores s ON s.id = sp.store_id
       INNER JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id
        AND pv.deleted_at IS NULL
        AND pv.is_active = 1
        AND pv.is_default = 1
       LEFT JOIN inventory inv
         ON inv.store_id = sp.store_id
        AND inv.variant_id = pv.id
       WHERE o.product_id = ?
         AND o.is_active = 1
         AND p.deleted_at IS NULL
         AND p.is_active = 1
         AND sp.is_available = 1
       ORDER BY o.sort_order ASC, p.name ASC
       LIMIT ?`,
      [options.storeId, options.productId, options.limit],
    );
    return rows as ProductListRow[];
  }

  /**
   * Blinkit/Zepto-style auto similarity:
   * same category (brand boost) → sibling categories under same parent → in-stock first.
   */
  async listAutoSimilar(options: {
    productId: string;
    storeId: string;
    categoryId: string;
    parentCategoryId: string | null;
    brand: string | null;
    excludeIds: string[];
    limit: number;
  }): Promise<ProductListRow[]> {
    if (options.limit <= 0) return [];

    const excludeIds = [...new Set([options.productId, ...options.excludeIds])];
    const excludePlaceholders = excludeIds.map(() => '?').join(', ');

    const categoryIds = [options.categoryId];
    if (options.parentCategoryId) {
      const [siblingRows] = await this.db.query<RowDataPacket[]>(
        `SELECT id FROM categories
         WHERE deleted_at IS NULL
           AND is_active = 1
           AND parent_id = ?
           AND id <> ?`,
        [options.parentCategoryId, options.categoryId],
      );
      for (const row of siblingRows) {
        categoryIds.push(row.id as string);
      }
    }

    const categoryPlaceholders = categoryIds.map(() => '?').join(', ');
    const brand = options.brand?.trim() || null;

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.name_hi,
          p.slug,
          p.description,
          p.description_hi,
          p.brand,
          p.image_url,
          p.category_id,
          c.name AS category_name,
          c.name_hi AS category_name_hi,
          s.id AS store_id,
          s.name AS store_name,
          pv.id AS default_variant_id,
          pv.unit_label,
          pv.price_paise,
          pv.mrp_paise,
          inv.quantity_available
       FROM products p
       INNER JOIN store_products sp ON sp.product_id = p.id AND sp.store_id = ?
       INNER JOIN stores s ON s.id = sp.store_id
       INNER JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id
        AND pv.deleted_at IS NULL
        AND pv.is_active = 1
        AND pv.is_default = 1
       LEFT JOIN inventory inv
         ON inv.store_id = sp.store_id
        AND inv.variant_id = pv.id
       WHERE p.deleted_at IS NULL
         AND p.is_active = 1
         AND sp.is_available = 1
         AND p.category_id IN (${categoryPlaceholders})
         AND p.id NOT IN (${excludePlaceholders})
       ORDER BY
         CASE WHEN p.category_id = ? THEN 0 ELSE 1 END ASC,
         CASE
           WHEN ? IS NOT NULL AND p.brand IS NOT NULL AND LOWER(p.brand) = LOWER(?) THEN 0
           ELSE 1
         END ASC,
         CASE WHEN COALESCE(inv.quantity_available, 0) > 0 THEN 0 ELSE 1 END ASC,
         p.name ASC
       LIMIT ?`,
      [
        options.storeId,
        ...categoryIds,
        ...excludeIds,
        options.categoryId,
        brand,
        brand,
        options.limit,
      ],
    );

    return rows as ProductListRow[];
  }
}
