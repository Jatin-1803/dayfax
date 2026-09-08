import { createWriteStream } from 'node:fs';
import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { config as loadEnv } from 'dotenv';
import type { RowDataPacket } from 'mysql2';
import { getPool, closePool } from './pool.js';
import { createId } from '../utils/id.js';
import {
  COSMETICS_ITEMS,
  GROCERY_ITEMS,
  VEGETABLE_ITEMS,
  slugify,
  type CatalogSeedItem,
} from './catalog-data.js';
import { seedSearchSynonyms } from './seed-search-synonyms.js';

loadEnv();

const PUBLIC_DIR = path.resolve(process.cwd(), 'public', 'catalog');

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(slug: string, destPath: string): Promise<boolean> {
  if (await fileExists(destPath)) return true;

  const url = `https://picsum.photos/seed/${encodeURIComponent(slug)}/640/480.jpg`;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || !response.body) {
      console.warn(`Image download failed for ${slug}: ${response.status}`);
      return false;
    }
    await mkdir(path.dirname(destPath), { recursive: true });
    const nodeStream = Readable.fromWeb(response.body as never);
    await pipeline(nodeStream, createWriteStream(destPath));
    return true;
  } catch (error) {
    console.warn(`Image download error for ${slug}`, error);
    return false;
  }
}

async function ensureCategory(
  pool: ReturnType<typeof getPool>,
  input: { name: string; slug: string; iconKey: string; sortOrder: number },
): Promise<string> {
  const id = createId();
  await pool.query(
    `INSERT INTO categories (id, parent_id, name, slug, icon_key, sort_order, is_active)
     SELECT ?, NULL, ?, ?, ?, ?, 1
     WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = ?)`,
    [id, input.name, input.slug, input.iconKey, input.sortOrder, input.slug],
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [input.slug],
  );
  return (rows[0]?.id as string) ?? id;
}

async function upsertProduct(
  pool: ReturnType<typeof getPool>,
  options: {
    categoryId: string;
    storeId: string;
    item: CatalogSeedItem;
    categoryFolder: string;
  },
): Promise<void> {
  const slug = slugify(options.item.name);
  const relativeImage = `/media/catalog/${options.categoryFolder}/${slug}.jpg`;
  const absImagePath = path.join(PUBLIC_DIR, options.categoryFolder, `${slug}.jpg`);
  await downloadImage(slug, absImagePath);

  const productId = createId();
  await pool.query(
    `INSERT INTO products (id, category_id, name, slug, description, brand, image_url, is_active)
     SELECT ?, ?, ?, ?, ?, ?, ?, 1
     WHERE NOT EXISTS (SELECT 1 FROM products WHERE slug = ?)`,
    [
      productId,
      options.categoryId,
      options.item.name,
      slug,
      options.item.description,
      options.item.brand,
      relativeImage,
      slug,
    ],
  );

  await pool.query(
    `UPDATE products
     SET image_url = ?, brand = ?, description = ?, category_id = ?, is_active = 1, deleted_at = NULL
     WHERE slug = ?`,
    [
      relativeImage,
      options.item.brand,
      options.item.description,
      options.categoryId,
      slug,
    ],
  );

  const [products] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM products WHERE slug = ? LIMIT 1`,
    [slug],
  );
  const resolvedProductId = (products[0]?.id as string) ?? productId;

  await pool.query(
    `INSERT INTO store_products (id, store_id, product_id, is_available)
     SELECT ?, ?, ?, 1
     WHERE NOT EXISTS (
       SELECT 1 FROM store_products WHERE store_id = ? AND product_id = ?
     )`,
    [createId(), options.storeId, resolvedProductId, options.storeId, resolvedProductId],
  );

  const sku = `${slug.toUpperCase().replace(/-/g, '').slice(0, 20)}-DEF`;
  const variantId = createId();
  await pool.query(
    `INSERT INTO product_variants (
       id, product_id, sku, unit_label, unit_value, unit_type, mrp_paise, price_paise, is_default, is_active
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1, 1
     WHERE NOT EXISTS (SELECT 1 FROM product_variants WHERE sku = ?)`,
    [
      variantId,
      resolvedProductId,
      sku,
      options.item.unitLabel,
      options.item.unitValue,
      options.item.unitType,
      options.item.mrpPaise,
      options.item.pricePaise,
      sku,
    ],
  );

  await pool.query(
    `UPDATE product_variants
     SET unit_label = ?, unit_value = ?, unit_type = ?, mrp_paise = ?, price_paise = ?,
         is_default = 1, is_active = 1, deleted_at = NULL
     WHERE sku = ?`,
    [
      options.item.unitLabel,
      options.item.unitValue,
      options.item.unitType,
      options.item.mrpPaise,
      options.item.pricePaise,
      sku,
    ],
  );

  const [variants] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM product_variants WHERE sku = ? LIMIT 1`,
    [sku],
  );
  const resolvedVariantId = (variants[0]?.id as string) ?? variantId;

  await pool.query(
    `INSERT INTO inventory (id, store_id, variant_id, quantity_available, quantity_reserved)
     SELECT ?, ?, ?, 100, 0
     WHERE NOT EXISTS (
       SELECT 1 FROM inventory WHERE store_id = ? AND variant_id = ?
     )`,
    [createId(), options.storeId, resolvedVariantId, options.storeId, resolvedVariantId],
  );

  await pool.query(
    `UPDATE inventory SET quantity_available = GREATEST(quantity_available, 50)
     WHERE store_id = ? AND variant_id = ?`,
    [options.storeId, resolvedVariantId],
  );
}

async function seedGroup(
  pool: ReturnType<typeof getPool>,
  options: {
    categoryId: string;
    storeId: string;
    folder: string;
    items: CatalogSeedItem[];
    label: string;
  },
): Promise<void> {
  console.log(`Seeding ${options.label}: ${options.items.length} items…`);
  let done = 0;
  for (const catalogItem of options.items) {
    await upsertProduct(pool, {
      categoryId: options.categoryId,
      storeId: options.storeId,
      item: catalogItem,
      categoryFolder: options.folder,
    });
    done += 1;
    if (done % 10 === 0 || done === options.items.length) {
      console.log(`  ${options.label}: ${done}/${options.items.length}`);
    }
  }
}

async function main(): Promise<void> {
  const pool = getPool();
  await mkdir(PUBLIC_DIR, { recursive: true });

  const [stores] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM stores WHERE deleted_at IS NULL AND is_active = 1 ORDER BY created_at ASC LIMIT 1`,
  );
  const storeId = stores[0]?.id as string | undefined;
  if (!storeId) {
    throw new Error('No active store found. Run npm run seed first.');
  }

  const groceryId = await ensureCategory(pool, {
    name: 'Grocery',
    slug: 'grocery',
    iconKey: 'shopping_bag',
    sortOrder: 1,
  });
  const vegId = await ensureCategory(pool, {
    name: 'Vegetables',
    slug: 'vegetables',
    iconKey: 'eco',
    sortOrder: 2,
  });
  const cosmeticsId = await ensureCategory(pool, {
    name: 'Cosmetics',
    slug: 'cosmetics',
    iconKey: 'spa',
    sortOrder: 3,
  });
  await ensureCategory(pool, {
    name: 'Food',
    slug: 'food',
    iconKey: 'restaurant',
    sortOrder: 4,
  });

  await seedGroup(pool, {
    categoryId: groceryId,
    storeId,
    folder: 'grocery',
    items: GROCERY_ITEMS,
    label: 'Grocery',
  });
  await seedGroup(pool, {
    categoryId: cosmeticsId,
    storeId,
    folder: 'cosmetics',
    items: COSMETICS_ITEMS,
    label: 'Cosmetics',
  });
  await seedGroup(pool, {
    categoryId: vegId,
    storeId,
    folder: 'vegetables',
    items: VEGETABLE_ITEMS,
    label: 'Vegetables',
  });

  const [counts] = await pool.query<RowDataPacket[]>(
    `SELECT c.slug, COUNT(p.id) AS total
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL AND p.is_active = 1
     WHERE c.slug IN ('grocery', 'cosmetics', 'vegetables')
     GROUP BY c.slug`,
  );

  console.log('Seeding search synonyms and product aliases…');
  await seedSearchSynonyms(pool);

  console.log('Catalog seed complete');
  console.log(counts);
  await closePool();
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
