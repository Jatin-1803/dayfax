import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';
import { ACTIVE_BANNER_LIMIT } from './banners.eligibility.js';
import type { CreateBannerInput, PatchBannerInput } from './banners.schema.js';

export interface HomeBannerRow extends RowDataPacket {
  id: string;
  title: string;
  title_hi: string | null;
  image_url: string;
  link_path: string | null;
  priority: number;
  is_active: number;
  start_at: Date;
  end_at: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

const BANNER_COLUMNS = `
  id, title, title_hi, image_url, link_path, priority, is_active,
  start_at, end_at, created_at, updated_at, deleted_at
`;

export class BannersRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async listAdmin(): Promise<HomeBannerRow[]> {
    const [rows] = await this.db.query<HomeBannerRow[]>(
      `SELECT ${BANNER_COLUMNS}
       FROM home_banners
       WHERE deleted_at IS NULL
       ORDER BY priority DESC, created_at DESC
       LIMIT 100`,
    );
    return rows;
  }

  async listActive(limit = ACTIVE_BANNER_LIMIT): Promise<HomeBannerRow[]> {
    const [rows] = await this.db.query<HomeBannerRow[]>(
      `SELECT ${BANNER_COLUMNS}
       FROM home_banners
       WHERE deleted_at IS NULL
         AND is_active = 1
         AND start_at <= UTC_TIMESTAMP()
         AND end_at > UTC_TIMESTAMP()
       ORDER BY priority DESC, created_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows;
  }

  async findById(id: string): Promise<HomeBannerRow | null> {
    const [rows] = await this.db.query<HomeBannerRow[]>(
      `SELECT ${BANNER_COLUMNS}
       FROM home_banners
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async insert(input: CreateBannerInput): Promise<string> {
    const id = createId();
    await this.db.query(
      `INSERT INTO home_banners (
         id, title, title_hi, image_url, link_path, priority, is_active, start_at, end_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.title,
        input.titleHi ?? null,
        input.imageUrl,
        input.linkPath ?? null,
        input.priority,
        input.isActive ? 1 : 0,
        input.startAt,
        input.endAt,
      ],
    );
    return id;
  }

  async update(id: string, input: PatchBannerInput): Promise<boolean> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (input.title !== undefined) {
      sets.push('title = ?');
      params.push(input.title);
    }
    if (input.titleHi !== undefined) {
      sets.push('title_hi = ?');
      params.push(input.titleHi);
    }
    if (input.imageUrl !== undefined) {
      sets.push('image_url = ?');
      params.push(input.imageUrl);
    }
    if (input.linkPath !== undefined) {
      sets.push('link_path = ?');
      params.push(input.linkPath);
    }
    if (input.priority !== undefined) {
      sets.push('priority = ?');
      params.push(input.priority);
    }
    if (input.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(input.isActive ? 1 : 0);
    }
    if (input.startAt !== undefined) {
      sets.push('start_at = ?');
      params.push(input.startAt);
    }
    if (input.endAt !== undefined) {
      sets.push('end_at = ?');
      params.push(input.endAt);
    }

    if (sets.length === 0) return false;

    params.push(id);
    const [result] = await this.db.query(
      `UPDATE home_banners SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params,
    );
    return (result as { affectedRows?: number }).affectedRows === 1;
  }

  async softDelete(id: string): Promise<boolean> {
    const [result] = await this.db.query(
      `UPDATE home_banners
       SET deleted_at = UTC_TIMESTAMP(), is_active = 0
       WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return (result as { affectedRows?: number }).affectedRows === 1;
  }
}
