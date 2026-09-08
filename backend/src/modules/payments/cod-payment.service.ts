import type { PoolConnection } from 'mysql2/promise';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { logger } from '../../common/logger/logger.js';
import { withTransaction } from '../../common/database/pool.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { generateDeliveryOtp } from '../orders/delivery-otp.js';
import { decidePaymentCapture } from '../orders/order-acceptance.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { DeliveryRepository } from '../delivery/delivery.repository.js';
import {
  createQrCode,
  isRazorpayConfigured,
  listQrPayments,
  type RazorpayPaymentEntity,
} from './razorpay.client.js';
import {
  PaymentAttemptsRepository,
  type PaymentVerificationSource,
} from './payment-attempts.repository.js';

export const QR_TTL_SECONDS = 30 * 60;

export type CodConfirmOutcome =
  | 'CAPTURED'
  | 'ALREADY_CAPTURED'
  | 'AMOUNT_MISMATCH'
  | 'PENDING'
  | 'IGNORED'
  | 'FAILED';

export interface ConfirmCodPaymentInput {
  orderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  source: PaymentVerificationSource;
  razorpayQrId?: string | null;
  razorpayOrderId?: string | null;
  notesOrderId?: string | null;
}

export function notesOrderId(notes: Record<string, string> | null | undefined): string | null {
  if (!notes) return null;
  return notes.internal_order_id || notes.orderId || null;
}

export class CodPaymentService {
  constructor(
    private readonly ordersRepo = new OrdersRepository(),
    private readonly attemptsRepo = new PaymentAttemptsRepository(),
    private readonly deliveryRepo = new DeliveryRepository(),
    private readonly notificationsRepo = new NotificationsRepository(),
  ) {}

  async createOrReuseQr(partnerId: string, orderId: string) {
    const context = await this.requireAssignedCod(partnerId, orderId);
    if (context.payment.status === 'CAPTURED') {
      return {
        status: 'CAPTURED' as const,
        amountPaise: context.payment.amount_paise,
        qrId: null as string | null,
        imageUrl: null as string | null,
        attemptId: null as string | null,
      };
    }

    const reusable = await this.attemptsRepo.findReusableQrAttempt(orderId);
    if (reusable?.razorpay_qr_id && reusable.image_url) {
      return {
        status: 'CREATED' as const,
        amountPaise: reusable.amount_paise,
        qrId: reusable.razorpay_qr_id,
        imageUrl: reusable.image_url,
        attemptId: reusable.id,
      };
    }

    if (!isRazorpayConfigured()) {
      throw new ValidationError('Online payments are not configured');
    }

    const expectedAmount = context.payment.amount_paise;
    const attemptId = await withTransaction(async (conn) => {
      const payment = await this.ordersRepo.lockPaymentByOrderId(orderId, conn);
      if (!payment || payment.method !== 'COD' || payment.status === 'CAPTURED') {
        throw new ValidationError('Payment cannot be collected for this order');
      }
      return this.attemptsRepo.insertAttempt(
        {
          orderId,
          paymentId: payment.id,
          provider: 'razorpay_qr',
          amountPaise: payment.amount_paise,
          notes: {
            internal_order_id: orderId,
            order_number: context.orderNumber,
          },
        },
        conn,
      );
    });

    const closeByUnix = Math.floor(Date.now() / 1000) + QR_TTL_SECONDS;
    try {
      const qr = await createQrCode({
        amountPaise: expectedAmount,
        name: 'DayFax',
        description: `Order ${context.orderNumber}`,
        closeByUnix,
        notes: {
          internal_order_id: orderId,
          payment_attempt_id: attemptId,
          order_number: context.orderNumber,
        },
      });

      await withTransaction(async (conn) => {
        await this.attemptsRepo.attachQr(
          attemptId,
          {
            razorpayQrId: qr.id,
            imageUrl: qr.image_url,
            expiresAt: new Date(closeByUnix * 1000),
            notes: {
              internal_order_id: orderId,
              payment_attempt_id: attemptId,
              order_number: context.orderNumber,
            },
          },
          conn,
        );
        await this.ordersRepo.updatePayment(
          context.payment.id,
          { razorpayQrId: qr.id },
          conn,
        );
      });

      logger.info('payment_initiated', {
        orderId,
        attemptId,
        qrId: qr.id,
        amountPaise: expectedAmount,
      });

      return {
        status: 'CREATED' as const,
        amountPaise: expectedAmount,
        qrId: qr.id,
        imageUrl: qr.image_url,
        attemptId,
      };
    } catch (error) {
      await this.attemptsRepo.markAttemptFailed(attemptId);
      throw error;
    }
  }

  async checkPayment(partnerId: string, orderId: string) {
    const context = await this.requireAssignedCod(partnerId, orderId);
    if (context.payment.status === 'CAPTURED') {
      return { status: 'CAPTURED' as const, amountPaise: context.payment.amount_paise };
    }

    const attempt = await this.attemptsRepo.findLatestOpenAttempt(orderId);
    if (!attempt?.razorpay_qr_id) {
      logger.info('manual_payment_check', { orderId, partnerId, result: 'PENDING' });
      return { status: 'PENDING' as const, amountPaise: context.payment.amount_paise };
    }

    let payments: RazorpayPaymentEntity[];
    try {
      payments = await listQrPayments(attempt.razorpay_qr_id);
    } catch (error) {
      logger.warn('manual_payment_check', {
        orderId,
        partnerId,
        result: 'PAYMENT_VERIFICATION_PENDING',
      });
      throw error;
    }

    const captured = payments.find((item) => item.status === 'captured');
    if (!captured) {
      const failed = payments.find((item) => item.status === 'failed');
      logger.info('manual_payment_check', {
        orderId,
        partnerId,
        result: failed ? 'FAILED' : 'PENDING',
      });
      return {
        status: failed ? ('FAILED' as const) : ('PENDING' as const),
        amountPaise: context.payment.amount_paise,
      };
    }

    const outcome = await this.confirmCodPayment({
      orderId,
      razorpayPaymentId: captured.id,
      amountPaise: captured.amount,
      source: 'manual_check',
      razorpayQrId: attempt.razorpay_qr_id,
      notesOrderId: notesOrderId(captured.notes),
    });

    logger.info('manual_payment_check', { orderId, partnerId, result: outcome });
    return this.outcomeToCheckResult(outcome, context.payment.amount_paise);
  }

  async collectCash(partnerId: string, orderId: string) {
    const context = await this.requireAssignedCod(partnerId, orderId);
    if (context.payment.status === 'CAPTURED') {
      return { status: 'CAPTURED' as const, amountPaise: context.payment.amount_paise };
    }

    return withTransaction(async (conn) => {
      const payment = await this.ordersRepo.lockPaymentByOrderId(orderId, conn);
      if (!payment || payment.method !== 'COD') {
        throw new ValidationError('Payment cannot be collected for this order');
      }
      if (payment.status === 'CAPTURED') {
        return { status: 'CAPTURED' as const, amountPaise: payment.amount_paise };
      }

      const order = await this.ordersRepo.lockOrderById(orderId, conn);
      if (!order || order.status === 'CANCELLED') {
        throw new AppError('This order was cancelled.', {
          statusCode: 409,
          code: 'ORDER_CANCELLED',
        });
      }
      if (order.status === 'DELIVERED') {
        throw new AppError('This order has already been delivered.', {
          statusCode: 409,
          code: 'ORDER_ALREADY_DELIVERED',
        });
      }

      const now = new Date();
      const attemptId = await this.attemptsRepo.insertAttempt(
        {
          orderId,
          paymentId: payment.id,
          provider: 'cash',
          amountPaise: payment.amount_paise,
          status: 'CAPTURED',
          notes: {
            internal_order_id: orderId,
            order_number: context.orderNumber,
            collected_by: partnerId,
          },
        },
        conn,
      );
      await this.attemptsRepo.updateAttempt(
        attemptId,
        { verificationSource: 'cash', verifiedAt: now },
        conn,
      );
      await this.attemptsRepo.expireOpenQrAttempts(orderId, conn);
      await this.ordersRepo.updatePayment(
        payment.id,
        {
          status: 'CAPTURED',
          provider: 'cash',
          providerRef: 'cash',
          verificationSource: 'cash',
          paidAt: now,
        },
        conn,
      );
      await this.ordersRepo.ensureDeliveryOtp(orderId, generateDeliveryOtp(), conn);
      await this.notificationsRepo.create(
        {
          userId: order.user_id,
          title: 'Cash collected',
          body: `Cash received for order ${order.order_number}. Share the delivery OTP with your partner.`,
          meta: {
            type: 'order',
            orderId: order.id,
            orderNumber: order.order_number,
          },
        },
        conn,
      );

      logger.info('cash_collected', {
        orderId,
        partnerId,
        amountPaise: payment.amount_paise,
      });
      return { status: 'CAPTURED' as const, amountPaise: payment.amount_paise };
    });
  }

  async confirmCodPayment(input: ConfirmCodPaymentInput): Promise<CodConfirmOutcome> {
    if (input.notesOrderId && input.notesOrderId !== input.orderId) {
      logger.warn('payment_order_mismatch', {
        orderId: input.orderId,
        notesOrderId: input.notesOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
      });
      return 'IGNORED';
    }

    return withTransaction(async (conn) => {
      const payment = await this.ordersRepo.lockPaymentByOrderId(input.orderId, conn);
      if (!payment) return 'IGNORED';

      const attempt = await this.lockMatchingAttempt(input, conn);
      const expectedAmount = attempt?.amount_paise ?? payment.amount_paise;
      const decision = decidePaymentCapture({
        orderId: input.orderId,
        paymentMethod: payment.method,
        paymentStatus: payment.status,
        existingPaymentId: payment.razorpay_payment_id ?? null,
        incomingPaymentId: input.razorpayPaymentId,
        expectedAmountPaise: expectedAmount,
        receivedAmountPaise: input.amountPaise,
        notesOrderId: input.notesOrderId,
      });

      if (decision === 'ALREADY_CAPTURED' || decision === 'IGNORED') {
        return decision === 'ALREADY_CAPTURED' ? 'ALREADY_CAPTURED' : 'IGNORED';
      }

      if (decision === 'AMOUNT_MISMATCH') {
        if (attempt) {
          await this.attemptsRepo.updateAttempt(
            attempt.id,
            {
              status: 'AMOUNT_MISMATCH',
              razorpayPaymentId: input.razorpayPaymentId,
              verificationSource: input.source,
              verifiedAt: new Date(),
            },
            conn,
          );
        }
        logger.warn('payment_amount_mismatch', {
          orderId: input.orderId,
          expectedAmountPaise: expectedAmount,
          receivedAmountPaise: input.amountPaise,
          razorpayPaymentId: input.razorpayPaymentId,
          source: input.source,
        });
        return 'AMOUNT_MISMATCH';
      }

      if (payment.method !== 'COD') {
        return 'IGNORED';
      }

      const now = new Date();
      if (attempt && attempt.status !== 'CAPTURED') {
        await this.attemptsRepo.updateAttempt(
          attempt.id,
          {
            status: 'CAPTURED',
            razorpayPaymentId: input.razorpayPaymentId,
            verificationSource: input.source,
            verifiedAt: now,
          },
          conn,
        );
      }

      await this.ordersRepo.updatePayment(
        payment.id,
        {
          status: 'CAPTURED',
          razorpayPaymentId: input.razorpayPaymentId,
          razorpayQrId: input.razorpayQrId ?? attempt?.razorpay_qr_id ?? null,
          razorpayOrderId: input.razorpayOrderId ?? null,
          verificationSource: input.source,
          paidAt: now,
        },
        conn,
      );

      const order = await this.ordersRepo.lockOrderById(input.orderId, conn);
      if (order && order.status !== 'CANCELLED' && order.status !== 'DELIVERED') {
        await this.ordersRepo.ensureDeliveryOtp(input.orderId, generateDeliveryOtp(), conn);
        await this.notificationsRepo.create(
          {
            userId: order.user_id,
            title: 'Payment received',
            body: `Payment received for order ${order.order_number}. Share the delivery OTP with your partner.`,
            meta: {
              type: 'order',
              orderId: order.id,
              orderNumber: order.order_number,
            },
          },
          conn,
        );
      }

      logger.info('payment_verified', {
        orderId: input.orderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amountPaise: input.amountPaise,
        source: input.source,
      });
      return 'CAPTURED';
    });
  }

  private async lockMatchingAttempt(input: ConfirmCodPaymentInput, conn: PoolConnection) {
    if (input.razorpayQrId) {
      const byQr = await this.attemptsRepo.lockAttemptByQrId(input.razorpayQrId, conn);
      if (byQr && byQr.order_id === input.orderId) return byQr;
    }
    const byPayment = await this.attemptsRepo.lockAttemptByRazorpayPaymentId(
      input.razorpayPaymentId,
      conn,
    );
    if (byPayment && byPayment.order_id === input.orderId) return byPayment;
    return this.attemptsRepo.lockLatestOpenAttempt(input.orderId, conn);
  }

  private async requireAssignedCod(partnerId: string, orderId: string) {
    const assignment = await this.deliveryRepo.findActiveAssignmentForOrder(orderId);
    if (!assignment || assignment.delivery_partner_id !== partnerId) {
      throw new ForbiddenError('You are not assigned to this order');
    }
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
      throw new ValidationError('Accept the order before collecting payment');
    }

    const payment = await this.ordersRepo.findPaymentByOrderId(orderId);
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.method !== 'COD') {
      throw new ValidationError('This order is already paid online');
    }

    const summary = await this.deliveryRepo.findOrderNumber(orderId);
    return {
      payment,
      orderNumber: summary?.order_number ?? orderId,
    };
  }

  private outcomeToCheckResult(outcome: CodConfirmOutcome, amountPaise: number) {
    if (outcome === 'CAPTURED' || outcome === 'ALREADY_CAPTURED') {
      return { status: 'CAPTURED' as const, amountPaise };
    }
    if (outcome === 'AMOUNT_MISMATCH') {
      throw new AppError('Payment amount does not match this order. Contact support.', {
        statusCode: 409,
        code: 'PAYMENT_AMOUNT_MISMATCH',
      });
    }
    if (outcome === 'FAILED') {
      return { status: 'FAILED' as const, amountPaise };
    }
    return { status: 'PENDING' as const, amountPaise };
  }
}
