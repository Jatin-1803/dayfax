import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { createId } from '../../common/utils/id.js';

export type PaymentAttemptStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'CAPTURED'
  | 'FAILED'
  | 'EXPIRED'
  | 'AMOUNT_MISMATCH'
  | 'REFUNDED';

export type PaymentVerificationSource = 'checkout' | 'webhook' | 'manual_check' | 'cash';

export type WebhookProcessingStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';

export interface PaymentAttemptRow {
  id: string;
  order_id: string;
  payment_id: string;
  provider: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_qr_id: string | null;
  amount_paise: number;
  status: PaymentAttemptStatus;
  verification_source: PaymentVerificationSource | null;
  image_url: string | null;
  expires_at: Date | null;
  notes_json: string | Record<string, unknown> | null;
  verified_at: Date | null;
}

export interface WebhookEventRow {
  id: string;
  event_id: string;
  event_type: string;
  processing_status: WebhookProcessingStatus;
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string; errno?: number }).code;
  const errno = (error as { errno?: number }).errno;
  return code === 'ER_DUP_ENTRY' || errno === 1062;
}

export class PaymentAttemptsRepository {
  constructor(private readonly db: Pool = getPool()) {}

  async insertAttempt(
    input: {
      orderId: string;
      paymentId: string;
      provider: string;
      amountPaise: number;
      status?: PaymentAttemptStatus;
      notes?: Record<string, string>;
    },
    conn: PoolConnection,
  ): Promise<string> {
    const id = createId();
    await conn.query(
      `INSERT INTO payment_attempts (
         id, order_id, payment_id, provider, amount_paise, status, notes_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.orderId,
        input.paymentId,
        input.provider,
        input.amountPaise,
        input.status ?? 'CREATED',
        input.notes ? JSON.stringify(input.notes) : null,
      ],
    );
    return id;
  }

  async findReusableQrAttempt(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE order_id = ?
         AND status = 'CREATED'
         AND razorpay_qr_id IS NOT NULL
         AND image_url IS NOT NULL
         AND expires_at > DATE_ADD(NOW(), INTERVAL 60 SECOND)
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async findLatestOpenAttempt(
    orderId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE order_id = ?
         AND status IN ('CREATED', 'PROCESSING')
         AND razorpay_qr_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async findByQrId(
    qrId: string,
    conn: Pool | PoolConnection = this.db,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE razorpay_qr_id = ?
       LIMIT 1`,
      [qrId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async lockLatestOpenAttempt(
    orderId: string,
    conn: PoolConnection,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE order_id = ?
         AND status IN ('CREATED', 'PROCESSING', 'AMOUNT_MISMATCH')
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [orderId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async lockAttemptById(
    attemptId: string,
    conn: PoolConnection,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [attemptId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async lockAttemptByQrId(
    qrId: string,
    conn: PoolConnection,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE razorpay_qr_id = ?
       LIMIT 1
       FOR UPDATE`,
      [qrId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async lockAttemptByRazorpayPaymentId(
    paymentId: string,
    conn: PoolConnection,
  ): Promise<PaymentAttemptRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, order_id, payment_id, provider, razorpay_order_id, razorpay_payment_id,
              razorpay_qr_id, amount_paise, status, verification_source, image_url, expires_at,
              notes_json, verified_at
       FROM payment_attempts
       WHERE razorpay_payment_id = ?
       LIMIT 1
       FOR UPDATE`,
      [paymentId],
    );
    return (rows[0] as PaymentAttemptRow) ?? null;
  }

  async attachQr(
    attemptId: string,
    fields: {
      razorpayQrId: string;
      imageUrl: string;
      expiresAt: Date;
      notes?: Record<string, string>;
    },
    conn: PoolConnection,
  ): Promise<void> {
    await conn.query(
      `UPDATE payment_attempts
       SET razorpay_qr_id = ?, image_url = ?, expires_at = ?, notes_json = ?
       WHERE id = ?`,
      [
        fields.razorpayQrId,
        fields.imageUrl,
        fields.expiresAt,
        fields.notes ? JSON.stringify(fields.notes) : null,
        attemptId,
      ],
    );
  }

  async updateAttempt(
    attemptId: string,
    fields: {
      status?: PaymentAttemptStatus;
      razorpayPaymentId?: string | null;
      verificationSource?: PaymentVerificationSource | null;
      verifiedAt?: Date | null;
    },
    conn: PoolConnection,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.status !== undefined) {
      sets.push('status = ?');
      values.push(fields.status);
    }
    if (fields.razorpayPaymentId !== undefined) {
      sets.push('razorpay_payment_id = ?');
      values.push(fields.razorpayPaymentId);
    }
    if (fields.verificationSource !== undefined) {
      sets.push('verification_source = ?');
      values.push(fields.verificationSource);
    }
    if (fields.verifiedAt !== undefined) {
      sets.push('verified_at = ?');
      values.push(fields.verifiedAt);
    }
    if (sets.length === 0) return;
    await conn.query(`UPDATE payment_attempts SET ${sets.join(', ')} WHERE id = ?`, [
      ...values,
      attemptId,
    ]);
  }

  async expireOpenQrAttempts(orderId: string, conn: PoolConnection): Promise<void> {
    await conn.query(
      `UPDATE payment_attempts
       SET status = 'EXPIRED'
       WHERE order_id = ?
         AND provider = 'razorpay_qr'
         AND status IN ('CREATED', 'PROCESSING')`,
      [orderId],
    );
  }

  async markAttemptFailed(attemptId: string, conn: Pool | PoolConnection = this.db): Promise<void> {
    await conn.query(
      `UPDATE payment_attempts SET status = 'FAILED' WHERE id = ? AND status = 'CREATED'`,
      [attemptId],
    );
  }

  async insertWebhookEvent(
    input: {
      eventId: string;
      eventType: string;
      razorpayPaymentId?: string | null;
      razorpayOrderId?: string | null;
      razorpayQrId?: string | null;
      internalOrderId?: string | null;
      payload?: Record<string, unknown> | null;
    },
    conn: PoolConnection,
  ): Promise<{ id: string; inserted: boolean }> {
    const id = createId();
    try {
      await conn.query(
        `INSERT INTO razorpay_webhook_events (
           id, event_id, event_type, razorpay_payment_id, razorpay_order_id, razorpay_qr_id,
           internal_order_id, payload_json, processing_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED')`,
        [
          id,
          input.eventId,
          input.eventType,
          input.razorpayPaymentId ?? null,
          input.razorpayOrderId ?? null,
          input.razorpayQrId ?? null,
          input.internalOrderId ?? null,
          input.payload ? JSON.stringify(input.payload) : null,
        ],
      );
      return { id, inserted: true };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const existing = await this.lockWebhookEvent(input.eventId, conn);
      return { id: existing?.id ?? id, inserted: false };
    }
  }

  async lockWebhookEvent(eventId: string, conn: PoolConnection): Promise<WebhookEventRow | null> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id, event_id, event_type, processing_status
       FROM razorpay_webhook_events
       WHERE event_id = ?
       LIMIT 1
       FOR UPDATE`,
      [eventId],
    );
    return (rows[0] as WebhookEventRow) ?? null;
  }

  async updateWebhookEvent(
    eventId: string,
    fields: {
      processingStatus: WebhookProcessingStatus;
      internalOrderId?: string | null;
      razorpayPaymentId?: string | null;
      razorpayQrId?: string | null;
    },
    conn: PoolConnection,
  ): Promise<void> {
    const sets = ['processing_status = ?', 'processed_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [fields.processingStatus];
    if (fields.internalOrderId !== undefined) {
      sets.push('internal_order_id = ?');
      values.push(fields.internalOrderId);
    }
    if (fields.razorpayPaymentId !== undefined) {
      sets.push('razorpay_payment_id = ?');
      values.push(fields.razorpayPaymentId);
    }
    if (fields.razorpayQrId !== undefined) {
      sets.push('razorpay_qr_id = ?');
      values.push(fields.razorpayQrId);
    }
    await conn.query(`UPDATE razorpay_webhook_events SET ${sets.join(', ')} WHERE event_id = ?`, [
      ...values,
      eventId,
    ]);
  }
}
