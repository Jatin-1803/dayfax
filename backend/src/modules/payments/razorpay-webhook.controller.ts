import type { Request, Response } from 'express';
import { logger } from '../../common/logger/logger.js';
import { withTransaction } from '../../common/database/pool.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import {
  isRazorpayWebhookConfigured,
  verifyWebhookSignature,
} from './razorpay.client.js';
import { PaymentAttemptsRepository } from './payment-attempts.repository.js';
import { CodPaymentService, notesOrderId } from './cod-payment.service.js';

const HANDLED_EVENTS = new Set(['qr_code.credited', 'payment.captured', 'order.paid']);

interface RazorpayEventBody {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    qr_code?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
}

interface RazorpayEntity {
  id?: string;
  amount?: number;
  status?: string;
  order_id?: string | null;
  notes?: Record<string, string> | null;
}

export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ''), 'utf8');
  const signature = headerValue(req.header('x-razorpay-signature'));

  if (!isRazorpayWebhookConfigured()) {
    logger.warn('razorpay_webhook_signature', { result: 'secret_missing' });
    res.status(503).json({ success: false, message: 'Webhook is not configured' });
    return;
  }

  const valid = verifyWebhookSignature(rawBody, signature);
  logger.info('razorpay_webhook_signature', { result: valid ? 'valid' : 'invalid' });
  if (!valid) {
    res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  let body: RazorpayEventBody;
  try {
    body = JSON.parse(rawBody.toString('utf8')) as RazorpayEventBody;
  } catch {
    res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    return;
  }

  const eventType = body.event ?? 'unknown';
  const eventId =
    headerValue(req.header('x-razorpay-event-id')) ??
    `${eventType}:${body.payload?.payment?.entity?.id ?? 'none'}:${body.payload?.qr_code?.entity?.id ?? 'none'}`;

  const payment = body.payload?.payment?.entity;
  const qr = body.payload?.qr_code?.entity;
  const mappedOrderId = notesOrderId(payment?.notes) ?? notesOrderId(qr?.notes);

  logger.info('razorpay_webhook_received', {
    eventId,
    eventType,
    razorpayPaymentId: payment?.id ?? null,
    razorpayQrId: qr?.id ?? null,
  });

  const attemptsRepo = new PaymentAttemptsRepository();
  const claim = await withTransaction(async (conn) => {
    const inserted = await attemptsRepo.insertWebhookEvent(
      {
        eventId,
        eventType,
        razorpayPaymentId: payment?.id ?? null,
        razorpayOrderId: payment?.order_id ?? null,
        razorpayQrId: qr?.id ?? null,
        internalOrderId: mappedOrderId,
        payload: {
          event: eventType,
          paymentId: payment?.id ?? null,
          amount: payment?.amount ?? null,
          status: payment?.status ?? null,
          qrId: qr?.id ?? null,
        },
      },
      conn,
    );
    if (!inserted.inserted) {
      const existing = await attemptsRepo.lockWebhookEvent(eventId, conn);
      if (!existing || existing.processing_status !== 'FAILED') {
        return { duplicate: true as const };
      }
    }
    return { duplicate: false as const };
  });

  if (claim.duplicate) {
    logger.info('razorpay_webhook_duplicate', { eventId, eventType });
    res.status(200).json({ success: true, message: 'Already processed' });
    return;
  }

  if (!HANDLED_EVENTS.has(eventType)) {
    await withTransaction(async (conn) => {
      await attemptsRepo.updateWebhookEvent(eventId, { processingStatus: 'IGNORED' }, conn);
    });
    res.status(200).json({ success: true, message: 'Ignored' });
    return;
  }

  try {
    const result = await processPaymentEvent({
      eventType,
      payment,
      qr,
      mappedOrderId,
    });
    await withTransaction(async (conn) => {
      await attemptsRepo.updateWebhookEvent(
        eventId,
        {
          processingStatus: result === 'IGNORED' ? 'IGNORED' : 'PROCESSED',
          internalOrderId: mappedOrderId,
          razorpayPaymentId: payment?.id ?? null,
          razorpayQrId: qr?.id ?? null,
        },
        conn,
      );
    });
    res.status(200).json({ success: true, message: 'Processed' });
  } catch (error) {
    logger.error('razorpay_webhook_failed', {
      eventId,
      eventType,
      message: error instanceof Error ? error.message : 'unknown',
    });
    await withTransaction(async (conn) => {
      await attemptsRepo.updateWebhookEvent(eventId, { processingStatus: 'FAILED' }, conn);
    });
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
}

async function processPaymentEvent(input: {
  eventType: string;
  payment?: RazorpayEntity;
  qr?: RazorpayEntity;
  mappedOrderId: string | null;
}): Promise<'PROCESSED' | 'IGNORED'> {
  const payment = input.payment;
  if (!payment?.id || typeof payment.amount !== 'number') {
    return 'IGNORED';
  }
  if (payment.status && payment.status !== 'captured') {
    return 'IGNORED';
  }

  const orderId = await resolveInternalOrderId({
    mappedOrderId: input.mappedOrderId,
    qrId: input.qr?.id ?? null,
    razorpayOrderId: payment.order_id ?? null,
    razorpayPaymentId: payment.id,
  });
  if (!orderId) return 'IGNORED';

  const ordersRepo = new OrdersRepository();
  const existing = await ordersRepo.findPaymentByOrderId(orderId);
  if (!existing) return 'IGNORED';

  if (existing.method === 'COD') {
    const outcome = await new CodPaymentService().confirmCodPayment({
      orderId,
      razorpayPaymentId: payment.id,
      amountPaise: payment.amount,
      source: 'webhook',
      razorpayQrId: input.qr?.id ?? null,
      razorpayOrderId: payment.order_id ?? null,
      notesOrderId: notesOrderId(payment.notes) ?? notesOrderId(input.qr?.notes),
    });
    return outcome === 'IGNORED' ? 'IGNORED' : 'PROCESSED';
  }

  if (existing.status === 'CAPTURED') return 'PROCESSED';
  if (existing.status !== 'PENDING') return 'IGNORED';
  if (payment.amount !== existing.amount_paise) {
    logger.warn('payment_amount_mismatch', {
      orderId,
      expectedAmountPaise: existing.amount_paise,
      receivedAmountPaise: payment.amount,
      razorpayPaymentId: payment.id,
      source: 'webhook',
    });
    return 'PROCESSED';
  }

  await withTransaction(async (conn) => {
    const locked = await ordersRepo.lockPaymentByOrderId(orderId, conn);
    if (!locked || locked.status === 'CAPTURED') return;
    if (locked.status !== 'PENDING') return;
    await ordersRepo.updatePayment(
      locked.id,
      {
        status: 'CAPTURED',
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id ?? locked.provider_ref,
        verificationSource: 'webhook',
        paidAt: new Date(),
      },
      conn,
    );
  });

  logger.info('payment_verified', {
    orderId,
    razorpayPaymentId: payment.id,
    amountPaise: payment.amount,
    source: 'webhook',
    method: existing.method,
  });
  return 'PROCESSED';
}

async function resolveInternalOrderId(input: {
  mappedOrderId: string | null;
  qrId: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string;
}): Promise<string | null> {
  if (input.mappedOrderId) return input.mappedOrderId;

  const attemptsRepo = new PaymentAttemptsRepository();
  if (input.qrId) {
    const attempt = await attemptsRepo.findByQrId(input.qrId);
    if (attempt) return attempt.order_id;
  }
  return null;
}

function headerValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
