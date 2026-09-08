import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import { normalizeSearchTerm } from '../../common/utils/search-normalize.js';

export type SearchMatchVia = 'direct' | 'synonym' | 'meili' | 'fallback';

export interface ExpandedSearchQuery {
  normalized: string;
  terms: string[];
  canonicalTerm: string | null;
  matchedViaSynonym: boolean;
}

export class SearchRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async expandQuery(q: string): Promise<ExpandedSearchQuery | null> {
    const normalized = normalizeSearchTerm(q);
    if (!normalized) return null;

    const [groupRows] = await this.db.query<RowDataPacket[]>(
      `SELECT g.id, g.canonical_term
       FROM search_synonym_terms t
       INNER JOIN search_synonym_groups g ON g.id = t.group_id
       WHERE t.term = ? AND g.is_active = 1
       LIMIT 1`,
      [normalized],
    );

    if (!groupRows[0]) {
      return {
        normalized,
        terms: [normalized],
        canonicalTerm: null,
        matchedViaSynonym: false,
      };
    }

    const groupId = groupRows[0].id as string;
    const canonicalTerm = groupRows[0].canonical_term as string;

    const [termRows] = await this.db.query<RowDataPacket[]>(
      `SELECT term FROM search_synonym_terms WHERE group_id = ?`,
      [groupId],
    );

    const terms = [
      ...new Set(
        (termRows as Array<{ term: string }>).map((row) => row.term).filter(Boolean),
      ),
    ];
    if (!terms.includes(normalized)) {
      terms.unshift(normalized);
    }

    return {
      normalized,
      terms,
      canonicalTerm,
      matchedViaSynonym: canonicalTerm !== normalized || terms.length > 1,
    };
  }

  async logQuery(input: {
    q: string;
    normalizedQ: string;
    storeId?: string | null;
    userId?: string | null;
    resultCount: number;
    matchedVia: SearchMatchVia;
    canonicalTerm?: string | null;
  }): Promise<void> {
    await this.db.query<ResultSetHeader>(
      `INSERT INTO search_query_logs
         (id, q, normalized_q, store_id, user_id, result_count, matched_via, canonical_term)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        input.q.slice(0, 100),
        input.normalizedQ.slice(0, 100),
        input.storeId ?? null,
        input.userId ?? null,
        input.resultCount,
        input.matchedVia,
        input.canonicalTerm ?? null,
      ],
    );
  }

  async listZeroResultQueries(options: {
    limit: number;
    days: number;
  }): Promise<
    Array<{
      normalizedQ: string;
      sampleQ: string;
      hitCount: number;
      lastSeenAt: Date;
    }>
  > {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
          normalized_q AS normalizedQ,
          MIN(q) AS sampleQ,
          COUNT(*) AS hitCount,
          MAX(created_at) AS lastSeenAt
       FROM search_query_logs
       WHERE result_count = 0
         AND created_at >= (NOW() - INTERVAL ? DAY)
       GROUP BY normalized_q
       ORDER BY hitCount DESC, lastSeenAt DESC
       LIMIT ?`,
      [options.days, options.limit],
    );

    return (rows as Array<{
      normalizedQ: string;
      sampleQ: string;
      hitCount: number | string;
      lastSeenAt: Date;
    }>).map((row) => ({
      normalizedQ: row.normalizedQ,
      sampleQ: row.sampleQ,
      hitCount: Number(row.hitCount),
      lastSeenAt: row.lastSeenAt,
    }));
  }

  async listAllSynonymMaps(): Promise<Record<string, string[]>> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT g.canonical_term, t.term
       FROM search_synonym_groups g
       INNER JOIN search_synonym_terms t ON t.group_id = g.id
       WHERE g.is_active = 1
       ORDER BY g.canonical_term ASC, t.term ASC`,
    );

    const map: Record<string, string[]> = {};
    for (const row of rows as Array<{ canonical_term: string; term: string }>) {
      const key = row.canonical_term;
      if (!map[key]) map[key] = [];
      if (!map[key].includes(row.term)) {
        map[key].push(row.term);
      }
    }
    return map;
  }
}
