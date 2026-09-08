import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool, closePool } from './pool.js';
import { createId } from '../utils/id.js';
import { env } from '../../config/env.js';
import { slugify } from './catalog-data.js';

loadEnv();

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function ensureLocalShop(
  pool: Pool,
  serviceAreaId: string,
  foodCategoryId: string,
  shop: {
    name: string;
    slug: string;
    phone: string;
    addressLine1: string;
    city: string;
    latitude: number;
    longitude: number;
    imageSeed: string;
    items: Array<{ name: string; pricePaise: number; imageSeed: string }>;
  },
): Promise<void> {
  const storeId = createId();
  await pool.query(
    `INSERT INTO stores (
       id, service_area_id, name, slug, store_type, image_url, description,
       phone_country_code, phone, address_line1, city, latitude, longitude,
       is_popular, is_active
     )
     SELECT ?, ?, ?, ?, 'FOOD', ?, ?, '+91', ?, ?, ?, ?, ?, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM stores WHERE slug = ? AND deleted_at IS NULL)`,
    [
      storeId,
      serviceAreaId,
      shop.name,
      shop.slug,
      `https://picsum.photos/seed/${shop.imageSeed}/200/200`,
      `Popular local shop: ${shop.name}`,
      shop.phone,
      shop.addressLine1,
      shop.city,
      shop.latitude,
      shop.longitude,
      shop.slug,
    ],
  );

  const [stores] = await pool.query<Array<{ id: string }> & RowDataPacket[]>(
    `SELECT id FROM stores WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [shop.slug],
  );
  const resolvedStoreId = stores[0]?.id;
  if (!resolvedStoreId) return;

  for (const item of shop.items) {
    const productSlug = `${shop.slug}-${slugify(item.name)}`;
    const productId = createId();
    await pool.query(
      `INSERT INTO products (id, category_id, name, slug, description, brand, image_url, is_active)
       SELECT ?, ?, ?, ?, ?, ?, ?, 1
       WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = ?)`,
      [
        productId,
        foodCategoryId,
        item.name,
        productSlug,
        `${item.name} from ${shop.name}`,
        shop.name,
        `https://picsum.photos/seed/${item.imageSeed}/800/600`,
        productSlug,
      ],
    );

    const [products] = await pool.query<Array<{ id: string }> & RowDataPacket[]>(
      `SELECT id FROM products WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [productSlug],
    );
    const resolvedProductId = products[0]?.id;
    if (!resolvedProductId) continue;

    const variantId = createId();
    const sku = `${productSlug.toUpperCase().replace(/-/g, '').slice(0, 24)}-1`;
    await pool.query(
      `INSERT INTO product_variants (
         id, product_id, sku, unit_label, unit_value, unit_type,
         mrp_paise, price_paise, is_default, is_active
       )
       SELECT ?, ?, ?, '1 pc', 1, 'pc', ?, ?, 1, 1
       WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = ?)`,
      [variantId, resolvedProductId, sku, item.pricePaise + 500, item.pricePaise, sku],
    );

    await pool.query(
      `INSERT INTO store_products (id, store_id, product_id, is_available)
       SELECT ?, ?, ?, 1
       WHERE NOT EXISTS (
         SELECT 1 FROM store_products WHERE store_id = ? AND product_id = ?
       )`,
      [createId(), resolvedStoreId, resolvedProductId, resolvedStoreId, resolvedProductId],
    );

    const [variants] = await pool.query<Array<{ id: string }> & RowDataPacket[]>(
      `SELECT id FROM product_variants WHERE product_id = ? AND deleted_at IS NULL`,
      [resolvedProductId],
    );
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
  }
}

async function ensureUserWithRole(input: {
  phoneCountryCode: string;
  phone: string;
  roleCode: 'ADMIN' | 'DELIVERY_PARTNER' | 'CUSTOMER';
  fullName?: string;
}): Promise<void> {
  const pool = getPool();
  const [users] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >(
    `SELECT id FROM users
     WHERE phone_country_code = ? AND phone = ? AND deleted_at IS NULL
     LIMIT 1`,
    [input.phoneCountryCode, input.phone],
  );

  let userId = users[0]?.id as string | undefined;
  if (!userId) {
    userId = createId();
    await pool.query(
      `INSERT INTO users (id, phone_country_code, phone, full_name, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [userId, input.phoneCountryCode, input.phone, input.fullName ?? null],
    );
  }

  const [roles] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >(`SELECT id FROM roles WHERE code = ? LIMIT 1`, [input.roleCode]);
  const roleId = roles[0]?.id as string | undefined;
  if (!roleId) return;

  await pool.query(
    `INSERT INTO user_roles (id, user_id, role_id)
     SELECT ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM user_roles WHERE user_id = ? AND role_id = ?
     )`,
    [createId(), userId, roleId, userId, roleId],
  );
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
     SELECT ?, ?, 'DayFax Mart', 'dailyfax-mart', 'MIXED', 1
     WHERE NOT EXISTS (SELECT 1 FROM stores LIMIT 1)`,
    [storeId, resolvedAreaId],
  );

  const [stores] = await pool.query<
    Array<{ id: string }> & import('mysql2').RowDataPacket[]
  >(`SELECT id FROM stores WHERE slug = 'dailyfax-mart' AND deleted_at IS NULL LIMIT 1`);
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
  >(`SELECT id, slug FROM categories WHERE slug IN ('grocery', 'vegetables', 'food')`);
  const groceryId = cats.find((c) => c.slug === 'grocery')?.id ?? groceryCat;
  const vegId = cats.find((c) => c.slug === 'vegetables')?.id ?? vegCat;
  const foodId = cats.find((c) => c.slug === 'food')?.id ?? foodCat;

  await pool.query(
    `INSERT INTO products (id, category_id, name, slug, description, brand, image_url, is_active)
     SELECT ?, ?, 'Fresh Milk', 'fresh-milk', 'Farm-fresh milk', 'DayFax Dairy',
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
  >(
    `SELECT id FROM product_variants
     WHERE deleted_at IS NULL AND product_id IN (?, ?)`,
    [milkId, tomatoId],
  );

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

  const snackItems = [
    { name: 'Patiz', pricePaise: 2500, imageSeed: 'patiz' },
    { name: 'Burger', pricePaise: 4500, imageSeed: 'burger' },
    { name: 'Paneer Patiz', pricePaise: 3500, imageSeed: 'paneer-patiz' },
    { name: 'Pizza', pricePaise: 9900, imageSeed: 'pizza' },
  ];

  await ensureLocalShop(pool, resolvedAreaId, foodId, {
    name: 'Avtar',
    slug: 'avtar',
    phone: '9876501001',
    addressLine1: 'Main Market Road',
    city: 'Launch Town',
    latitude: 26.8467000,
    longitude: 80.9462000,
    imageSeed: 'shop-avtar',
    items: snackItems,
  });

  await ensureLocalShop(pool, resolvedAreaId, foodId, {
    name: 'Pawan',
    slug: 'pawan',
    phone: '9876501002',
    addressLine1: 'Near Bus Stand',
    city: 'Launch Town',
    latitude: 26.8472000,
    longitude: 80.9471000,
    imageSeed: 'shop-pawan',
    items: snackItems,
  });

  await ensureLocalShop(pool, resolvedAreaId, foodId, {
    name: 'Tatachand Misthan Bhandar',
    slug: 'tatachand-misthan-bhandar',
    phone: '9876501003',
    addressLine1: 'Sweets Lane',
    city: 'Launch Town',
    latitude: 26.8481000,
    longitude: 80.9455000,
    imageSeed: 'shop-misthan',
    items: [
      { name: 'Balushaai', pricePaise: 4000, imageSeed: 'balushaai' },
      { name: 'Ghevar', pricePaise: 5500, imageSeed: 'ghevar' },
      { name: 'Barfi', pricePaise: 4500, imageSeed: 'barfi' },
    ],
  });

  await ensureLocalShop(pool, resolvedAreaId, foodId, {
    name: 'Panjab Bhelpui',
    slug: 'panjab-bhelpui',
    phone: '9876501004',
    addressLine1: 'Chaat Corner',
    city: 'Launch Town',
    latitude: 26.8455000,
    longitude: 80.9480000,
    imageSeed: 'shop-bhelpui',
    items: [{ name: 'Bhelpui', pricePaise: 3000, imageSeed: 'bhelpui' }],
  });

  // Admin console account (email/password in admin_users)
  const adminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase();
  if (adminEmail.includes('@') && env.SEED_ADMIN_PASSWORD.length >= 8) {
    const bcrypt = await import('bcryptjs');
    const { AdminAuthRepository } = await import('../../modules/admin-auth/admin-auth.repository.js');
    const adminRepo = new AdminAuthRepository(pool);
    const passwordHash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
    const result = await adminRepo.upsertAdminUser({
      email: adminEmail,
      passwordHash,
      fullName: env.SEED_ADMIN_NAME,
    });
    console.log(
      result.created
        ? `Seeded admin_users: ${adminEmail}`
        : `Updated admin_users password: ${adminEmail}`,
    );
  }

  // Optional legacy: ADMIN role on app OTP users (SEED_ADMIN_PHONE) — not used by admin SPA
  const adminPhone = env.SEED_ADMIN_PHONE.trim();
  if (/^[6-9]\d{9}$/.test(adminPhone)) {
    await ensureUserWithRole({
      phoneCountryCode: env.SEED_ADMIN_PHONE_COUNTRY_CODE,
      phone: adminPhone,
      roleCode: 'ADMIN',
      fullName: 'Seed Admin',
    });
    console.log('Seeded app-user ADMIN role for', adminPhone);
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
