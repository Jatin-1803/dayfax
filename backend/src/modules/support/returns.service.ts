import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { generateDeliveryOtp } from '../orders/delivery-otp.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { isRazorpayConfigured, refundPayment } from '../payments/razorpay.client.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { pushToUser, schedulePush } from '../notifications/push.service.js';
import { SupportRepository, type ReturnRequestRow } from './support.repository.js';
import { refundSentLine, supportLang } from './support-customer-lines.js';

const CUSTOMER_VISIBLE_PICKUP_STATUSES = new Set([
  'APPROVED',
  'PICKUP_IN_PROGRESS',
  'PICKED_UP',
  'REFUND_PENDING',
  'REFUNDED',
]);

export function mapReturnForCustomer(row: ReturnRequestRow | null) {
  if (!row) return null;
  const showPickupCode = CUSTOMER_VISIBLE_PICKUP_STATUSES.has(row.status);
  return {
    id: row.id,
    status: row.status,
    reason: row.reason,
    customerNote: row.customer_note,
    refundAmountPaise: row.refund_amount_paise,
    refundMethod: row.refund_method,
    refundStatus: row.refund_status,
    pickupCode: showPickupCode ? row.pickup_code : null,
    adminNote: row.status === 'REJECTED' ? row.admin_note : null,
    createdAt: row.created_at,
  };
}

export class ReturnsService {
  constructor(
    private readonly support = new SupportRepository(),
    private readonly orders = new OrdersRepository(),
    private readonly notifications = new NotificationsRepository(),
  ) {}

  async createDamagedReturn(input: {
    orderId: string;
    userId: string;
    conversationId: string | null;
    customerNote: string;
    items: Array<{ orderItemId: string; quantity: number; note?: string }>;
    photoUrls: string[];
  }): Promise<ReturnRequestRow> {
    const created = await withTransaction(async (conn) => {
      const order = await this.orders.lockOrderById(input.orderId, conn);
      if (!order || order.user_id !== input.userId) {
        throw new NotFoundError('Order not found');
      }
      if (order.status !== 'DELIVERED') {
        throw new ValidationError('Returns are available only after delivery');
      }

      const existing = await this.support.findBlockingReturn(order.id, conn);
      if (existing) {
        throw new ConflictError('A return request is already open for this order');
      }

      const orderItems = await this.orders.listItems(order.id, conn);
      const byId = new Map(orderItems.map((item) => [item.id, item]));
      const seen = new Set<string>();
      const priced: Array<{
        orderItemId: string;
        quantity: number;
        note: string | null;
        lineRefundPaise: number;
      }> = [];

      for (const item of input.items) {
        if (seen.has(item.orderItemId)) {
          throw new ValidationError('Each item can be added only once');
        }
        seen.add(item.orderItemId);
        const ordered = byId.get(item.orderItemId);
        if (!ordered) {
          throw new ValidationError('One of the items is not part of this order');
        }
        if (ordered.is_local_shop) {
          throw new ValidationError('returns.local_shop_not_eligible');
        }
        if (item.quantity > ordered.quantity) {
          throw new ValidationError('Return quantity cannot be more than what was ordered');
        }
        const lineRefundPaise = Math.min(
          ordered.unit_price_paise * item.quantity,
          ordered.line_total_paise,
        );
        priced.push({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          note: item.note?.trim() || null,
          lineRefundPaise,
        });
      }

      if (priced.length === 0) {
        throw new ValidationError('returns.local_shop_not_eligible');
      }
      if (input.photoUrls.length < 1 || input.photoUrls.length > 3) {
        throw new ValidationError('returns.photo_required');
      }

      const payment = await this.orders.lockPaymentByOrderId(order.id, conn);
      const refundMethod =
        payment?.status === 'CAPTURED' &&
        payment.method !== 'COD' &&
        payment.razorpay_payment_id
          ? 'RAZORPAY'
          : 'MANUAL';

      const id = await this.support.insertReturnRequest(
        {
          orderId: order.id,
          userId: input.userId,
          conversationId: input.conversationId,
          customerNote: input.customerNote.trim(),
          refundAmountPaise: priced.reduce((sum, item) => sum + item.lineRefundPaise, 0),
          refundMethod,
          pickupCode: generateDeliveryOtp(),
          items: priced,
        },
        conn,
      );

      await this.support.insertReturnPhotos(id, input.photoUrls, conn);
      if (input.conversationId) {
        await this.support.updateConversationPrefs(
          input.conversationId,
          { itemPickerOpen: false },
          conn,
        );
      }

      await this.notifications.create(
        {
          userId: order.user_id,
          title: 'Return request received',
          body: `We have your request for order ${order.order_number}. The team will review it shortly.`,
          meta: { orderId: order.id, returnRequestId: id, type: 'RETURN_REQUESTED' },
        },
        conn,
      );

      const created = await this.support.lockReturnById(id, conn);
      if (!created) throw new NotFoundError('Return request not found');
      return created;
    });

    schedulePush(() =>
      pushToUser({
        userId: created.user_id,
        appRole: 'CUSTOMER',
        copyKey: 'return_requested',
        orderId: created.order_id,
        orderNumber: created.order_number ?? '',
      }),
    );
    return created;
  }

  async completePickupRefund(returnRequestId: string): Promise<void> {
    const planned = await withTransaction(async (conn) => {
      const request = await this.support.lockReturnById(returnRequestId, conn);
      if (!request) throw new NotFoundError('Return request not found');
      if (request.status !== 'PICKUP_IN_PROGRESS') {
        throw new ValidationError('This return is not ready to complete');
      }

      if (request.refund_method === 'MANUAL') {
        await this.support.updateReturnStatus(
          request.id,
          { status: 'REFUND_PENDING', refundStatus: 'PENDING' },
          conn,
        );
        await this.notifications.create(
          {
            userId: request.user_id,
            title: 'Items picked up',
            body: `We collected the items from order ${request.order_number}. We will send the money shortly.`,
            meta: { orderId: request.order_id, returnRequestId: request.id, type: 'RETURN_PICKED_UP' },
          },
          conn,
        );
        return { kind: 'MANUAL' as const };
      }

      await this.support.updateReturnStatus(
        request.id,
        { status: 'PICKED_UP', refundStatus: 'PROCESSING' },
        conn,
      );
      return {
        kind: 'RAZORPAY' as const,
        paymentId: request.razorpay_payment_id,
        amountPaise: request.refund_amount_paise,
        userId: request.user_id,
        orderId: request.order_id,
        orderNumber: request.order_number ?? '',
      };
    });

    if (planned.kind === 'MANUAL') {
      const request = await this.support.findReturnById(returnRequestId);
      if (request) {
        schedulePush(() =>
          pushToUser({
            userId: request.user_id,
            appRole: 'CUSTOMER',
            copyKey: 'return_picked_up',
            orderId: request.order_id,
            orderNumber: request.order_number ?? '',
          }),
        );
      }
      return;
    }
    await this.settleRazorpayReturn({
      returnRequestId,
      razorpayPaymentId: planned.paymentId ?? null,
      amountPaise: planned.amountPaise,
      userId: planned.userId,
      orderId: planned.orderId,
      orderNumber: planned.orderNumber,
    });
  }

  async settleRazorpayReturn(input: {
    returnRequestId: string;
    razorpayPaymentId: string | null;
    amountPaise: number;
    userId: string;
    orderId: string;
    orderNumber: string;
  }): Promise<void> {
    if (!input.razorpayPaymentId || !isRazorpayConfigured()) {
      await this.support.updateReturnStatus(input.returnRequestId, {
        status: 'PICKED_UP',
        refundStatus: 'FAILED',
      });
      return;
    }

    try {
      const refund = await refundPayment({
        razorpayPaymentId: input.razorpayPaymentId,
        amountPaise: input.amountPaise,
      });
      await this.support.updateReturnStatus(input.returnRequestId, {
        status: 'REFUNDED',
        refundStatus: 'PAID',
        razorpayRefundId: refund.id,
      });
      const request = await this.support.findReturnById(input.returnRequestId);
      if (request?.conversation_id) {
        const conversation = await this.support.findConversationByOrderId(request.order_id);
        await this.support.addMessage({
          conversationId: request.conversation_id,
          sender: 'AGENT',
          body: refundSentLine(supportLang(conversation?.lang)),
        });
      }
      await this.notifications.create({
        userId: input.userId,
        title: 'Refund sent',
        body: `The refund for order ${input.orderNumber} has been sent to your original payment method.`,
        meta: { orderId: input.orderId, returnRequestId: input.returnRequestId, type: 'RETURN_REFUNDED' },
      });
      schedulePush(() =>
        pushToUser({
          userId: input.userId,
          appRole: 'CUSTOMER',
          copyKey: 'refund_sent',
          orderId: input.orderId,
          orderNumber: input.orderNumber,
        }),
      );
    } catch {
      await this.support.updateReturnStatus(input.returnRequestId, {
        status: 'PICKED_UP',
        refundStatus: 'FAILED',
      });
    }
  }
}
