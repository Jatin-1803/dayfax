import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createId } from '../utils/id.js';
import { normalizeSearchTerm } from '../utils/search-normalize.js';
import {
  GROCERY_SYNONYM_GROUPS,
  PRODUCT_ALIAS_BY_SLUG,
} from './search-synonym-seed-data.js';

/**
 * Upserts default grocery synonym groups and a few product-level aliases.
 * Safe to run repeatedly (skips existing canonical groups / alias rows).
 */
export async function seedSearchSynonyms(pool: Pool): Promise<void> {
  for (const group of GROCERY_SYNONYM_GROUPS) {
    const canonical = normalizeSearchTerm(group.canonical);
    if (!canonical) continue;

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM search_synonym_groups WHERE canonical_term = ? LIMIT 1`,
      [canonical],
    );

    let groupId = existing[0]?.id as string | undefined;
    if (!groupId) {
      groupId = createId();
      await pool.query(
        `INSERT INTO search_synonym_groups (id, canonical_term, is_active)
         VALUES (?, ?, 1)`,
        [groupId, canonical],
      );
    }

    const terms = new Set(
      group.terms
        .map((t) => normalizeSearchTerm(t))
        .filter((t) => t.length > 0),
    );
    terms.add(canonical);

    for (const term of terms) {
      await pool.query(
        `INSERT INTO search_synonym_terms (id, group_id, term)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM search_synonym_terms WHERE term = ?)`,
        [createId(), groupId, term, term],
      );
    }
  }

  for (const entry of PRODUCT_ALIAS_BY_SLUG) {
    const [products] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM products WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
      [entry.slug],
    );
    const productId = products[0]?.id as string | undefined;
    if (!productId) continue;

    for (const raw of entry.aliases) {
      const alias = normalizeSearchTerm(raw);
      if (!alias) continue;
      await pool.query(
        `INSERT INTO product_search_aliases (id, product_id, alias)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM product_search_aliases WHERE product_id = ? AND alias = ?
         )`,
        [createId(), productId, alias, productId, alias],
      );
    }
  }
}
