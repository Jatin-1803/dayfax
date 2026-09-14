import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { writeAudit } from '../../common/audit/audit-log.js';
import { withTransaction } from '../../common/database/pool.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { DeliveryRepository } from '../delivery/delivery.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { generateDeliveryOtp } from '../orders/delivery-otp.js';
import { OrderCancelService } from '../orders/order-cancel.js';
import { pushToUser, schedulePush } from '../notifications/push.service.js';
import { PaymentAttemptsRepository } from '../payments/payment-attempts.repository.js';
import type { OrderStatus } from '../orders/orders.schema.js';
import { AdminOrdersRepository } from './admin-orders.repository.js';
import type {
  AdminAssignOrderInput,
  AdminListOrdersQuery,
  AdminPatchOrderStatusInput,
} from './admin-orders.schema.js';

const TRACKABLE_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'READY_FOR_PICKUP', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

function mapSummary(row: Awaited<ReturnType<AdminOrdersRepository['listOrders']>>[number]) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    itemTotalPaise: row.item_total_paise,
    deliveryFeePaise: row.delivery_fee_paise,
    taxPaise: row.tax_paise,
    discountPaise: row.discount_paise,
    grandTotalPaise: row.grand_total_paise,
    currency: row.currency,
    notes: row.notes,
    placedAt: row.placed_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    store: { id: row.store_id, name: row.store_name },
    address: {
      id: row.address_id,
      label: row.address_label,
      line1: row.address_line1,
      city: row.address_city,
    },
    customer: {
      id: row.user_id,
      phoneCountryCode: row.customer_phone_country_code,
      phone: row.customer_phone,
      fullName: row.customer_full_name,
    },
    payment: row.payment_method
      ? { method: row.payment_method, status: row.payment_status }
      : null,
    assignment: row.assignment_id
      ? {
          id: row.assignment_id,
          status: row.assignment_status,
          partnerId: row.partner_id,
          partnerPhone: row.partner_phone,
          partnerName: row.partner_full_name,
        }
      : null,
  };
}

const COD_COLLECTION = {
  CASH: { provider: 'cash', verificationSource: 'cash' as const },
  UPI: { provider: 'upi', verificationSource: 'manual_check' as const },
  CARD: { provider: 'card', verificationSource: 'manual_check' as const },
};

export class AdminOrdersService {
  constructor(
    private readonly repo = new AdminOrdersRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly deliveryRepo = new DeliveryRepository(),
    private readonly authRepo = new AuthRepository(),
    private readonly cancelService = new OrderCancelService(),
    private readonly attemptsRepo = new PaymentAttemptsRepository(),
  ) {}

  async list(query: AdminListOrdersQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const [total, rows] = await Promise.all([
      this.repo.countOrders(query),
      this.repo.listOrders(query, limit, offset),
    ]);
    return {
      items: rows.map(mapSummary),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async getOne(idOrNumber: string) {
    const row = await this.repo.findByIdOrNumber(idOrNumber);
    if (!row) {
      throw new NotFoundError('Order not found');
    }
    const [items, history] = await Promise.all([
      this.ordersRepo.listItems(row.id),
      this.ordersRepo.listStatusHistory(row.id),
    ]);

    const reached = new Set(history.map((h) => h.to_status));
    const timeline = TRACKABLE_STATUSES.map((status) => ({
      status,
      reached: reached.has(status) || (row.status === 'CANCELLED' && status === 'PENDING'),
      current: row.status === status,
    }));

    return {
      ...mapSummary(row),
      items: items.map((item) => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        variantLabel: item.variant_label,
        unitPricePaise: item.unit_price_paise,
        unitCostPaise: item.unit_cost_paise == null ? null : Number(item.unit_cost_paise),
        quantity: item.quantity,
        lineTotalPaise: item.line_total_paise,
        imageUrl: toPublicAssetUrl(item.product_image_url ?? null),
        isLocalShop: Boolean(item.is_local_shop),
      })),
      timeline,
      history: history.map((h) => ({
        id: h.id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        note: h.note,
        at: h.created_at,
      })),
    };
  }

  async patchStatus(
    idOrNumber: string,
    adminUserId: string,
    input: AdminPatchOrderStatusInput,
  ) {
    const existing = await this.repo.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    const from = existing.status;
    const to = input.status;
    if (from === to) {
      return this.getOne(existing.id);
    }

    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ValidationError(`Cannot transition from ${from} to ${to}`);
    }

    if (to === 'CANCELLED') {
      await this.cancelService.cancel({
        orderId: existing.id,
        actorUserId: adminUserId,
        note: input.note ?? 'Cancelled by admin',
        source: 'admin',
      });
      await writeAudit({
        actorType: 'admin',
        actorId: adminUserId,
        action: 'ORDER_CANCELLED_BY_ADMIN',
        module: 'orders',
        entityType: 'order',
        entityId: existing.id,
        oldValue: { status: from },
        newValue: { status: to },
        reason: input.note,
      });
      return this.getOne(existing.id);
    }

    const partnerIds = new Set<string>();

    await withTransaction(async (conn) => {
      const locked = await this.repo.findOrderStatus(existing.id, conn);
      if (!locked) {
        throw new NotFoundError('Order not found');
      }
      if (locked.status !== from) {
        throw new ConflictError('Order status changed; refresh and try again');
      }

      const payment = await this.ordersRepo.lockPaymentByOrderId(existing.id, conn);
      const unpaidCod = payment?.method === 'COD' && payment.status !== 'CAPTURED';
      const historyNote = this.deliveryNote(input, payment?.method ?? null);

      if (to === 'DELIVERED' && unpaidCod) {
        if (!payment || !input.paymentReceived) {
          throw new ValidationError('Choose how the COD payment was received');
        }
        if (!input.note || input.note.trim().length < 3) {
          throw new ValidationError('A note is required when marking a COD order delivered');
        }
        await this.captureCodCollection(
          existing.id,
          adminUserId,
          payment,
          input.paymentReceived,
          input.note,
          conn,
        );
      }

      await this.ordersRepo.updateOrderStatus(existing.id, to, conn);
      if (to === 'CONFIRMED') {
        if (!unpaidCod) {
          await this.ordersRepo.ensureDeliveryOtp(existing.id, generateDeliveryOtp(), conn);
        }
      }
      if (to === 'DELIVERED') {
        await conn.query(
          `UPDATE orders SET delivered_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [existing.id],
        );
        await this.ordersRepo.clearDeliveryOtp(existing.id, conn);
        const assignment = await this.deliveryRepo.completeActiveDeliveryAssignment(
          existing.id,
          historyNote,
          conn,
        );
        if (assignment) partnerIds.add(assignment.delivery_partner_id);
        const siblingPartners = await this.syncCheckoutGroupDelivered(existing.id, adminUserId, conn);
        for (const partnerId of siblingPartners) partnerIds.add(partnerId);
      }
      await this.ordersRepo.addStatusHistory(
        {
          orderId: existing.id,
          fromStatus: from,
          toStatus: to,
          changedByUserId: adminUserId,
          note: historyNote,
        },
        conn,
      );
    });

    if (to === 'DELIVERED') {
      schedulePush(() =>
        pushToUser({
          userId: existing.user_id,
          appRole: 'CUSTOMER',
          copyKey: 'order_delivered',
          orderId: existing.id,
          orderNumber: existing.order_number,
        }),
      );
      for (const partnerId of partnerIds) {
        schedulePush(() =>
          pushToUser({
            userId: partnerId,
            appRole: 'DELIVERY_PARTNER',
            copyKey: 'partner_order_delivered',
            orderId: existing.id,
            orderNumber: existing.order_number,
          }),
        );
      }
    }

    await writeAudit({
      actorType: 'admin',
      actorId: adminUserId,
      action: 'ORDER_STATUS_CHANGED',
      module: 'orders',
      entityType: 'order',
      entityId: existing.id,
      oldValue: { status: from },
      newValue: { status: to },
      reason: input.note ?? null,
    });

    return this.getOne(existing.id);
  }

  private deliveryNote(
    input: AdminPatchOrderStatusInput,
    paymentMethod: string | null,
  ): string {
    if (input.status !== 'DELIVERED') {
      return input.note ?? `Admin set status to ${input.status}`;
    }
    const received = input.paymentReceived
      ? `Payment received: ${input.paymentReceived}.`
      : paymentMethod === 'COD'
        ? 'COD payment already recorded.'
        : null;
    const note = input.note?.trim();
    return [received, note].filter(Boolean).join(' ') || 'Admin marked the order delivered';
  }

  private async captureCodCollection(
    orderId: string,
    adminUserId: string,
    payment: { id: string; amount_paise: number },
    paymentReceived: 'CASH' | 'UPI' | 'CARD',
    note: string,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<void> {
    const now = new Date();
    const collection = COD_COLLECTION[paymentReceived];
    const attemptId = await this.attemptsRepo.insertAttempt(
      {
        orderId,
        paymentId: payment.id,
        provider: collection.provider,
        amountPaise: payment.amount_paise,
        status: 'CAPTURED',
        notes: {
          internal_order_id: orderId,
          collected_by: adminUserId,
          payment_received: paymentReceived,
          note,
        },
      },
      conn,
    );
    await this.attemptsRepo.updateAttempt(
      attemptId,
      { verificationSource: collection.verificationSource, verifiedAt: now },
      conn,
    );
    await this.attemptsRepo.expireOpenQrAttempts(orderId, conn);
    await this.ordersRepo.updatePayment(
      payment.id,
      {
        status: 'CAPTURED',
        provider: collection.provider,
        providerRef: collection.provider,
        verificationSource: collection.verificationSource,
        paidAt: now,
      },
      conn,
    );
  }

  private async syncCheckoutGroupDelivered(
    orderId: string,
    adminUserId: string,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<string[]> {
    const groupId = await this.ordersRepo.findCheckoutGroupId(orderId, conn);
    if (!groupId) return [];

    const siblingIds = (await this.ordersRepo.listOrderIdsByCheckoutGroup(groupId, conn)).filter(
      (id) => id !== orderId,
    );
    const partnerIds: string[] = [];
    for (const siblingId of siblingIds) {
      const sibling = await this.ordersRepo.lockOrderById(siblingId, conn);
      if (!sibling || sibling.status === 'CANCELLED' || sibling.status === 'DELIVERED') continue;
      const assignment = await this.deliveryRepo.completeActiveDeliveryAssignment(
        siblingId,
        'Completed with checkout group after admin delivery',
        conn,
      );
      if (assignment) partnerIds.push(assignment.delivery_partner_id);
      await this.deliveryRepo.markOrderDelivered(siblingId, conn);
      await this.ordersRepo.clearDeliveryOtp(siblingId, conn);
      await this.ordersRepo.addStatusHistory(
        {
          orderId: siblingId,
          fromStatus: sibling.status,
          toStatus: 'DELIVERED',
          changedByUserId: adminUserId,
          note: 'Updated with checkout group',
        },
        conn,
      );
    }
    return partnerIds;
  }

  async assignPartner(
    idOrNumber: string,
    adminUserId: string,
    input: AdminAssignOrderInput,
  ) {
    const order = await this.repo.findByIdOrNumber(idOrNumber);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      throw new ValidationError('Cannot assign a partner to a closed order');
    }

    const partner = await this.authRepo.findUserById(input.partnerId);
    if (!partner || partner.status !== 'ACTIVE') {
      throw new NotFoundError('Delivery partner not found');
    }
    const roles = await this.authRepo.getUserRoles(partner.id);
    if (!roles.includes('DELIVERY_PARTNER')) {
      throw new ForbiddenError('User is not a delivery partner');
    }

    await withTransaction(async (conn) => {
      const locked = await this.ordersRepo.lockOrderById(order.id, conn);
      if (!locked || ['DELIVERED', 'CANCELLED'].includes(locked.status)) {
        throw new ValidationError('Cannot assign a partner to a closed order');
      }

      const existing = await this.deliveryRepo.findActiveAssignmentForOrder(order.id, conn);
      if (existing) {
        if (existing.delivery_partner_id === partner.id) {
          throw new ConflictError('Partner already assigned to this order');
        }
        throw new ConflictError('Order already has an active assignment');
      }

      const assignmentId = await this.deliveryRepo.createAssignment(
        {
          orderId: order.id,
          partnerId: partner.id,
          status: 'ASSIGNED',
        },
        conn,
      );
      await this.deliveryRepo.addStatusHistory(
        {
          assignmentId,
          status: 'ASSIGNED',
          note: `Assigned by admin ${adminUserId}`,
        },
        conn,
      );
    });

    schedulePush(() =>
      pushToUser({
        userId: partner.id,
        appRole: 'DELIVERY_PARTNER',
        copyKey: 'partner_job_assigned',
        orderId: order.id,
        orderNumber: order.order_number,
      }),
    );

    await writeAudit({
      actorType: 'admin',
      actorId: adminUserId,
      action: 'ORDER_REASSIGNED',
      module: 'orders',
      entityType: 'order',
      entityId: order.id,
      newValue: { partnerId: partner.id },
      reason: 'reassign',
    });

    return this.getOne(order.id);
  }
}
