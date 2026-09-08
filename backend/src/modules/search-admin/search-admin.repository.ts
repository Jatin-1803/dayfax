import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import { normalizeSearchTerm } from '../../common/utils/search-normalize.js';

export interface SynonymGroupRow {
  id: string;
  canonical_term: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export interface SynonymTermRow {
  id: string;
  group_id: string;
  term: string;
  created_at: Date;
}

export class SearchAdminRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async listSynonymGroups(): Promise<
    Array<{
      id: string;
      canonicalTerm: string;
      isActive: boolean;
      terms: Array<{ id: string; term: string }>;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const [groups] = await this.db.query<RowDataPacket[]>(
      `SELECT id, canonical_term, is_active, created_at, updated_at
       FROM search_synonym_groups
       ORDER BY canonical_term ASC`,
    );

    if (groups.length === 0) return [];

    const groupIds = (groups as SynonymGroupRow[]).map((g) => g.id);
    const placeholders = groupIds.map(() => '?').join(', ');
    const [terms] = await this.db.query<RowDataPacket[]>(
      `SELECT id, group_id, term
       FROM search_synonym_terms
       WHERE group_id IN (${placeholders})
       ORDER BY term ASC`,
      groupIds,
    );

    const termsByGroup = new Map<string, Array<{ id: string; term: string }>>();
    for (const term of terms as SynonymTermRow[]) {
      const list = termsByGroup.get(term.group_id) ?? [];
      list.push({ id: term.id, term: term.term });
      termsByGroup.set(term.group_id, list);
    }

    return (groups as SynonymGroupRow[]).map((group) => ({
      id: group.id,
      canonicalTerm: group.canonical_term,
      isActive: Boolean(group.is_active),
      terms: termsByGroup.get(group.id) ?? [],
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    }));
  }

  async findSynonymGroup(id: string) {
    const groups = await this.listSynonymGroups();
    return groups.find((g) => g.id === id) ?? null;
  }

  async createSynonymGroup(input: {
    canonicalTerm: string;
    terms: string[];
    isActive: boolean;
  }): Promise<string> {
    const id = createId();
    const canonical = normalizeSearchTerm(input.canonicalTerm);
    await this.db.query(
      `INSERT INTO search_synonym_groups (id, canonical_term, is_active)
       VALUES (?, ?, ?)`,
      [id, canonical, input.isActive ? 1 : 0],
    );

    const allTerms = new Set(
      [canonical, ...input.terms.map((t) => normalizeSearchTerm(t))].filter(Boolean),
    );
    for (const term of allTerms) {
      await this.db.query(
        `INSERT INTO search_synonym_terms (id, group_id, term)
         VALUES (?, ?, ?)`,
        [createId(), id, term],
      );
    }
    return id;
  }

  async updateSynonymGroup(
    id: string,
    input: { canonicalTerm?: string; isActive?: boolean },
  ): Promise<boolean> {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.canonicalTerm !== undefined) {
      fields.push('canonical_term = ?');
      params.push(normalizeSearchTerm(input.canonicalTerm));
    }
    if (input.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (fields.length === 0) return true;

    params.push(id);
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE search_synonym_groups SET ${fields.join(', ')} WHERE id = ?`,
      params,
    );
    return result.affectedRows > 0;
  }

  async deleteSynonymGroup(id: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM search_synonym_groups WHERE id = ?`,
      [id],
    );
    return result.affectedRows > 0;
  }

  async addTerm(groupId: string, term: string): Promise<string> {
    const id = createId();
    const normalized = normalizeSearchTerm(term);
    await this.db.query(
      `INSERT INTO search_synonym_terms (id, group_id, term) VALUES (?, ?, ?)`,
      [id, groupId, normalized],
    );
    return id;
  }

  async deleteTerm(groupId: string, termId: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM search_synonym_terms WHERE id = ? AND group_id = ?`,
      [termId, groupId],
    );
    return result.affectedRows > 0;
  }

  async findTermByValue(term: string): Promise<{ id: string; groupId: string } | null> {
    const normalized = normalizeSearchTerm(term);
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, group_id FROM search_synonym_terms WHERE term = ? LIMIT 1`,
      [normalized],
    );
    if (!rows[0]) return null;
    return { id: rows[0].id as string, groupId: rows[0].group_id as string };
  }

  async productExists(productId: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id FROM products WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [productId],
    );
    return Boolean(rows[0]);
  }

  async listProductAliases(productId: string): Promise<string[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT alias FROM product_search_aliases WHERE product_id = ? ORDER BY alias ASC`,
      [productId],
    );
    return (rows as Array<{ alias: string }>).map((r) => r.alias);
  }

  async replaceProductAliases(productId: string, aliases: string[]): Promise<string[]> {
    const normalized = [
      ...new Set(aliases.map((a) => normalizeSearchTerm(a)).filter(Boolean)),
    ];

    await this.db.query(`DELETE FROM product_search_aliases WHERE product_id = ?`, [
      productId,
    ]);

    for (const alias of normalized) {
      await this.db.query(
        `INSERT INTO product_search_aliases (id, product_id, alias) VALUES (?, ?, ?)`,
        [createId(), productId, alias],
      );
    }

    return normalized;
  }
}
