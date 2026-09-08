import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import type { AppLang } from './i18n.schema.js';

export interface UiTranslationRow {
  string_key: string;
  en_value: string;
  hi_value: string;
  updated_at: Date;
}

export class I18nRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async getVersion(): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT version FROM ui_translations_meta WHERE id = 1 LIMIT 1`,
    );
    return Number(rows[0]?.version ?? 1);
  }

  async bumpVersion(): Promise<number> {
    await this.db.query(`UPDATE ui_translations_meta SET version = version + 1 WHERE id = 1`);
    return this.getVersion();
  }

  async getBundle(lang: AppLang): Promise<Record<string, string>> {
    const column = lang === 'hi' ? 'hi_value' : 'en_value';
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT string_key, ${column} AS value FROM ui_translations ORDER BY string_key ASC`,
    );
    const strings: Record<string, string> = {};
    for (const row of rows) {
      strings[String(row.string_key)] = String(row.value);
    }
    return strings;
  }

  async list(options: {
    limit: number;
    offset: number;
    q?: string;
  }): Promise<{ rows: UiTranslationRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (options.q) {
      where.push('(string_key LIKE ? OR en_value LIKE ? OR hi_value LIKE ?)');
      const like = `%${options.q}%`;
      params.push(like, like, like);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM ui_translations ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT string_key, en_value, hi_value, updated_at
       FROM ui_translations
       ${whereSql}
       ORDER BY string_key ASC
       LIMIT ? OFFSET ?`,
      [...params, options.limit, options.offset],
    );

    return { rows: rows as UiTranslationRow[], total };
  }

  async findByKey(key: string): Promise<UiTranslationRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT string_key, en_value, hi_value, updated_at
       FROM ui_translations WHERE string_key = ? LIMIT 1`,
      [key],
    );
    return (rows[0] as UiTranslationRow) ?? null;
  }

  async create(input: { key: string; en: string; hi: string }): Promise<void> {
    await this.db.query(
      `INSERT INTO ui_translations (string_key, en_value, hi_value) VALUES (?, ?, ?)`,
      [input.key, input.en, input.hi],
    );
  }

  async update(
    key: string,
    input: { en?: string; hi?: string },
  ): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (input.en !== undefined) {
      sets.push('en_value = ?');
      params.push(input.en);
    }
    if (input.hi !== undefined) {
      sets.push('hi_value = ?');
      params.push(input.hi);
    }
    if (sets.length === 0) return false;

    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE ui_translations SET ${sets.join(', ')} WHERE string_key = ?`,
      [...params, key],
    );
    return result.affectedRows > 0;
  }

  async delete(key: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `DELETE FROM ui_translations WHERE string_key = ?`,
      [key],
    );
    return result.affectedRows > 0;
  }
}
