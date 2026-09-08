import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import type { CreateStoreInput, PatchStoreInput } from './admin-stores.schema.js';

type Db = Pool | PoolConnection;

export class AdminStoresRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async resolveDefaultServiceAreaId(): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM service_areas WHERE deleted_at IS NULL AND is_active = 1
       ORDER BY created_at ASC LIMIT 1`,
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async insertStore(input: CreateStoreInput & { slug: string; serviceAreaId: string }): Promise<string> {
    const id = createId();
    await this.db.query(
      `INSERT INTO stores (
         id, service_area_id, name, slug, store_type, image_url, description,
         phone_country_code, phone, address_line1, address_line2, landmark,
         city, pincode, latitude, longitude, is_popular, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.serviceAreaId,
        input.name,
        input.slug,
        input.storeType,
        input.imageUrl ?? null,
        input.description ?? null,
        input.phoneCountryCode ?? '+91',
        input.phone ?? null,
        input.addressLine1 ?? null,
        input.addressLine2 ?? null,
        input.landmark ?? null,
        input.city ?? null,
        input.pincode ?? null,
        input.latitude ?? null,
        input.longitude ?? null,
        input.isPopular ? 1 : 0,
        input.isActive ? 1 : 0,
      ],
    );
    return id;
  }

  async updateStore(id: string, input: PatchStoreInput): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];

    const map: Array<[keyof PatchStoreInput, string, (v: unknown) => unknown]> = [
      ['name', 'name', (v) => v],
      ['storeType', 'store_type', (v) => v],
      ['imageUrl', 'image_url', (v) => v],
      ['description', 'description', (v) => v],
      ['phoneCountryCode', 'phone_country_code', (v) => v],
      ['phone', 'phone', (v) => v],
      ['addressLine1', 'address_line1', (v) => v],
      ['addressLine2', 'address_line2', (v) => v],
      ['landmark', 'landmark', (v) => v],
      ['city', 'city', (v) => v],
      ['pincode', 'pincode', (v) => v],
      ['latitude', 'latitude', (v) => v],
      ['longitude', 'longitude', (v) => v],
      ['isPopular', 'is_popular', (v) => (v ? 1 : 0)],
      ['isActive', 'is_active', (v) => (v ? 1 : 0)],
    ];

    for (const [key, column, transform] of map) {
      if (input[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(transform(input[key]));
      }
    }

    if (sets.length === 0) return false;

    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE stores SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [...params, id],
    );
    return result.affectedRows > 0;
  }

  async setStoreProductAvailability(
    storeId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE store_products SET is_available = ?
       WHERE store_id = ? AND product_id = ?`,
      [isAvailable ? 1 : 0, storeId, productId],
    );
    return result.affectedRows > 0;
  }

  async findCategoryIdBySlug(slug: string): Promise<string | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
    return (rows[0]?.id as string | undefined) ?? null;
  }

  async createProductForStore(
    input: {
      storeId: string;
      categoryId: string;
      name: string;
      nameHi?: string | null;
      slug: string;
      description: string | null;
      descriptionHi?: string | null;
      brand: string | null;
      imageUrl: string | null;
      unitLabel: string;
      pricePaise: number;
      mrpPaise: number;
      quantityAvailable: number;
      isAvailable: boolean;
      sku: string;
    },
    conn: Db = this.db,
  ): Promise<{ productId: string; variantId: string }> {
    const productId = createId();
    const variantId = createId();

    await conn.query(
      `INSERT INTO products
         (id, category_id, name, name_hi, slug, description, description_hi, brand, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        productId,
        input.categoryId,
        input.name,
        input.nameHi ?? null,
        input.slug,
        input.description,
        input.descriptionHi ?? null,
        input.brand,
        input.imageUrl,
      ],
    );

    await conn.query(
      `INSERT INTO product_variants (
         id, product_id, sku, unit_label, unit_value, unit_type,
         mrp_paise, price_paise, is_default, is_active
       ) VALUES (?, ?, ?, ?, 1, 'pc', ?, ?, 1, 1)`,
      [variantId, productId, input.sku, input.unitLabel, input.mrpPaise, input.pricePaise],
    );

    await conn.query(
      `INSERT INTO store_products (id, store_id, product_id, is_available)
       VALUES (?, ?, ?, ?)`,
      [createId(), input.storeId, productId, input.isAvailable ? 1 : 0],
    );

    await conn.query(
      `INSERT INTO inventory (id, store_id, variant_id, quantity_available, quantity_reserved)
       VALUES (?, ?, ?, ?, 0)`,
      [createId(), input.storeId, variantId, input.quantityAvailable],
    );

    return { productId, variantId };
  }

  async slugExists(slug: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM products WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
    return Boolean(rows[0]);
  }

  async storeSlugExists(slug: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM stores WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
    return Boolean(rows[0]);
  }

  async listStoreProducts(storeId: string): Promise<RowDataPacket[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.name_hi, p.slug, p.description, p.description_hi, p.brand,
              p.image_url, p.is_active, p.category_id, sp.is_available,
              pv.id AS variant_id, pv.price_paise, pv.mrp_paise, pv.unit_label,
              COALESCE(inv.quantity_available, 0) AS quantity_available
       FROM store_products sp
       INNER JOIN products p ON p.id = sp.product_id AND p.deleted_at IS NULL
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id AND pv.is_default = 1 AND pv.deleted_at IS NULL
       LEFT JOIN inventory inv ON inv.store_id = sp.store_id AND inv.variant_id = pv.id
       WHERE sp.store_id = ?
       ORDER BY p.name ASC`,
      [storeId],
    );
    return rows;
  }

  async findStoreProduct(
    storeId: string,
    productId: string,
  ): Promise<RowDataPacket | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT p.id, p.name, p.name_hi, p.slug, p.description, p.description_hi, p.brand,
              p.image_url, p.is_active, p.category_id, sp.is_available,
              pv.id AS variant_id, pv.price_paise, pv.mrp_paise, pv.unit_label,
              COALESCE(inv.quantity_available, 0) AS quantity_available
       FROM store_products sp
       INNER JOIN products p ON p.id = sp.product_id AND p.deleted_at IS NULL
       LEFT JOIN product_variants pv
         ON pv.product_id = p.id AND pv.is_default = 1 AND pv.deleted_at IS NULL
       LEFT JOIN inventory inv ON inv.store_id = sp.store_id AND inv.variant_id = pv.id
       WHERE sp.store_id = ? AND sp.product_id = ?
       LIMIT 1`,
      [storeId, productId],
    );
    return rows[0] ?? null;
  }

  async updateStoreProductDetails(
    storeId: string,
    productId: string,
    input: {
      isAvailable?: boolean;
      pricePaise?: number;
      mrpPaise?: number;
      quantityAvailable?: number;
      unitLabel?: string;
      name?: string;
      nameHi?: string | null;
      description?: string | null;
      descriptionHi?: string | null;
      brand?: string | null;
      imageUrl?: string | null;
    },
    conn: Db = this.db,
  ): Promise<boolean> {
    const existing = await this.findStoreProduct(storeId, productId);
    if (!existing) return false;

    const productSets: string[] = [];
    const productParams: unknown[] = [];
    if (input.name !== undefined) {
      productSets.push('name = ?');
      productParams.push(input.name);
    }
    if (input.nameHi !== undefined) {
      productSets.push('name_hi = ?');
      productParams.push(input.nameHi);
    }
    if (input.description !== undefined) {
      productSets.push('description = ?');
      productParams.push(input.description);
    }
    if (input.descriptionHi !== undefined) {
      productSets.push('description_hi = ?');
      productParams.push(input.descriptionHi);
    }
    if (input.brand !== undefined) {
      productSets.push('brand = ?');
      productParams.push(input.brand);
    }
    if (input.imageUrl !== undefined) {
      productSets.push('image_url = ?');
      productParams.push(input.imageUrl);
    }
    if (productSets.length > 0) {
      await conn.query(
        `UPDATE products SET ${productSets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        [...productParams, productId],
      );
    }

    const variantId = existing.variant_id as string | null;
    if (variantId) {
      const variantSets: string[] = [];
      const variantParams: unknown[] = [];
      if (input.pricePaise !== undefined) {
        variantSets.push('price_paise = ?');
        variantParams.push(input.pricePaise);
      }
      if (input.mrpPaise !== undefined) {
        variantSets.push('mrp_paise = ?');
        variantParams.push(input.mrpPaise);
      }
      if (input.unitLabel !== undefined) {
        variantSets.push('unit_label = ?');
        variantParams.push(input.unitLabel);
      }
      if (variantSets.length > 0) {
        await conn.query(
          `UPDATE product_variants SET ${variantSets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
          [...variantParams, variantId],
        );
      }

      if (input.quantityAvailable !== undefined) {
        const [inv] = await conn.query<RowDataPacket[]>(
          `SELECT id FROM inventory WHERE store_id = ? AND variant_id = ? LIMIT 1`,
          [storeId, variantId],
        );
        if (inv[0]) {
          await conn.query(
            `UPDATE inventory SET quantity_available = ? WHERE store_id = ? AND variant_id = ?`,
            [input.quantityAvailable, storeId, variantId],
          );
        } else {
          await conn.query(
            `INSERT INTO inventory (id, store_id, variant_id, quantity_available, quantity_reserved)
             VALUES (?, ?, ?, ?, 0)`,
            [createId(), storeId, variantId, input.quantityAvailable],
          );
        }
      }
    }

    if (input.isAvailable !== undefined) {
      await conn.query(
        `UPDATE store_products SET is_available = ? WHERE store_id = ? AND product_id = ?`,
        [input.isAvailable ? 1 : 0, storeId, productId],
      );
    }

    return true;
  }
}
