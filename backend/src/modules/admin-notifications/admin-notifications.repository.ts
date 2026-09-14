import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export interface PromoRow {
  id: string;
  audience: 'CUSTOMERS' | 'PARTNERS' | 'ALL';
  title: string;
  title_hi: string;
  body: string;
  body_hi: string;
  recipient_count: number;
  sent_count: number;
  sent_by_admin_id: string;
  created_at: Date;
}

export class AdminNotificationsRepository {
  constructor(private readonly db = getPool()) {}

  async listRecent(limit = 20): Promise<PromoRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, audience, title, title_hi, body, body_hi, recipient_count, sent_count, sent_by_admin_id, created_at
       FROM promo_notifications
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows as PromoRow[];
  }

  async insert(input: {
    id: string;
    audience: PromoRow['audience'];
    title: string;
    titleHi: string;
    body: string;
    bodyHi: string;
    recipientCount: number;
    sentCount: number;
    sentByAdminId: string;
  }): Promise<string> {
    await this.db.query<ResultSetHeader>(
      `INSERT INTO promo_notifications
         (id, audience, title, title_hi, body, body_hi, recipient_count, sent_count, sent_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.audience,
        input.title,
        input.titleHi,
        input.body,
        input.bodyHi,
        input.recipientCount,
        input.sentCount,
        input.sentByAdminId,
      ],
    );
    return input.id;
  }

  async insertInbox(
    rows: Array<{ userId: string; title: string; body: string; promoId: string }>,
  ): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((row) => [
      createId(),
      row.userId,
      row.title,
      row.body,
      'PUSH',
      JSON.stringify({ type: 'PROMO', promoId: row.promoId }),
    ]);
    await this.db.query(
      `INSERT INTO notifications (id, user_id, title, body, channel, meta_json)
       VALUES ?`,
      [values],
    );
  }
}
