import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type {
  CreateCategoryInput,
  PatchCategoryInput,
  PatchProductInput,
} from './admin-catalog.schema.js';

export class AdminCatalogRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async createCategory(input: CreateCategoryInput & { slug: string }): Promise<string> {
    const id = createId();
    await this.db.execute(
      `INSERT INTO categories
         (id, parent_id, name, name_hi, slug, icon_key, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.parentId ?? null,
        input.name,
        input.nameHi ?? null,
        input.slug,
        input.iconKey ?? null,
        input.imageUrl ?? null,
        input.sortOrder ?? 0,
        input.isActive === false ? 0 : 1,
      ],
    );
    return id;
  }

  async findCategoryById(id: string): Promise<RowDataPacket | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, parent_id, name, name_hi, slug, icon_key, image_url, sort_order, is_active
       FROM categories WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateCategory(id: string, input: PatchCategoryInput): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      params.push(input.name);
    }
    if (input.nameHi !== undefined) {
      sets.push('name_hi = ?');
      params.push(input.nameHi);
    }
    if (input.iconKey !== undefined) {
      sets.push('icon_key = ?');
      params.push(input.iconKey);
    }
    if (input.imageUrl !== undefined) {
      sets.push('image_url = ?');
      params.push(input.imageUrl);
    }
    if (input.sortOrder !== undefined) {
      sets.push('sort_order = ?');
      params.push(input.sortOrder);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (sets.length === 0) return false;

    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE categories SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }

  async findProductById(id: string): Promise<RowDataPacket | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT p.id, p.category_id, p.name, p.name_hi, p.slug, p.description, p.description_hi,
              p.brand, p.sub_category, p.sub_category_hi, p.image_url, p.is_active,
              pv.id AS variant_id, pv.unit_label, pv.price_paise, pv.mrp_paise,
              sp.store_id, sp.is_available,
              COALESCE(inv.quantity_available, 0) AS quantity_available
       FROM products p
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id AND pv.is_default = 1 AND pv.deleted_at IS NULL
       LEFT JOIN store_products sp ON sp.product_id = p.id
       LEFT JOIN inventory inv ON inv.store_id = sp.store_id AND inv.variant_id = pv.id
       WHERE p.id = ? AND p.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateProduct(id: string, input: PatchProductInput): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.name !== undefined) {
      sets.push('name = ?');
      params.push(input.name);
    }
    if (input.nameHi !== undefined) {
      sets.push('name_hi = ?');
      params.push(input.nameHi);
    }
    if (input.description !== undefined) {
      sets.push('description = ?');
      params.push(input.description);
    }
    if (input.descriptionHi !== undefined) {
      sets.push('description_hi = ?');
      params.push(input.descriptionHi);
    }
    if (input.brand !== undefined) {
      sets.push('brand = ?');
      params.push(input.brand);
    }
    if (input.subCategory !== undefined) {
      sets.push('sub_category = ?');
      params.push(input.subCategory);
    }
    if (input.subCategoryHi !== undefined) {
      sets.push('sub_category_hi = ?');
      params.push(input.subCategoryHi);
    }
    if (input.imageUrl !== undefined) {
      sets.push('image_url = ?');
      params.push(input.imageUrl);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (sets.length === 0) return false;

    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE products SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }
}
