import {
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import type { RowDataPacket } from 'mysql2/promise';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { pushToPartners, pushToUser, schedulePush } from '../notifications/push.service.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { DeliveryRepository } from '../delivery/delivery.repository.js';
import { SupportRepository } from '../support/support.repository.js';
import { ReturnsService } from '../support/returns.service.js';
import { returnApprovedLine, refundSentLine, supportLang } from '../support/support-customer-lines.js';
import { AdminReturnsRepository } from './admin-returns.repository.js';
import type { AdminListReturnsQuery, AdminMarkPaidInput, AdminRejectReturnInput } from './admin-returns.schema.js';

export class AdminReturnsService {
  constructor(
    private readonly repo = new AdminReturnsRepository(),
    private readonly support = new SupportRepository(),
    private readonly orders = new OrdersRepository(),
    private readonly notifications = new NotificationsRepository(),
    private readonly returns = new ReturnsService(),
    private readonly delivery = new DeliveryRepository(),
  ) {}

  async list(query: AdminListReturnsQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const [total, items, payouts] = await Promise.all([
      this.repo.count(query.status),
      this.repo.list(query.status, limit, offset),
      this.repo.listPendingPayouts(),
    ]);
    return {
      items: items.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        orderNumber: row.order_number,
        status: row.status,
        refundAmountPaise: row.refund_amount_paise,
        refundMethod: row.refund_method,
        refundStatus: row.refund_status,
        customerNote: row.customer_note,
        createdAt: row.created_at,
        customer: {
          id: row.user_id,
          name: row.customer_name,
          phone: row.customer_phone,
        },
      })),
      payouts: payouts.map((row) => ({
        id: row.id,
        source: row.source,
        orderId: row.order_id,
        orderNumber: row.order_number,
        amountPaise: row.amount_paise,
        refundStatus: row.refund_status,
        customerPhone: row.customer_phone,
      })),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async getOne(id: string) {
    const request = await this.support.findReturnById(id);
    if (!request) throw new NotFoundError('Return request not found');
    const [items, messages, orderItems, photos] = await Promise.all([
      this.support.listReturnItems(id),
      request.conversation_id
        ? this.support.listMessages(request.conversation_id)
        : Promise.resolve([]),
      this.orders.listItems(request.order_id),
      this.support.listReturnPhotos(id),
    ]);
    return {
      id: request.id,
      orderId: request.order_id,
      orderNumber: request.order_number,
      status: request.status,
      reason: request.reason,
      customerNote: request.customer_note,
      refundAmountPaise: request.refund_amount_paise,
      refundMethod: request.refund_method,
      refundStatus: request.refund_status,
      pickupCode: request.pickup_code,
      adminNote: request.admin_note,
      createdAt: request.created_at,
      reviewedAt: request.reviewed_at,
      pickedUpAt: request.picked_up_at,
      items: items.map((item) => ({
        orderItemId: item.order_item_id,
        productName: item.product_name,
        variantLabel: item.variant_label,
        quantity: item.quantity,
        lineRefundPaise: item.line_refund_paise,
        note: item.note,
      })),
      orderItems: orderItems.map((item) => ({
        id: item.id,
        productName: item.product_name,
        variantLabel: item.variant_label,
        quantity: item.quantity,
        lineTotalPaise: item.line_total_paise,
      })),
      photos: photos.map((photo) => ({
        id: photo.id,
        imageUrl: photo.image_url,
      })),
      messages: messages.map((message) => ({
        id: message.id,
        sender: message.sender,
        body: message.body,
        at: message.created_at,
      })),
    };
  }

  async approve(id: string, adminId: string) {
    const pending = {
      notice: null as {
        partnerId: string | null;
        orderId: string;
        orderNumber: string;
        customerId: string;
      } | null,
    };
    await withTransaction(async (conn) => {
      const request = await this.support.lockReturnById(id, conn);
      if (!request) throw new NotFoundError('Return request not found');
      if (request.status !== 'PENDING_REVIEW') {
        throw new ValidationError('Only requests waiting for review can be approved');
      }
      await this.support.updateReturnStatus(
        id,
        { status: 'APPROVED', reviewedByAdminId: adminId },
        conn,
      );
      const partnerId = await this.support.findCompletedDeliveryPartner(request.order_id, conn);
      if (partnerId) {
        await this.delivery.createAssignment(
          {
            orderId: request.order_id,
            partnerId,
            status: 'ASSIGNED',
            purpose: 'RETURN_PICKUP',
            returnRequestId: request.id,
          },
          conn,
        );
        await this.notifications.create(
          {
            userId: partnerId,
            title: 'Return pickup assigned',
            body: `Pick up damaged items for order ${request.order_number}.`,
            meta: { orderId: request.order_id, returnRequestId: id, type: 'RETURN_PICKUP_ASSIGNED' },
          },
          conn,
        );
      }
      const conversation = request.conversation_id
        ? await this.support.findConversationByOrderId(request.order_id, conn)
        : null;
      if (request.conversation_id) {
        await this.support.addMessage(
          {
            conversationId: request.conversation_id,
            sender: 'AGENT',
            body: returnApprovedLine(supportLang(conversation?.lang)),
          },
          conn,
        );
      }
      await this.notifications.create(
        {
          userId: request.user_id,
          title: 'Return approved',
          body: `Your return for order ${request.order_number} is approved. A partner will pick the items up. Share pickup code ${request.pickup_code} only when they collect them.`,
          meta: { orderId: request.order_id, returnRequestId: id, type: 'RETURN_APPROVED' },
        },
        conn,
      );
      pending.notice = {
        partnerId,
        orderId: request.order_id,
        orderNumber: request.order_number ?? '',
        customerId: request.user_id,
      };
    });

    const notice = pending.notice;
    if (notice) {
      schedulePush(() =>
        pushToUser({
          userId: notice.customerId,
          appRole: 'CUSTOMER',
          copyKey: 'return_approved',
          orderId: notice.orderId,
          orderNumber: notice.orderNumber,
        }),
      );
      if (notice.partnerId) {
        schedulePush(() =>
          pushToUser({
            userId: notice.partnerId!,
            appRole: 'DELIVERY_PARTNER',
            copyKey: 'partner_return_pickup',
            orderId: notice.orderId,
            orderNumber: notice.orderNumber,
          }),
        );
      } else {
        schedulePush(() =>
          pushToPartners({
            copyKey: 'partner_return_pickup',
            orderId: notice.orderId,
            orderNumber: notice.orderNumber,
          }),
        );
      }
    }
    return this.getOne(id);
  }

  async reject(id: string, adminId: string, input: AdminRejectReturnInput) {
    const pending = {
      notice: null as { userId: string; orderId: string; orderNumber: string } | null,
    };
    await withTransaction(async (conn) => {
      const request = await this.support.lockReturnById(id, conn);
      if (!request) throw new NotFoundError('Return request not found');
      if (request.status !== 'PENDING_REVIEW') {
        throw new ValidationError('Only requests waiting for review can be rejected');
      }
      await this.support.updateReturnStatus(
        id,
        { status: 'REJECTED', adminNote: input.note, reviewedByAdminId: adminId },
        conn,
      );
      if (request.conversation_id) {
        await this.support.addMessage(
          {
            conversationId: request.conversation_id,
            sender: 'AGENT',
            body: `I checked with the team. We are not able to take this return. ${input.note}`,
          },
          conn,
        );
      }
      await this.notifications.create(
        {
          userId: request.user_id,
          title: 'Return not approved',
          body: `Your return for order ${request.order_number} was not approved. ${input.note}`,
          meta: { orderId: request.order_id, returnRequestId: id, type: 'RETURN_REJECTED' },
        },
        conn,
      );
      pending.notice = {
        userId: request.user_id,
        orderId: request.order_id,
        orderNumber: request.order_number ?? '',
      };
    });
    const rejected = pending.notice;
    if (rejected) {
      schedulePush(() =>
        pushToUser({
          userId: rejected.userId,
          appRole: 'CUSTOMER',
          copyKey: 'return_rejected',
          orderId: rejected.orderId,
          orderNumber: rejected.orderNumber,
        }),
      );
    }
    return this.getOne(id);
  }

  async markPaid(id: string, input: AdminMarkPaidInput) {
    const pending = {
      notice: null as { userId: string; orderId: string; orderNumber: string } | null,
    };
    await withTransaction(async (conn) => {
      const request = await this.support.lockReturnById(id, conn);
      if (!request) throw new NotFoundError('Return request not found');
      if (request.refund_method !== 'MANUAL') {
        throw new ValidationError('Online refunds are sent automatically');
      }
      if (!['REFUND_PENDING', 'PICKED_UP'].includes(request.status)) {
        throw new ValidationError('Mark paid only after the items are picked up');
      }
      await this.support.updateReturnStatus(
        id,
        {
          status: 'REFUNDED',
          refundStatus: 'PAID',
          payoutRef: input.payoutRef ?? null,
        },
        conn,
      );
      const conversation = request.conversation_id
        ? await this.support.findConversationByOrderId(request.order_id, conn)
        : null;
      if (request.conversation_id) {
        await this.support.addMessage(
          {
            conversationId: request.conversation_id,
            sender: 'AGENT',
            body: refundSentLine(supportLang(conversation?.lang)),
          },
          conn,
        );
      }
      await this.notifications.create(
        {
          userId: request.user_id,
          title: 'Refund sent',
          body: `We have sent the refund for order ${request.order_number}.`,
          meta: { orderId: request.order_id, returnRequestId: id, type: 'RETURN_REFUNDED' },
        },
        conn,
      );
      pending.notice = {
        userId: request.user_id,
        orderId: request.order_id,
        orderNumber: request.order_number ?? '',
      };
    });
    const paid = pending.notice;
    if (paid) {
      schedulePush(() =>
        pushToUser({
          userId: paid.userId,
          appRole: 'CUSTOMER',
          copyKey: 'refund_sent',
          orderId: paid.orderId,
          orderNumber: paid.orderNumber,
        }),
      );
    }
    return this.getOne(id);
  }

  async retryRefund(id: string) {
    const request = await this.support.findReturnById(id);
    if (!request) throw new NotFoundError('Return request not found');
    if (request.refund_method !== 'RAZORPAY' || request.refund_status !== 'FAILED') {
      throw new ValidationError('Only a failed online refund can be retried');
    }
    await this.returns.settleRazorpayReturn({
      returnRequestId: request.id,
      razorpayPaymentId: request.razorpay_payment_id ?? null,
      amountPaise: request.refund_amount_paise,
      userId: request.user_id,
      orderId: request.order_id,
      orderNumber: request.order_number ?? '',
    });
    return this.getOne(id);
  }

  async markCancelPaid(paymentId: string, input: AdminMarkPaidInput) {
    const pending = {
      notice: null as { userId: string; orderId: string; orderNumber: string } | null,
    };
    await withTransaction(async (conn) => {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT p.id, o.user_id, o.order_number, o.id AS order_id
         FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE p.id = ? AND o.status = 'CANCELLED' AND p.refund_status IN ('PENDING', 'FAILED')
         LIMIT 1
         FOR UPDATE`,
        [paymentId],
      );
      const payment = rows[0] as
        | { id: string; user_id: string; order_number: string; order_id: string }
        | undefined;
      if (!payment) throw new NotFoundError('Refund not found');
      await this.orders.markPaymentRefund(
        payment.id,
        { refundStatus: 'PAID', paymentStatus: 'REFUNDED', payoutRef: input.payoutRef ?? null },
        conn,
      );
      await this.notifications.create(
        {
          userId: payment.user_id,
          title: 'Refund sent',
          body: `We have sent the refund for cancelled order ${payment.order_number}.`,
          meta: { orderId: payment.order_id, type: 'CANCEL_REFUNDED' },
        },
        conn,
      );
      pending.notice = {
        userId: payment.user_id,
        orderId: payment.order_id,
        orderNumber: payment.order_number,
      };
    });
    const refunded = pending.notice;
    if (refunded) {
      schedulePush(() =>
        pushToUser({
          userId: refunded.userId,
          appRole: 'CUSTOMER',
          copyKey: 'refund_sent',
          orderId: refunded.orderId,
          orderNumber: refunded.orderNumber,
        }),
      );
    }
    return { id: paymentId, refundStatus: 'PAID' };
  }
}
