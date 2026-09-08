import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { DeliveryRepository } from '../delivery/delivery.repository.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { generateDeliveryOtp } from '../orders/delivery-otp.js';
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

export class AdminOrdersService {
  constructor(
    private readonly repo = new AdminOrdersRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly deliveryRepo = new DeliveryRepository(),
    private readonly authRepo = new AuthRepository(),
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
        quantity: item.quantity,
        lineTotalPaise: item.line_total_paise,
        imageUrl: toPublicAssetUrl(item.product_image_url ?? null),
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

    await withTransaction(async (conn) => {
      const locked = await this.repo.findOrderStatus(existing.id, conn);
      if (!locked) {
        throw new NotFoundError('Order not found');
      }
      if (locked.status !== from) {
        throw new ConflictError('Order status changed; refresh and try again');
      }

      await this.ordersRepo.updateOrderStatus(existing.id, to, conn);
      if (to === 'CONFIRMED') {
        const payment = await this.ordersRepo.findPaymentByOrderId(existing.id, conn);
        const unpaidCod = payment?.method === 'COD' && payment.status !== 'CAPTURED';
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
      }
      if (to === 'CANCELLED') {
        await conn.query(
          `UPDATE orders SET cancelled_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [existing.id],
        );
        await this.ordersRepo.clearDeliveryOtp(existing.id, conn);
        await this.deliveryRepo.cancelActiveAssignments(existing.id, conn);
        await this.deliveryRepo.deleteAcceptanceLock(existing.id, conn);
      }
      await this.ordersRepo.addStatusHistory(
        {
          orderId: existing.id,
          fromStatus: from,
          toStatus: to,
          changedByUserId: adminUserId,
          note: input.note ?? `Admin set status to ${to}`,
        },
        conn,
      );
    });

    return this.getOne(existing.id);
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

    return this.getOne(order.id);
  }
}
