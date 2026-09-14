import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool, withTransaction } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import { ADMIN_COLLECTION_LIMIT } from './home-collections.eligibility.js';
import type { CreateHomeCollectionInput, PatchHomeCollectionInput } from './home-collections.schema.js';

export interface HomeCollectionRow extends RowDataPacket {
  id: string;
  headline: string;
  headline_hi: string | null;
  priority: number;
  is_active: number;
  start_at: Date;
  end_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type CollectionItemAvailability =
  | 'in_stock'
  | 'out_of_stock'
  | 'unavailable'
  | 'inactive'
  | 'deleted';

export interface HomeCollectionItemRow extends RowDataPacket {
  collection_id: string;
  product_id: string;
  sort_order: number;
  name: string | null;
  slug: string | null;
  image_url: string | null;
  product_deleted_at: Date | null;
  product_is_active: number | null;
  in_stock: number;
  listed: number;
}

const COLLECTION_COLUMNS = `
  id, headline, headline_hi, priority, is_active,
  start_at, end_at, created_at, updated_at, deleted_at
`;

export class HomeCollectionsRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async listAdmin(): Promise<HomeCollectionRow[]> {
    const [rows] = await this.db.query<HomeCollectionRow[]>(
      `SELECT ${COLLECTION_COLUMNS}
       FROM home_collections
       WHERE deleted_at IS NULL
       ORDER BY priority DESC, created_at DESC
       LIMIT ?`,
      [ADMIN_COLLECTION_LIMIT],
    );
    return rows;
  }

  async findActiveWinner(): Promise<HomeCollectionRow | null> {
    const [rows] = await this.db.query<HomeCollectionRow[]>(
      `SELECT ${COLLECTION_COLUMNS}
       FROM home_collections
       WHERE deleted_at IS NULL
         AND is_active = 1
         AND start_at <= UTC_TIMESTAMP()
         AND end_at > UTC_TIMESTAMP()
       ORDER BY priority DESC, created_at DESC
       LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<HomeCollectionRow | null> {
    const [rows] = await this.db.query<HomeCollectionRow[]>(
      `SELECT ${COLLECTION_COLUMNS}
       FROM home_collections
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async listProductIds(collectionId: string): Promise<string[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT product_id
       FROM home_collection_items
       WHERE collection_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
      [collectionId],
    );
    return rows.map((row) => row.product_id as string);
  }

  async listItemsForCollections(collectionIds: string[]): Promise<HomeCollectionItemRow[]> {
    if (collectionIds.length === 0) return [];
    const placeholders = collectionIds.map(() => '?').join(', ');
    const [rows] = await this.db.query<HomeCollectionItemRow[]>(
      `SELECT
          i.collection_id,
          i.product_id,
          i.sort_order,
          p.name,
          p.slug,
          p.image_url,
          p.deleted_at AS product_deleted_at,
          p.is_active AS product_is_active,
          MAX(
            CASE
              WHEN s.id IS NOT NULL
               AND sp.is_available = 1
               AND COALESCE(inv.quantity_available, 0) > 0
              THEN 1 ELSE 0
            END
          ) AS in_stock,
          MAX(
            CASE
              WHEN s.id IS NOT NULL AND sp.is_available = 1 THEN 1 ELSE 0
            END
          ) AS listed
       FROM home_collection_items i
       LEFT JOIN products p ON p.id = i.product_id
       LEFT JOIN store_products sp ON sp.product_id = p.id AND sp.is_available = 1
       LEFT JOIN stores s
         ON s.id = sp.store_id
        AND s.deleted_at IS NULL
        AND s.is_active = 1
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id
        AND pv.deleted_at IS NULL
        AND pv.is_active = 1
        AND pv.is_default = 1
       LEFT JOIN inventory inv
         ON inv.store_id = s.id
        AND inv.variant_id = pv.id
       WHERE i.collection_id IN (${placeholders})
       GROUP BY
         i.collection_id, i.product_id, i.sort_order, i.created_at,
         p.name, p.slug, p.image_url, p.deleted_at, p.is_active
       ORDER BY i.collection_id ASC, i.sort_order ASC, i.created_at ASC`,
      collectionIds,
    );
    return rows;
  }

  async findExistingProductIds(productIds: string[]): Promise<string[]> {
    if (productIds.length === 0) return [];
    const placeholders = productIds.map(() => '?').join(', ');
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id
       FROM products
       WHERE deleted_at IS NULL
         AND id IN (${placeholders})`,
      productIds,
    );
    return rows.map((row) => row.id as string);
  }

  async insert(input: CreateHomeCollectionInput): Promise<string> {
    const id = createId();
    await withTransaction(async (conn) => {
      await conn.query(
        `INSERT INTO home_collections (
           id, headline, headline_hi, priority, is_active, start_at, end_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.headline,
          input.headlineHi ?? null,
          input.priority,
          input.isActive ? 1 : 0,
          input.startAt,
          input.endAt,
        ],
      );
      await this.replaceItems(conn, id, input.productIds);
    });
    return id;
  }

  async update(id: string, input: PatchHomeCollectionInput): Promise<boolean> {
    return withTransaction(async (conn) => {
      const sets: string[] = [];
      const params: unknown[] = [];

      if (input.headline !== undefined) {
        sets.push('headline = ?');
        params.push(input.headline);
      }
      if (input.headlineHi !== undefined) {
        sets.push('headline_hi = ?');
        params.push(input.headlineHi);
      }
      if (input.priority !== undefined) {
        sets.push('priority = ?');
        params.push(input.priority);
      }
      if (input.isActive !== undefined) {
        sets.push('is_active = ?');
        params.push(input.isActive ? 1 : 0);
      }
      if (input.startAt !== undefined) {
        sets.push('start_at = ?');
        params.push(input.startAt);
      }
      if (input.endAt !== undefined) {
        sets.push('end_at = ?');
        params.push(input.endAt);
      }

      if (sets.length > 0) {
        params.push(id);
        const [result] = await conn.query(
          `UPDATE home_collections SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
          params,
        );
        if ((result as { affectedRows?: number }).affectedRows !== 1) return false;
      } else {
        const existing = await this.findById(id);
        if (!existing) return false;
      }

      if (input.productIds) {
        await this.replaceItems(conn, id, input.productIds);
      }
      return true;
    });
  }

  async softDelete(id: string): Promise<boolean> {
    const [result] = await this.db.query(
      `UPDATE home_collections
       SET deleted_at = UTC_TIMESTAMP(), is_active = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return (result as { affectedRows?: number }).affectedRows === 1;
  }

  private async replaceItems(
    conn: PoolConnection,
    collectionId: string,
    productIds: string[],
  ): Promise<void> {
    await conn.query(`DELETE FROM home_collection_items WHERE collection_id = ?`, [collectionId]);
    if (productIds.length === 0) return;

    const values: string[] = [];
    const params: unknown[] = [];
    for (const [index, productId] of productIds.entries()) {
      values.push('(?, ?, ?, ?)');
      params.push(createId(), collectionId, productId, index);
    }
    await conn.query(
      `INSERT INTO home_collection_items (id, collection_id, product_id, sort_order)
       VALUES ${values.join(', ')}`,
      params,
    );
  }
}
