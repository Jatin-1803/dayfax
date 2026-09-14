import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export const OPEN_RETURN_STATUSES = [
  'PENDING_REVIEW',
  'APPROVED',
  'PICKUP_IN_PROGRESS',
  'PICKED_UP',
  'REFUND_PENDING',
] as const;

export interface SupportConversationRow {
  id: string;
  user_id: string;
  order_id: string;
  agent_display_name: string;
  status: 'OPEN' | 'CLOSED';
  lang: 'en' | 'hi';
  item_picker_open: number;
  created_at: Date;
  updated_at: Date;
}

export interface SupportMessageRow {
  id: string;
  conversation_id: string;
  sender: 'CUSTOMER' | 'AGENT';
  body: string;
  created_at: Date;
}

export interface ReturnRequestRow {
  id: string;
  order_id: string;
  user_id: string;
  conversation_id: string | null;
  reason: 'DAMAGED';
  customer_note: string;
  status: string;
  refund_amount_paise: number;
  refund_method: 'RAZORPAY' | 'MANUAL';
  refund_status: string;
  razorpay_refund_id: string | null;
  refund_payout_ref: string | null;
  pickup_code: string;
  pickup_code_attempts: number;
  admin_note: string | null;
  reviewed_at: Date | null;
  picked_up_at: Date | null;
  refunded_at: Date | null;
  created_at: Date;
  updated_at: Date;
  order_number?: string;
  payment_method?: string | null;
  payment_status?: string | null;
  razorpay_payment_id?: string | null;
}

export interface ReturnPhotoRow {
  id: string;
  return_request_id: string;
  image_url: string;
  created_at: Date;
}

export interface ReturnItemRow {
  id: string;
  return_request_id: string;
  order_item_id: string;
  quantity: number;
  note: string | null;
  line_refund_paise: number;
  product_name?: string;
  variant_label?: string;
  product_image_url?: string | null;
}

export class SupportRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async findConversationByOrderId(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<SupportConversationRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, user_id, order_id, agent_display_name, status, lang, item_picker_open,
              created_at, updated_at
       FROM support_conversations
       WHERE order_id = ?
       LIMIT 1`,
      [orderId],
    );
    return (rows[0] as SupportConversationRow) ?? null;
  }

  async createConversation(
    input: { userId: string; orderId: string; lang?: 'en' | 'hi' },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO support_conversations (id, user_id, order_id, agent_display_name, lang)
       VALUES (?, ?, ?, 'Ananya', ?)`,
      [id, input.userId, input.orderId, input.lang === 'hi' ? 'hi' : 'en'],
    );
    return id;
  }

  async updateConversationPrefs(
    conversationId: string,
    input: { lang?: 'en' | 'hi'; itemPickerOpen?: boolean },
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    await conn.query(
      `UPDATE support_conversations
       SET lang = COALESCE(?, lang),
           item_picker_open = COALESCE(?, item_picker_open)
       WHERE id = ?`,
      [
        input.lang ?? null,
        input.itemPickerOpen == null ? null : input.itemPickerOpen ? 1 : 0,
        conversationId,
      ],
    );
  }

  async listMessages(conversationId: string): Promise<SupportMessageRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, conversation_id, sender, body, created_at
       FROM support_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC`,
      [conversationId],
    );
    return rows as SupportMessageRow[];
  }

  async addMessage(
    input: { conversationId: string; sender: 'CUSTOMER' | 'AGENT'; body: string },
    conn: Pool | PoolConnection = this.db,
  ): Promise<SupportMessageRow> {
    const id = createId();
    await conn.query(
      `INSERT INTO support_messages (id, conversation_id, sender, body)
       VALUES (?, ?, ?, ?)`,
      [id, input.conversationId, input.sender, input.body],
    );
    await conn.query(
      `UPDATE support_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [input.conversationId],
    );
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, conversation_id, sender, body, created_at
       FROM support_messages WHERE id = ? LIMIT 1`,
      [id],
    );
    return rows[0] as SupportMessageRow;
  }

  async findBlockingReturn(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<ReturnRequestRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, user_id, conversation_id, reason, customer_note, status,
              refund_amount_paise, refund_method, refund_status, razorpay_refund_id,
              refund_payout_ref, pickup_code, pickup_code_attempts, admin_note,
              reviewed_at, picked_up_at, refunded_at, created_at, updated_at
       FROM return_requests
       WHERE order_id = ?
         AND status <> 'REJECTED'
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId],
    );
    return (rows[0] as ReturnRequestRow) ?? null;
  }

  async findLatestReturnForOrder(orderId: string): Promise<ReturnRequestRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, order_id, user_id, conversation_id, reason, customer_note, status,
              refund_amount_paise, refund_method, refund_status, razorpay_refund_id,
              refund_payout_ref, pickup_code, pickup_code_attempts, admin_note,
              reviewed_at, picked_up_at, refunded_at, created_at, updated_at
       FROM return_requests
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId],
    );
    return (rows[0] as ReturnRequestRow) ?? null;
  }

  async lockReturnById(
    id: string,
    conn: PoolConnection,
  ): Promise<ReturnRequestRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT rr.id, rr.order_id, rr.user_id, rr.conversation_id, rr.reason, rr.customer_note,
              rr.status, rr.refund_amount_paise, rr.refund_method, rr.refund_status,
              rr.razorpay_refund_id, rr.refund_payout_ref, rr.pickup_code,
              rr.pickup_code_attempts, rr.admin_note, rr.reviewed_at, rr.picked_up_at,
              rr.refunded_at, rr.created_at, rr.updated_at,
              o.order_number,
              p.method AS payment_method,
              p.status AS payment_status,
              p.razorpay_payment_id
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE rr.id = ?
       LIMIT 1
       FOR UPDATE`,
      [id],
    );
    return (rows[0] as ReturnRequestRow) ?? null;
  }

  async findReturnById(id: string): Promise<ReturnRequestRow | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT rr.id, rr.order_id, rr.user_id, rr.conversation_id, rr.reason, rr.customer_note,
              rr.status, rr.refund_amount_paise, rr.refund_method, rr.refund_status,
              rr.razorpay_refund_id, rr.refund_payout_ref, rr.pickup_code,
              rr.pickup_code_attempts, rr.admin_note, rr.reviewed_at, rr.picked_up_at,
              rr.refunded_at, rr.created_at, rr.updated_at,
              o.order_number,
              p.method AS payment_method,
              p.status AS payment_status,
              p.razorpay_payment_id
       FROM return_requests rr
       INNER JOIN orders o ON o.id = rr.order_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE rr.id = ?
       LIMIT 1`,
      [id],
    );
    return (rows[0] as ReturnRequestRow) ?? null;
  }

  async listReturnItemSummaries(
    returnRequestIds: string[],
  ): Promise<Map<string, Array<{ productName: string; variantLabel: string; quantity: number }>>> {
    const grouped = new Map<string, Array<{ productName: string; variantLabel: string; quantity: number }>>();
    if (returnRequestIds.length === 0) return grouped;
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT rri.return_request_id, rri.quantity, oi.product_name, oi.variant_label
       FROM return_request_items rri
       INNER JOIN order_items oi ON oi.id = rri.order_item_id
       WHERE rri.return_request_id IN (?)
       ORDER BY rri.created_at ASC`,
      [returnRequestIds],
    );
    for (const row of rows) {
      const requestId = row.return_request_id as string;
      const items = grouped.get(requestId) ?? [];
      items.push({
        productName: (row.product_name as string | null) ?? '',
        variantLabel: (row.variant_label as string | null) ?? '',
        quantity: Number(row.quantity),
      });
      grouped.set(requestId, items);
    }
    return grouped;
  }

  async listReturnItems(returnRequestId: string): Promise<ReturnItemRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT rri.id, rri.return_request_id, rri.order_item_id, rri.quantity, rri.note,
              rri.line_refund_paise, oi.product_name, oi.variant_label,
              p.image_url AS product_image_url
       FROM return_request_items rri
       INNER JOIN order_items oi ON oi.id = rri.order_item_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE rri.return_request_id = ?
       ORDER BY rri.created_at ASC`,
      [returnRequestId],
    );
    return rows as ReturnItemRow[];
  }

  async insertReturnRequest(
    input: {
      orderId: string;
      userId: string;
      conversationId: string | null;
      customerNote: string;
      refundAmountPaise: number;
      refundMethod: 'RAZORPAY' | 'MANUAL';
      pickupCode: string;
      items: Array<{
        orderItemId: string;
        quantity: number;
        note: string | null;
        lineRefundPaise: number;
      }>;
    },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO return_requests (
         id, order_id, user_id, conversation_id, reason, customer_note,
         refund_amount_paise, refund_method, pickup_code
       ) VALUES (?, ?, ?, ?, 'DAMAGED', ?, ?, ?, ?)`,
      [
        id,
        input.orderId,
        input.userId,
        input.conversationId,
        input.customerNote,
        input.refundAmountPaise,
        input.refundMethod,
        input.pickupCode,
      ],
    );
    for (const item of input.items) {
      await conn.query(
        `INSERT INTO return_request_items (
           id, return_request_id, order_item_id, quantity, note, line_refund_paise
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          id,
          item.orderItemId,
          item.quantity,
          item.note,
          item.lineRefundPaise,
        ],
      );
    }
    return id;
  }

  async updateReturnStatus(
    id: string,
    input: {
      status: string;
      refundStatus?: string;
      adminNote?: string | null;
      reviewedByAdminId?: string | null;
      razorpayRefundId?: string | null;
      payoutRef?: string | null;
      incrementPickupAttempts?: boolean;
    },
    conn: Pool | PoolConnection = this.db,
  ): Promise<void> {
    await conn.query(
      `UPDATE return_requests
       SET status = ?,
           refund_status = COALESCE(?, refund_status),
           admin_note = COALESCE(?, admin_note),
           reviewed_by_admin_id = COALESCE(?, reviewed_by_admin_id),
           reviewed_at = CASE WHEN ? IS NULL THEN reviewed_at ELSE CURRENT_TIMESTAMP END,
           picked_up_at = CASE WHEN ? IN ('PICKED_UP', 'REFUND_PENDING') THEN CURRENT_TIMESTAMP ELSE picked_up_at END,
           refunded_at = CASE WHEN ? = 'REFUNDED' THEN CURRENT_TIMESTAMP ELSE refunded_at END,
           razorpay_refund_id = COALESCE(?, razorpay_refund_id),
           refund_payout_ref = COALESCE(?, refund_payout_ref),
           pickup_code_attempts = pickup_code_attempts + ?
       WHERE id = ?`,
      [
        input.status,
        input.refundStatus ?? null,
        input.adminNote ?? null,
        input.reviewedByAdminId ?? null,
        input.reviewedByAdminId ? 1 : null,
        input.status,
        input.status,
        input.razorpayRefundId ?? null,
        input.payoutRef ?? null,
        input.incrementPickupAttempts ? 1 : 0,
        id,
      ],
    );
  }

  async insertReturnPhotos(
    returnRequestId: string,
    imageUrls: string[],
    conn: PoolConnection,
  ): Promise<void> {
    for (const imageUrl of imageUrls) {
      await conn.query(
        `INSERT INTO return_request_photos (id, return_request_id, image_url)
         VALUES (?, ?, ?)`,
        [createId(), returnRequestId, imageUrl],
      );
    }
  }

  async listReturnPhotos(returnRequestId: string): Promise<ReturnPhotoRow[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT id, return_request_id, image_url, created_at
       FROM return_request_photos
       WHERE return_request_id = ?
       ORDER BY created_at ASC`,
      [returnRequestId],
    );
    return rows as ReturnPhotoRow[];
  }

  async findCompletedDeliveryPartner(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<string | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT delivery_partner_id
       FROM delivery_assignments
       WHERE order_id = ?
         AND purpose = 'DELIVERY'
         AND status = 'COMPLETED'
       ORDER BY completed_at DESC
       LIMIT 1`,
      [orderId],
    );
    return (rows[0]?.delivery_partner_id as string | undefined) ?? null;
  }

  async findActiveReturnAssignment(
    returnRequestId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<{ id: string; delivery_partner_id: string; status: string } | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, delivery_partner_id, status
       FROM delivery_assignments
       WHERE return_request_id = ?
         AND status IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS')
       LIMIT 1
       FOR UPDATE`,
      [returnRequestId],
    );
    return (rows[0] as { id: string; delivery_partner_id: string; status: string } | undefined) ?? null;
  }

  async latestReturnStatusByOrderIds(orderIds: string[]): Promise<Map<string, string>> {
    if (orderIds.length === 0) return new Map();
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT order_id, status
       FROM return_requests
       WHERE order_id IN (?)
       ORDER BY created_at DESC`,
      [orderIds],
    );
    const statuses = new Map<string, string>();
    for (const row of rows) {
      const orderId = row.order_id as string;
      if (!statuses.has(orderId)) statuses.set(orderId, row.status as string);
    }
    return statuses;
  }
}
