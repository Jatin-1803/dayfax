import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export interface CartRow {
  id: string;
  user_id: string;
  store_id: string;
  service_area_id: string;
  status: 'ACTIVE' | 'CHECKED_OUT' | 'ABANDONED';
}

export interface CartItemRow {
  id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  unit_price_paise: number;
  product_id: string;
  product_name: string;
  product_slug: string;
  product_image_url: string | null;
  unit_label: string;
  mrp_paise: number;
  current_price_paise: number;
  quantity_available: number | null;
}

export interface SellableVariant {
  variant_id: string;
  product_id: string;
  store_id: string;
  service_area_id: string;
  price_paise: number;
  mrp_paise: number;
  quantity_available: number;
  is_available: number;
  product_active: number;
  variant_active: number;
}

export class CartRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async findActiveCart(
    userId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<CartRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, store_id, service_area_id, status
       FROM carts
       WHERE user_id = ? AND status = 'ACTIVE'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return (rows[0] as CartRow) ?? null;
  }

  async createCart(
    input: { userId: string; storeId: string; serviceAreaId: string },
    conn: Pool | PoolConnection = this.db,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO carts (id, user_id, store_id, service_area_id, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [id, input.userId, input.storeId, input.serviceAreaId],
    );
    return id;
  }

  async abandonCart(cartId: string, conn: Pool | PoolConnection = this.db): Promise<void> {
    await conn.query(`UPDATE carts SET status = 'ABANDONED' WHERE id = ? AND status = 'ACTIVE'`, [
      cartId,
    ]);
  }

  async touchCart(cartId: string, conn: Pool | PoolConnection = this.db): Promise<void> {
    await conn.query(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [cartId]);
  }

  async listItems(cartId: string, conn: Pool | PoolConnection = this.db): Promise<CartItemRow[]> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT
          ci.id,
          ci.cart_id,
          ci.variant_id,
          ci.quantity,
          ci.unit_price_paise,
          p.id AS product_id,
          p.name AS product_name,
          p.slug AS product_slug,
          p.image_url AS product_image_url,
          pv.unit_label,
          pv.mrp_paise,
          pv.price_paise AS current_price_paise,
          inv.quantity_available
       FROM cart_items ci
       INNER JOIN product_variants pv ON pv.id = ci.variant_id
       INNER JOIN products p ON p.id = pv.product_id
       INNER JOIN carts c ON c.id = ci.cart_id
       LEFT JOIN inventory inv
         ON inv.variant_id = ci.variant_id
        AND inv.store_id = c.store_id
       WHERE ci.cart_id = ?
       ORDER BY ci.created_at ASC`,
      [cartId],
    );
    return rows as CartItemRow[];
  }

  async findItem(cartId: string, itemId: string): Promise<{ id: string; variant_id: string; quantity: number } | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, variant_id, quantity FROM cart_items WHERE id = ? AND cart_id = ? LIMIT 1`,
      [itemId, cartId],
    );
    return (rows[0] as { id: string; variant_id: string; quantity: number }) ?? null;
  }

  async findItemByVariant(
    cartId: string,
    variantId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{ id: string; quantity: number } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ? LIMIT 1`,
      [cartId, variantId],
    );
    return (rows[0] as { id: string; quantity: number }) ?? null;
  }

  async insertItem(
    input: {
      cartId: string;
      variantId: string;
      quantity: number;
      unitPricePaise: number;
    },
    conn: Pool | PoolConnection = this.db,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO cart_items (id, cart_id, variant_id, quantity, unit_price_paise)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.cartId, input.variantId, input.quantity, input.unitPricePaise],
    );
    return id;
  }

  async updateItem(
    itemId: string,
    fields: { quantity?: number; unitPricePaise?: number },
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.quantity !== undefined) {
      sets.push('quantity = ?');
      values.push(fields.quantity);
    }
    if (fields.unitPricePaise !== undefined) {
      sets.push('unit_price_paise = ?');
      values.push(fields.unitPricePaise);
    }
    if (sets.length === 0) return;
    await conn.query(`UPDATE cart_items SET ${sets.join(', ')} WHERE id = ?`, [
      ...values,
      itemId,
    ]);
  }

  async deleteItem(itemId: string, cartId: string, conn: Pool | PoolConnection = this.db): Promise<boolean> {
    const [result] = await conn.query<ResultSetHeader>(
      `DELETE FROM cart_items WHERE id = ? AND cart_id = ?`,
      [itemId, cartId],
    );
    return result.affectedRows > 0;
  }

  async deleteAllItems(cartId: string, conn: Pool | PoolConnection = this.db): Promise<void> {
    await conn.query(`DELETE FROM cart_items WHERE cart_id = ?`, [cartId]);
  }

  async resolveSellableVariant(options: {
    variantId: string;
    storeId?: string;
  }): Promise<SellableVariant | null> {
    const params: unknown[] = [options.variantId];
    let storeClause = '';
    if (options.storeId) {
      storeClause = 'AND s.id = ?';
      params.push(options.storeId);
    }

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          pv.id AS variant_id,
          p.id AS product_id,
          s.id AS store_id,
          s.service_area_id,
          pv.price_paise,
          pv.mrp_paise,
          COALESCE(inv.quantity_available, 0) AS quantity_available,
          sp.is_available,
          p.is_active AS product_active,
          pv.is_active AS variant_active
       FROM product_variants pv
       INNER JOIN products p ON p.id = pv.product_id
       INNER JOIN store_products sp ON sp.product_id = p.id
       INNER JOIN stores s ON s.id = sp.store_id
       LEFT JOIN inventory inv
         ON inv.store_id = s.id
        AND inv.variant_id = pv.id
       WHERE pv.id = ?
         AND pv.deleted_at IS NULL
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND s.is_active = 1
         ${storeClause}
       ORDER BY sp.is_available DESC, s.created_at ASC
       LIMIT 1`,
      params,
    );
    return (rows[0] as SellableVariant) ?? null;
  }
}
