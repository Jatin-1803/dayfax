/**
 * Replace the live catalog with the products sheet.
 * Existing products are retired (slug/sku freed, soft-deleted) so order history stays intact.
 *
 * Usage: npm run import:products -- "C:\path\Products.csv"
 */
import { readFile } from 'node:fs/promises';
import { config as loadEnv } from 'dotenv';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool, closePool } from '../common/database/pool.js';
import { slugify } from '../common/database/catalog-data.js';
import { createId } from '../common/utils/id.js';
import { normalizeSearchTerm } from '../common/utils/search-normalize.js';
import {
  CATEGORY_HI,
  SUB_CATEGORY_HI,
  hindiLabel,
  toHindiProductName,
} from './product-sheet-copy.js';

loadEnv();

const DEFAULT_SHEET =
  'C:\\Users\\user\\Downloads\\Untitled spreadsheet - Products.csv';
const DEFAULT_STOCK = 100;

type SheetRow = Record<string, string>;

function parseCsv(text: string): SheetRow[] {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((cells) => cells.some((value) => value.trim().length > 0))
    .map((cells) => {
      const record: SheetRow = {};
      header.forEach((key, index) => {
        record[key.trim()] = (cells[index] ?? '').trim();
      });
      return record;
    });
}

function rupeesToPaise(raw: string, label: string): number {
  const value = Number(raw.replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return Math.round(value * 100);
}

function unitType(unit: string): string {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'l') return 'l';
  return normalized;
}

function splitAliases(...chunks: string[]): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const chunk of chunks) {
    for (const part of chunk.split(',')) {
      const alias = normalizeSearchTerm(part).slice(0, 120);
      if (!alias || seen.has(alias)) continue;
      seen.add(alias);
      aliases.push(alias);
      if (aliases.length >= 40) return aliases;
    }
  }
  return aliases;
}

type Db = Pool | PoolConnection;

async function retireExistingProducts(pool: Db): Promise<number> {
  await pool.query(`UPDATE store_products SET is_available = 0`);
  const [variantResult] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM product_variants WHERE deleted_at IS NULL`,
  );
  await pool.query(
    `UPDATE product_variants
     SET sku = CONCAT(LEFT(sku, 40), '-old-', LEFT(REPLACE(id, '-', ''), 8)),
         is_active = 0,
         deleted_at = NOW()
     WHERE deleted_at IS NULL`,
  );
  const [result] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM products WHERE deleted_at IS NULL`,
  );
  await pool.query(
    `UPDATE products
     SET slug = CONCAT(LEFT(slug, 160), '-old-', LEFT(REPLACE(id, '-', ''), 8)),
         is_active = 0,
         deleted_at = NOW()
     WHERE deleted_at IS NULL`,
  );
  return Number(result[0]?.total ?? 0) + Number(variantResult[0]?.total ?? 0) * 0;
}

async function ensureCategory(
  pool: Db,
  input: { name: string; parentId: string | null; iconKey: string; sortOrder: number },
): Promise<string> {
  const nameHi = hindiLabel(CATEGORY_HI, input.name);
  const baseSlug = input.parentId ? slugify(input.name) : slugify(input.name);
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id, name_hi FROM categories
     WHERE slug = ? AND deleted_at IS NULL
     LIMIT 1`,
    [baseSlug],
  );
  if (existing[0]?.id) {
    if (!existing[0].name_hi && nameHi !== input.name) {
      await pool.query(`UPDATE categories SET name_hi = ? WHERE id = ?`, [
        nameHi,
        existing[0].id,
      ]);
    }
    return existing[0].id as string;
  }

  const id = createId();
  await pool.query(
    `INSERT INTO categories
       (id, parent_id, name, name_hi, slug, icon_key, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, input.parentId, input.name, nameHi, baseSlug, input.iconKey, input.sortOrder],
  );
  return id;
}

async function main(): Promise<void> {
  const sheetPath = process.argv[2] || process.env.PRODUCT_SHEET_PATH || DEFAULT_SHEET;
  const csv = await readFile(sheetPath, 'utf8');
  const rows = parseCsv(csv.replace(/^\uFEFF/, ''));
  if (rows.length === 0) {
    throw new Error(`No product rows in ${sheetPath}`);
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const retired = await retireExistingProducts(connection);
    const [stores] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM stores
       WHERE deleted_at IS NULL AND is_active = 1 AND store_type <> 'FOOD'
       ORDER BY created_at ASC`,
    );
    const storeIds = stores.map((row) => row.id as string);
    if (storeIds.length === 0) {
      throw new Error('No active non-food store found. Seed a mart before importing products.');
    }

    const parentIds = new Map<string, string>();
    parentIds.set(
      'Grocery',
      await ensureCategory(connection, {
        name: 'Grocery',
        parentId: null,
        iconKey: 'shopping_bag',
        sortOrder: 1,
      }),
    );
    parentIds.set(
      'Cosmetics',
      await ensureCategory(connection, {
        name: 'Cosmetics',
        parentId: null,
        iconKey: 'spa',
        sortOrder: 3,
      }),
    );

    const categoryIds = new Map<string, string>();
    let categorySort = 10;
    const usedSlugs = new Set<string>();

    for (const row of rows) {
      const parentName = row['Main Category'];
      const categoryName = row['Category'];
      const parentId = parentIds.get(parentName);
      if (!parentId) {
        throw new Error(`Unknown main category "${parentName}" on ${row['Product ID']}`);
      }
      const key = `${parentName}::${categoryName}`;
      if (categoryIds.has(key)) continue;

      const existingId = await findChildCategory(connection, parentId, categoryName);
      if (existingId) {
        categoryIds.set(key, existingId);
        continue;
      }

      let slug = slugify(categoryName);
      const [slugHit] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM categories WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
        [slug],
      );
      if (slugHit[0] || usedSlugs.has(slug)) {
        slug = slugify(`${parentName}-${categoryName}`);
      }
      usedSlugs.add(slug);
      const id = createId();
      await connection.query(
        `INSERT INTO categories
           (id, parent_id, name, name_hi, slug, icon_key, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          parentId,
          categoryName,
          hindiLabel(CATEGORY_HI, categoryName),
          slug,
          'category',
          categorySort,
        ],
      );
      categorySort += 1;
      categoryIds.set(key, id);
    }

    let inserted = 0;
    for (const row of rows) {
      const sku = row['Product ID'];
      const name = row['Product Name'];
      if (!sku || !name) {
        throw new Error('Product ID and Product Name are required');
      }

      const categoryId = categoryIds.get(`${row['Main Category']}::${row['Category']}`);
      if (!categoryId) {
        throw new Error(`Missing category for ${sku}`);
      }

      const subCategory = row['Sub Category'] || null;
      const subCategoryHi = subCategory ? hindiLabel(SUB_CATEGORY_HI, subCategory) : null;
      const nameHi = toHindiProductName(name);
      const slug = slugify(name).slice(0, 200);
      const brand = row.Brand || null;
      const description = row['Detailed Description'] || row['Short Description'] || null;
      const size = Number(row.Size);
      const unit = row.Unit;
      const unitLabel = `${row.Size} ${unit}`.slice(0, 40);
      const mrpPaise = rupeesToPaise(row.MRP, `${sku} MRP`);
      const pricePaise = rupeesToPaise(row['Selling Price'], `${sku} selling price`);

      const productId = createId();
      await connection.query(
        `INSERT INTO products
           (id, category_id, sub_category, sub_category_hi, name, name_hi, slug,
            description, brand, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
        [
          productId,
          categoryId,
          subCategory,
          subCategoryHi,
          name,
          nameHi,
          slug,
          description,
          brand,
        ],
      );

      const variantId = createId();
      await connection.query(
        `INSERT INTO product_variants
           (id, product_id, sku, unit_label, unit_value, unit_type,
            mrp_paise, price_paise, is_default, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        [
          variantId,
          productId,
          sku,
          unitLabel,
          Number.isFinite(size) ? size : null,
          unitType(unit),
          mrpPaise,
          pricePaise,
        ],
      );

      for (const storeId of storeIds) {
        await connection.query(
          `INSERT INTO store_products (id, store_id, product_id, is_available)
           VALUES (?, ?, ?, 1)`,
          [createId(), storeId, productId],
        );
        await connection.query(
          `INSERT INTO inventory
             (id, store_id, variant_id, quantity_available, quantity_reserved)
           VALUES (?, ?, ?, ?, 0)`,
          [createId(), storeId, variantId, DEFAULT_STOCK],
        );
      }

      for (const alias of splitAliases(
        row['Hindi Searchable Words'],
        row['English Searchable Keywords'],
        row['Search Tags'],
        row['Image Search Keywords'],
        nameHi,
      )) {
        await connection.query(
          `INSERT INTO product_search_aliases (id, product_id, alias)
           VALUES (?, ?, ?)`,
          [createId(), productId, alias],
        );
      }

      inserted += 1;
    }

    await connection.commit();
    console.log(
      `Retired existing products. Imported ${inserted} products onto ${storeIds.length} store(s) with stock ${DEFAULT_STOCK}. Retired marker count ${retired}.`,
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await closePool();
  }
}

async function findChildCategory(
  pool: Db,
  parentId: string,
  name: string,
): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM categories
     WHERE parent_id = ? AND name = ? AND deleted_at IS NULL
     LIMIT 1`,
    [parentId, name],
  );
  return (rows[0]?.id as string | undefined) ?? null;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
