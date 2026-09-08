import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  channel: 'PUSH' | 'SMS' | 'IN_APP';
  is_read: number;
  meta_json: string | Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export class NotificationsRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async listByUser(
    userId: string,
    limit: number,
    offset: number,
    unreadOnly: boolean,
  ): Promise<NotificationRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, user_id, title, body, channel, is_read, meta_json, created_at, updated_at
       FROM notifications
       WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );
    return rows as NotificationRow[];
  }

  async countByUser(userId: string, unreadOnly: boolean): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE user_id = ? ${unreadOnly ? 'AND is_read = 0' : ''}`,
      [userId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async findByIdForUser(id: string, userId: string): Promise<NotificationRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, user_id, title, body, channel, is_read, meta_json, created_at, updated_at
       FROM notifications
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId],
    );
    return (rows[0] as NotificationRow) ?? null;
  }

  async create(
    input: {
      userId: string;
      title: string;
      body: string;
      channel?: 'PUSH' | 'SMS' | 'IN_APP';
      meta?: Record<string, unknown> | null;
    },
    conn: Pool | PoolConnection = this.db,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO notifications (id, user_id, title, body, channel, meta_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.title,
        input.body,
        input.channel ?? 'IN_APP',
        input.meta ? JSON.stringify(input.meta) : null,
      ],
    );
    return id;
  }

  async markRead(id: string, userId: string): Promise<boolean> {
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE notifications SET is_read = 1
       WHERE id = ? AND user_id = ? AND is_read = 0`,
      [id, userId],
    );
    return result.affectedRows > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const [result] = await this.db.query<ResultSetHeader>(
      `UPDATE notifications SET is_read = 1
       WHERE user_id = ? AND is_read = 0`,
      [userId],
    );
    return result.affectedRows;
  }
}
