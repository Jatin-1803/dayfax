import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { getPool, closePool } from './pool.js';
import { createId } from '../utils/id.js';

loadEnv();

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function seed(): Promise<void> {
  const pool = getPool();

  const roleCustomer = createId();
  const rolePartner = createId();
  const roleAdmin = createId();
  const locationId = createId();
  const serviceAreaId = createId();
  const zoneId = createId();
  const storeId = createId();

  const foodCat = createId();
  const groceryCat = createId();
  const vegCat = createId();

  const milkProduct = createId();
  const tomatoProduct = createId();
  const milk500 = createId();
  const milk1l = createId();
  const tomato500 = createId();
  const tomato1kg = createId();

  await pool.query(
    `INSERT IGNORE INTO roles (id, code, name) VALUES
      (?, 'CUSTOMER', 'Customer'),
      (?, 'DELIVERY_PARTNER', 'Delivery Partner'),
      (?, 'ADMIN', 'Admin')`,
    [roleCustomer, rolePartner, roleAdmin],
  );

  // Re-read roles in case IGNORE skipped inserts
  const [roles] = await pool.query<
    Array<{ id: string; code: string }> & import('mysql2').RowDataPacket[]
  >('SELECT id, code FROM roles');

  const roleMap = Object.fromEntries(roles.map((r) => [r.code, r.id]));

  await pool.query(
    `INSERT INTO locations (id, name, state, country_code)
     SELECT ?, 'Launch Town', 'Uttar Pradesh', 'IN'
     WHERE NOT EXISTS (SELECT 1 FROM locations LIMIT 1)`,
    [locationId],
  );

  const [locations] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >('SELECT id FROM locations WHERE deleted_at IS NULL LIMIT 1');
  const resolvedLocationId = locations[0]?.id ?? locationId;

  await pool.query(
    `INSERT INTO service_areas (id, location_id, name, slug, is_active)
     SELECT ?, ?, 'Primary Service Area', 'primary-service-area', 1
     WHERE NOT EXISTS (SELECT 1 FROM service_areas LIMIT 1)`,
    [serviceAreaId, resolvedLocationId],
  );

  const [areas] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >('SELECT id FROM service_areas WHERE deleted_at IS NULL LIMIT 1');
  const resolvedAreaId = areas[0]?.id ?? serviceAreaId;

  await pool.query(
    `INSERT INTO delivery_zones (id, service_area_id, name, delivery_fee_paise, min_order_paise, eta_minutes, is_active)
     SELECT ?, ?, 'Zone A', 2500, 0, 30, 1
     WHERE NOT EXISTS (SELECT 1 FROM delivery_zones LIMIT 1)`,
    [zoneId, resolvedAreaId],
  );

  await pool.query(
    `INSERT INTO stores (id, service_area_id, name, slug, store_type, is_active)
     SELECT ?, ?, 'Dailyfax Mart', 'dailyfax-mart', 'MIXED', 1
     WHERE NOT EXISTS (SELECT 1 FROM stores LIMIT 1)`,
    [storeId, resolvedAreaId],
  );

  const [stores] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >('SELECT id FROM stores WHERE deleted_at IS NULL LIMIT 1');
  const resolvedStoreId = stores[0]?.id ?? storeId;

  await pool.query(
    `INSERT INTO categories (id, parent_id, name, slug, icon_key, sort_order, is_active)
     SELECT ?, NULL, 'Food', 'food', 'restaurant', 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'food')`,
    [foodCat],
  );
  await pool.query(
    `INSERT INTO categories (id, parent_id, name, slug, icon_key, sort_order, is_active)
     SELECT ?, NULL, 'Grocery', 'grocery', 'shopping_bag', 2, 1
     WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'grocery')`,
    [groceryCat],
  );
  await pool.query(
    `INSERT INTO categories (id, parent_id, name, slug, icon_key, sort_order, is_active)
     SELECT ?, NULL, 'Vegetables', 'vegetables', 'eco', 3, 1
     WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'vegetables')`,
    [vegCat],
  );

  const [cats] = await pool.query<
    Array<{ id: string; slug: string }> & import('mysql2').RowDataPacket[]
  >(`SELECT id, slug FROM categories WHERE slug IN ('grocery', 'vegetables')`);
  const groceryId = cats.find((c) => c.slug === 'grocery')?.id ?? groceryCat;
  const vegId = cats.find((c) => c.slug === 'vegetables')?.id ?? vegCat;

  await pool.query(
    `INSERT INTO products (id, category_id, name, slug, description, brand, image_url, is_active)
     SELECT ?, ?, 'Fresh Milk', 'fresh-milk', 'Farm-fresh milk', 'Dailyfax Dairy',
            'https://picsum.photos/seed/fresh-milk/800/600', 1
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'fresh-milk')`,
    [milkProduct, groceryId],
  );
  await pool.query(
    `INSERT INTO products (id, category_id, name, slug, description, brand, image_url, is_active)
     SELECT ?, ?, 'Fresh Organic Tomatoes', 'fresh-organic-tomatoes', 'Locally sourced organic tomatoes',
            'Farm Fresh', 'https://picsum.photos/seed/organic-tomatoes/800/600', 1
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = 'fresh-organic-tomatoes')`,
    [tomatoProduct, vegId],
  );

  await pool.query(
    `UPDATE products SET image_url = 'https://picsum.photos/seed/fresh-milk/800/600'
     WHERE slug = 'fresh-milk' AND (image_url IS NULL OR image_url = '')`,
  );
  await pool.query(
    `UPDATE products SET image_url = 'https://picsum.photos/seed/organic-tomatoes/800/600'
     WHERE slug = 'fresh-organic-tomatoes' AND (image_url IS NULL OR image_url = '')`,
  );

  const [products] = await pool.query<
    Array<{ id: string; slug: string }> & import('mysql2').RowDataPacket[]
  >(`SELECT id, slug FROM products WHERE slug IN ('fresh-milk', 'fresh-organic-tomatoes')`);
  const milkId = products.find((p) => p.slug === 'fresh-milk')?.id ?? milkProduct;
  const tomatoId =
    products.find((p) => p.slug === 'fresh-organic-tomatoes')?.id ?? tomatoProduct;

  await pool.query(
    `INSERT INTO product_variants (id, product_id, sku, unit_label, unit_value, unit_type, mrp_paise, price_paise, is_default, is_active)
     SELECT ?, ?, 'MILK-500ML', '500 ml', 500, 'ml', 3500, 3000, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = 'MILK-500ML')`,
    [milk500, milkId],
  );
  await pool.query(
    `INSERT INTO product_variants (id, product_id, sku, unit_label, unit_value, unit_type, mrp_paise, price_paise, is_default, is_active)
     SELECT ?, ?, 'MILK-1L', '1 litre', 1000, 'ml', 6500, 5800, 0, 1
     WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = 'MILK-1L')`,
    [milk1l, milkId],
  );
  await pool.query(
    `INSERT INTO product_variants (id, product_id, sku, unit_label, unit_value, unit_type, mrp_paise, price_paise, is_default, is_active)
     SELECT ?, ?, 'TOM-500G', '500g', 500, 'g', 6000, 4500, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = 'TOM-500G')`,
    [tomato500, tomatoId],
  );
  await pool.query(
    `INSERT INTO product_variants (id, product_id, sku, unit_label, unit_value, unit_type, mrp_paise, price_paise, is_default, is_active)
     SELECT ?, ?, 'TOM-1KG', '1kg', 1000, 'g', 11000, 8500, 0, 1
     WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = 'TOM-1KG')`,
    [tomato1kg, tomatoId],
  );

  for (const productId of [milkId, tomatoId]) {
    await pool.query(
      `INSERT INTO store_products (id, store_id, product_id, is_available)
       SELECT ?, ?, ?, 1
       WHERE NOT EXISTS (
         SELECT 1 FROM store_products WHERE store_id = ? AND product_id = ?
       )`,
      [createId(), resolvedStoreId, productId, resolvedStoreId, productId],
    );
  }

  const [variants] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >('SELECT id FROM product_variants WHERE deleted_at IS NULL');

  for (const variant of variants) {
    await pool.query(
      `INSERT INTO inventory (id, store_id, variant_id, quantity_available, quantity_reserved)
       SELECT ?, ?, ?, 100, 0
       WHERE NOT EXISTS (
         SELECT 1 FROM inventory WHERE store_id = ? AND variant_id = ?
       )`,
      [createId(), resolvedStoreId, variant.id, resolvedStoreId, variant.id],
    );
  }

  // Keep roleMap referenced for future admin seed expansion
  void roleMap;
  void hashToken;

  console.log('Seed complete');
  console.log({
    serviceAreaId: resolvedAreaId,
    storeId: resolvedStoreId,
    roles: Object.keys(roleMap),
  });

  await closePool();
}

seed().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
