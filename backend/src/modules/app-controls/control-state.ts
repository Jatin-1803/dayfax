import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

const CACHE_MS = 15_000;
let controlCache: { at: number; values: Map<string, { enabled: boolean; expiresAt: Date | null }> } | null = null;

export async function isControlEnabled(code: string): Promise<boolean> {
  if (!controlCache || Date.now() - controlCache.at > CACHE_MS) {
    try {
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT code, is_enabled, expires_at FROM system_controls`,
      );
      const values = new Map<string, { enabled: boolean; expiresAt: Date | null }>();
      for (const row of rows) {
        values.set(row.code as string, {
          enabled: Boolean(row.is_enabled),
          expiresAt: (row.expires_at as Date | null) ?? null,
        });
      }
      controlCache = { at: Date.now(), values };
    } catch {
      return true;
    }
  }

  const row = controlCache.values.get(code);
  if (!row) return true;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return true;
  return row.enabled;
}

export function clearControlCache(): void {
  controlCache = null;
}
