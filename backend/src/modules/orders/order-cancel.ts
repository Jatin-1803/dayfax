import { ConflictError, ValidationError } from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { pushToUser, schedulePush } from '../notifications/push.service.js';
import { DeliveryRepository } from '../delivery/delivery.repository.js';
import { isRazorpayConfigured, refundPayment } from '../payments/razorpay.client.js';
import { OrdersRepository } from './orders.repository.js';

export const CUSTOMER_CANCEL_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
] as const;

export type RefundFollowUp = {
  refundMethod: 'RAZORPAY' | 'MANUAL' | null;
  refundStatus: 'NONE' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
};

type LockedPayment = {
  id: string;
  method: string;
  status: string;
  amount_paise: number;
  razorpay_payment_id?: string | null;
};

export class OrderCancelService {
  constructor(
    private readonly orders = new OrdersRepository(),
    private readonly delivery = new DeliveryRepository(),
    private readonly notifications = new NotificationsRepository(),
  ) {}

  async cancel(input: {
    orderId: string;
    actorUserId: string | null;
    note: string;
    source: 'customer' | 'admin';
  }): Promise<RefundFollowUp> {
    const planned = await withTransaction(async (conn) => {
      const order = await this.orders.lockOrderById(input.orderId, conn);
      if (!order) {
        throw new ValidationError('Order not found');
      }
      if (order.status === 'CANCELLED') {
        throw new ConflictError('This order is already cancelled');
      }
      if (order.status === 'DELIVERED') {
        throw new ValidationError('Delivered orders cannot be cancelled');
      }
      if (input.source === 'customer' && order.is_local_shop) {
        throw new ValidationError('orders.local_shop_no_cancel');
      }
      if (
        input.source === 'customer' &&
        !CUSTOMER_CANCEL_STATUSES.includes(order.status as (typeof CUSTOMER_CANCEL_STATUSES)[number])
      ) {
        throw new ValidationError('This order can no longer be cancelled');
      }
      if (input.source === 'admin' && order.status === 'OUT_FOR_DELIVERY') {
        // Admin may cancel while the rider is on the way.
      }

      const items = await this.orders.listItems(order.id, conn);
      for (const item of items) {
        await this.orders.restoreInventory(
          item.store_id || order.store_id,
          item.variant_id,
          item.quantity,
          conn,
        );
      }

      await this.orders.updateOrderStatus(order.id, 'CANCELLED', conn);
      await conn.query(
        `UPDATE orders SET cancelled_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [order.id],
      );
      await this.orders.clearDeliveryOtp(order.id, conn);
      const assignment = await this.delivery.findActiveAssignmentForOrder(order.id, conn);
      const partnerId = assignment?.delivery_partner_id ?? null;
      await this.delivery.cancelActiveAssignments(order.id, conn);
      await this.delivery.deleteAcceptanceLock(order.id, conn);
      await this.orders.addStatusHistory(
        {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          changedByUserId: input.actorUserId ?? undefined,
          note: input.note,
        },
        conn,
      );

      const payment = (await this.orders.lockPaymentByOrderId(order.id, conn)) as LockedPayment | null;
      let followUp: RefundFollowUp = { refundMethod: null, refundStatus: 'NONE' };

      if (payment?.status === 'CAPTURED' && payment.amount_paise > 0) {
        const online =
          payment.method !== 'COD' && Boolean(payment.razorpay_payment_id);
        if (online) {
          await this.orders.markPaymentRefund(
            payment.id,
            { refundStatus: 'PROCESSING' },
            conn,
          );
          followUp = { refundMethod: 'RAZORPAY', refundStatus: 'PROCESSING' };
        } else {
          await this.orders.markPaymentRefund(payment.id, { refundStatus: 'PENDING' }, conn);
          followUp = { refundMethod: 'MANUAL', refundStatus: 'PENDING' };
        }
      }

      const refundLine =
        followUp.refundMethod === 'RAZORPAY'
          ? ' A refund will be sent to your original payment method.'
          : followUp.refundMethod === 'MANUAL'
            ? ' Our team will send your money back shortly.'
            : '';

      await this.notifications.create(
        {
          userId: order.user_id,
          title: 'Order cancelled',
          body: `Order ${order.order_number} was cancelled.${refundLine}`,
          meta: { orderId: order.id, type: 'ORDER_CANCELLED' },
        },
        conn,
      );

      return {
        followUp,
        paymentId: payment?.id ?? null,
        razorpayPaymentId: payment?.razorpay_payment_id ?? null,
        amountPaise: payment?.amount_paise ?? 0,
        customerId: order.user_id,
        orderNumber: order.order_number,
        partnerId,
      };
    });

    schedulePush(() =>
      pushToUser({
        userId: planned.customerId,
        appRole: 'CUSTOMER',
        copyKey: 'order_cancelled',
        orderId: input.orderId,
        orderNumber: planned.orderNumber,
      }),
    );
    if (planned.partnerId) {
      schedulePush(() =>
        pushToUser({
          userId: planned.partnerId!,
          appRole: 'DELIVERY_PARTNER',
          copyKey: 'partner_order_cancelled',
          orderId: input.orderId,
          orderNumber: planned.orderNumber,
        }),
      );
    }

    if (planned.followUp.refundMethod === 'RAZORPAY' && planned.paymentId && planned.razorpayPaymentId) {
      return this.completeRazorpayRefund({
        paymentId: planned.paymentId,
        razorpayPaymentId: planned.razorpayPaymentId,
        amountPaise: planned.amountPaise,
      });
    }

    return planned.followUp;
  }

  private async completeRazorpayRefund(input: {
    paymentId: string;
    razorpayPaymentId: string;
    amountPaise: number;
  }): Promise<RefundFollowUp> {
    if (!isRazorpayConfigured()) {
      await this.orders.markPaymentRefund(input.paymentId, { refundStatus: 'FAILED' });
      return { refundMethod: 'RAZORPAY', refundStatus: 'FAILED' };
    }

    try {
      const refund = await refundPayment({
        razorpayPaymentId: input.razorpayPaymentId,
        amountPaise: input.amountPaise,
      });
      await this.orders.markPaymentRefund(input.paymentId, {
        refundStatus: 'PAID',
        paymentStatus: 'REFUNDED',
        razorpayRefundId: refund.id,
      });
      return { refundMethod: 'RAZORPAY', refundStatus: 'PAID' };
    } catch {
      await this.orders.markPaymentRefund(input.paymentId, { refundStatus: 'FAILED' });
      return { refundMethod: 'RAZORPAY', refundStatus: 'FAILED' };
    }
  }
}

export function isCustomerCancellableStatus(status: string): boolean {
  return CUSTOMER_CANCEL_STATUSES.includes(status as (typeof CUSTOMER_CANCEL_STATUSES)[number]);
}
