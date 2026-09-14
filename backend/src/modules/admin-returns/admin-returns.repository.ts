import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

export interface AdminReturnListRow {
  id: string;
  order_id: string;
  order_number: string;
  user_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  refund_amount_paise: number;
  refund_method: string;
  refund_status: string;
  customer_note: string;
  created_at: Date;
}

export class AdminReturnsRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async count(status?: string): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM return_requests
       WHERE (? IS NULL OR status = ?)`,
      [status ?? null, status ?? null],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async list(status: string | undefined, limit: number, offset: number): Promise<AdminReturnListRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT rr.id, rr.order_id, o.order_number, rr.user_id, u.full_name AS customer_name,
              u.phone AS customer_phone, rr.status, rr.refund_amount_paise, rr.refund_method,
              rr.refund_status, rr.customer_note, rr.created_at
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       INNER JOIN users u ON u.id = rr.user_id
       WHERE (? IS NULL OR rr.status = ?)
       ORDER BY rr.created_at DESC
       LIMIT ? OFFSET ?`,
      [status ?? null, status ?? null, limit, offset],
    );
    return rows as AdminReturnListRow[];
  }

  async listPendingPayouts(): Promise<
    Array<{
      id: string;
      source: 'RETURN' | 'CANCEL';
      order_id: string;
      order_number: string;
      amount_paise: number;
      refund_status: string;
      customer_phone: string | null;
    }>
  > {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT rr.id, 'RETURN' AS source, rr.order_id, o.order_number, rr.refund_amount_paise AS amount_paise,
              rr.refund_status, u.phone AS customer_phone
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       INNER JOIN users u ON u.id = rr.user_id
       WHERE rr.refund_method = 'MANUAL'
         AND rr.refund_status IN ('PENDING', 'FAILED')
       UNION ALL
       SELECT p.id, 'CANCEL' AS source, p.order_id, o.order_number, p.amount_paise,
              p.refund_status, u.phone AS customer_phone
       FROM payments p
       INNER JOIN orders o ON o.id = p.order_id
       INNER JOIN users u ON u.id = o.user_id
       WHERE o.status = 'CANCELLED'
         AND p.refund_status IN ('PENDING', 'FAILED')
         AND p.method = 'COD'
       ORDER BY order_number DESC
       LIMIT 50`,
    );
    return rows as Array<{
      id: string;
      source: 'RETURN' | 'CANCEL';
      order_id: string;
      order_number: string;
      amount_paise: number;
      refund_status: string;
      customer_phone: string | null;
    }>;
  }
}
