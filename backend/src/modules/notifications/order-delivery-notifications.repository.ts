import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export type OrderDeliveryNotificationType = 'partner_new_order' | 'partner_order_taken';
export type OrderDeliveryNotificationStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'OPENED'
  | 'EXPIRED';

export type OrderDeliveryNotificationRow = {
  id: string;
  order_id: string;
  delivery_boy_id: string;
  notification_type: OrderDeliveryNotificationType;
  status: OrderDeliveryNotificationStatus;
  attempt_count: number;
  failure_reason: string | null;
  sent_at: Date | null;
  created_at: Date;
  order_number?: string;
  partner_name?: string | null;
};

export class OrderDeliveryNotificationsRepository {
  constructor(private readonly db = getPool()) {}

  /**
   * Insert PENDING row. Returns id when this process owns the send slot;
   * null when another process already claimed this partner+order+type.
   */
  async claim(input: {
    orderId: string;
    deliveryBoyId: string;
    notificationType: OrderDeliveryNotificationType;
    meta?: Record<string, unknown>;
  }): Promise<string | null> {
    const id = createId();
    try {
      await this.db.query(
        `INSERT INTO order_delivery_notifications
           (id, order_id, delivery_boy_id, notification_type, status, attempt_count, meta_json)
         VALUES (?, ?, ?, ?, 'PENDING', 0, ?)`,
        [
          id,
          input.orderId,
          input.deliveryBoyId,
          input.notificationType,
          input.meta ? JSON.stringify(input.meta) : null,
        ],
      );
      return id;
    } catch (error) {
      if (isDuplicateKeyError(error)) return null;
      throw error;
    }
  }

  async markSent(id: string): Promise<void> {
    await this.db.query(
      `UPDATE order_delivery_notifications
       SET status = 'SENT',
           attempt_count = attempt_count + 1,
           sent_at = CURRENT_TIMESTAMP,
           failure_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id],
    );
  }

  async markFailed(id: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE order_delivery_notifications
       SET status = 'FAILED',
           attempt_count = attempt_count + 1,
           failure_reason = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason.slice(0, 255), id],
    );
  }

  async markOpened(orderId: string, deliveryBoyId: string): Promise<void> {
    await this.db.query(
      `UPDATE order_delivery_notifications
       SET status = 'OPENED',
           delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?
         AND delivery_boy_id = ?
         AND notification_type = 'partner_new_order'
         AND status IN ('SENT', 'PENDING')`,
      [orderId, deliveryBoyId],
    );
  }

  async markAccepted(orderId: string, deliveryBoyId: string): Promise<void> {
    await this.db.query(
      `UPDATE order_delivery_notifications
       SET accepted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?
         AND delivery_boy_id = ?
         AND notification_type = 'partner_new_order'`,
      [orderId, deliveryBoyId],
    );
  }

  async markExpiredForOrder(orderId: string, exceptPartnerId?: string): Promise<void> {
    await this.db.query(
      `UPDATE order_delivery_notifications
       SET status = 'EXPIRED',
           updated_at = CURRENT_TIMESTAMP
       WHERE order_id = ?
         AND notification_type = 'partner_new_order'
         AND status IN ('PENDING', 'SENT', 'OPENED')
         ${exceptPartnerId ? 'AND delivery_boy_id <> ?' : ''}`,
      exceptPartnerId ? [orderId, exceptPartnerId] : [orderId],
    );
  }

  async listPartnerIdsNotified(orderId: string): Promise<string[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT DISTINCT delivery_boy_id
       FROM order_delivery_notifications
       WHERE order_id = ?
         AND notification_type = 'partner_new_order'
         AND status IN ('SENT', 'OPENED', 'PENDING', 'FAILED')`,
      [orderId],
    );
    return (rows as Array<{ delivery_boy_id: string }>).map((row) => row.delivery_boy_id);
  }

  async listForAdmin(input: {
    orderId?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: OrderDeliveryNotificationRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (input.orderId) {
      where.push('n.order_id = ?');
      params.push(input.orderId);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM order_delivery_notifications n
       ${whereSql}`,
      params,
    );
    const total = Number((countRows[0] as { total: number } | undefined)?.total ?? 0);

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT n.id, n.order_id, n.delivery_boy_id, n.notification_type, n.status,
              n.attempt_count, n.failure_reason, n.sent_at, n.created_at,
              o.order_number, u.full_name AS partner_name
       FROM order_delivery_notifications n
       INNER JOIN orders o ON o.id = n.order_id
       INNER JOIN users u ON u.id = n.delivery_boy_id
       ${whereSql}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, input.limit, input.offset],
    );

    return {
      total,
      items: rows as OrderDeliveryNotificationRow[],
    };
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}
