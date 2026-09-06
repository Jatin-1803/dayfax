import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

export interface CategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon_key: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: number;
}

export class CategoriesRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async list(options: { parentId?: string; includeInactive?: boolean }): Promise<CategoryRow[]> {
    const clauses: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (!options.includeInactive) {
      clauses.push('is_active = 1');
    }

    if (options.parentId) {
      clauses.push('parent_id = ?');
      params.push(options.parentId);
    } else {
      clauses.push('parent_id IS NULL');
    }

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, parent_id, name, slug, icon_key, image_url, sort_order, is_active
       FROM categories
       WHERE ${clauses.join(' AND ')}
       ORDER BY sort_order ASC, name ASC`,
      params,
    );

    return rows as CategoryRow[];
  }

  async findByIdOrSlug(idOrSlug: string): Promise<CategoryRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, parent_id, name, slug, icon_key, image_url, sort_order, is_active
       FROM categories
       WHERE deleted_at IS NULL
         AND (id = ? OR slug = ?)
       LIMIT 1`,
      [idOrSlug, idOrSlug],
    );
    return (rows[0] as CategoryRow) ?? null;
  }
}
