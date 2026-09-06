import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

export interface ProductListRow {
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
}

export interface ProductDetailRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  image_url: string | null;
  category_id: string;
  category_name: string;
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

  async list(options: {
    storeId: string;
    categoryId?: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: ProductListRow[]; total: number }> {
    const where: string[] = [
      'p.deleted_at IS NULL',
      'p.is_active = 1',
      'sp.is_available = 1',
      'sp.store_id = ?',
    ];
    const params: unknown[] = [options.storeId];

    if (options.categoryId) {
      where.push('p.category_id = ?');
      params.push(options.categoryId);
    }

    if (options.q) {
      const sanitized = options.q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
      if (sanitized.length > 0) {
        where.push(
          '(MATCH(p.name, p.description, p.brand) AGAINST (? IN BOOLEAN MODE) OR p.name LIKE ? OR p.brand LIKE ?)',
        );
        const like = `%${sanitized}%`;
        params.push(`${sanitized}*`, like, like);
      }
    }

    const whereSql = where.join(' AND ');

    const [countRows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM products p
       INNER JOIN store_products sp ON sp.product_id = p.id
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const listParams = [...params, options.limit, options.offset];
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.slug,
          p.description,
          p.brand,
          p.image_url,
          p.category_id,
          c.name AS category_name,
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
       WHERE ${whereSql}
       ORDER BY p.name ASC
       LIMIT ? OFFSET ?`,
      listParams,
    );

    return { rows: rows as ProductListRow[], total };
  }

  async findByIdOrSlug(idOrSlug: string): Promise<ProductDetailRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          p.id,
          p.name,
          p.slug,
          p.description,
          p.brand,
          p.image_url,
          p.category_id,
          c.name AS category_name
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
}
