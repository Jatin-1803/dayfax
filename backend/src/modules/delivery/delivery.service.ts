import {
  AppError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { logger } from '../../common/logger/logger.js';
import { withTransaction } from '../../common/database/pool.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import type { RoleCode } from '../../common/middleware/auth.js';
import { OrdersRepository } from '../orders/orders.repository.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { isDuplicateKeyError } from '../payments/payment-attempts.repository.js';
import type { OrderItemRow } from '../orders/orders.repository.js';
import {
  DELIVERY_OTP_MAX_ATTEMPTS,
  generateDeliveryOtp,
  isValidDeliveryOtpFormat,
  normalizeDeliveryOtp,
} from '../orders/delivery-otp.js';
import {
  DeliveryRepository,
  type DeliveryJobRow,
  type LocalShopPickupRow,
} from './delivery.repository.js';
import { isClaimableOrder, isOnlinePaymentMethod, canVerifyDeliveryOtp } from '../orders/order-acceptance.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { pushCustomerForOrder, schedulePush } from '../notifications/push.service.js';
import { schedulePartnerOrderTakenAlerts } from '../notifications/partner-new-order.service.js';
import { ReturnsService } from '../support/returns.service.js';
import { SupportRepository } from '../support/support.repository.js';
import {
  itemsPickedUpLine,
  pickupAcceptedLine,
  supportLang,
} from '../support/support-customer-lines.js';
import { istToday, type ListJobsQuery, type StatsQuery, type UpdateAssignmentStatusInput } from './delivery.schema.js';

function otpInvalidError(remainingAttempts: number): AppError {
  return new AppError('Incorrect delivery OTP', {
    statusCode: 422,
    code: 'OTP_INVALID',
    details: { remainingAttempts },
  });
}

function otpAttemptsExhaustedError(): AppError {
  return new AppError(
    'Too many incorrect OTP attempts. Contact support to unlock this delivery.',
    {
      statusCode: 422,
      code: 'OTP_ATTEMPTS_EXHAUSTED',
      details: { remainingAttempts: 0 },
    },
  );
}

function mapStore(store: {
  id: string;
  name: string;
  phone_country_code: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  landmark: string | null;
  city: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  return {
    id: store.id,
    name: store.name,
    phoneCountryCode: store.phone_country_code,
    phone: store.phone,
    addressLine1: store.address_line1,
    addressLine2: store.address_line2,
    landmark: store.landmark,
    city: store.city,
    pincode: store.pincode,
    latitude: store.latitude != null ? Number(store.latitude) : null,
    longitude: store.longitude != null ? Number(store.longitude) : null,
  };
}

function mapLocalShop(row: LocalShopPickupRow | null | undefined) {
  if (!row) return null;
  return mapStore(row);
}

export function mapReturnItemSummaries(
  rows: Array<{ productName: string; variantLabel: string; quantity: number }>,
) {
  return rows.map((item) => ({
    productName: item.productName,
    variantLabel: item.variantLabel,
    quantity: item.quantity,
  }));
}

function mapJobSummary(
  row: DeliveryJobRow,
  localShop: LocalShopPickupRow | null = null,
  returnItems: Array<{ productName: string; variantLabel: string; quantity: number }> = [],
) {
  const paymentMethod = row.payment_method;
  const paymentStatus = row.payment_status;
  const amountPaise = row.payment_amount_paise ?? row.grand_total_paise;
  const isCod = paymentMethod === 'COD';
  const isPaid = paymentStatus === 'CAPTURED';
  const assignmentActive =
    row.assignment_status === 'ACCEPTED' || row.assignment_status === 'IN_PROGRESS';
  const isReturn = row.purpose === 'RETURN_PICKUP';
  const otpAllowed = isReturn
    ? assignmentActive
    : Boolean(assignmentActive && isPaid && (isCod || isOnlinePaymentMethod(paymentMethod)));

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    orderStatus: row.order_status,
    grandTotalPaise: row.grand_total_paise,
    currency: row.currency,
    notes: row.notes,
    placedAt: row.placed_at,
    store: mapStore({
      id: row.store_id,
      name: row.store_name,
      phone_country_code: row.store_phone_country_code,
      phone: row.store_phone,
      address_line1: row.store_address_line1,
      address_line2: row.store_address_line2,
      landmark: row.store_landmark,
      city: row.store_city,
      pincode: row.store_pincode,
      latitude: row.store_latitude,
      longitude: row.store_longitude,
    }),
    localShop: row.purpose === 'RETURN_PICKUP' ? null : mapLocalShop(localShop),
    address: {
      id: row.address_id,
      label: row.address_label,
      fullName: row.address_full_name,
      line1: row.address_line1,
      line2: row.address_line2,
      landmark: row.address_landmark,
      city: row.address_city,
      state: row.address_state,
      pincode: row.address_pincode,
      latitude: row.address_latitude != null ? Number(row.address_latitude) : null,
      longitude: row.address_longitude != null ? Number(row.address_longitude) : null,
    },
    customer:
      row.assignment_id && row.customer_phone
        ? {
            phoneCountryCode: row.customer_phone_country_code,
            phone: row.customer_phone,
          }
        : null,
    assignment: row.assignment_id
      ? {
          id: row.assignment_id,
          status: row.assignment_status,
          assignedAt: row.assigned_at,
          acceptedAt: row.accepted_at,
          completedAt: row.completed_at,
        }
      : null,
    purpose: row.purpose ?? 'DELIVERY',
    returnRequestId: row.return_request_id,
    returnNote: row.return_note,
    returnItems,
    payment: paymentMethod
      ? {
          method: paymentMethod,
          status: paymentStatus,
          amountPaise,
          collectAmountPaise: isCod && !isPaid ? amountPaise : 0,
        }
      : null,
    otpAllowed,
  };
}

function mapItem(row: OrderItemRow) {
  return {
    id: row.id,
    productId: row.product_id,
    variantId: row.variant_id,
    productName: row.product_name,
    variantLabel: row.variant_label,
    unitPricePaise: row.unit_price_paise,
    quantity: row.quantity,
    lineTotalPaise: row.line_total_paise,
    imageUrl: toPublicAssetUrl(row.product_image_url ?? null),
    isLocalShop: Boolean(row.is_local_shop),
  };
}

function isAdmin(roles: RoleCode[]): boolean {
  return roles.includes('ADMIN');
}

export class DeliveryService {
  constructor(
    private readonly repo = new DeliveryRepository(),
    private readonly ordersRepo = new OrdersRepository(),
    private readonly authRepo = new AuthRepository(),
    private readonly support = new SupportRepository(),
    private readonly returns = new ReturnsService(),
    private readonly notifications = new NotificationsRepository(),
  ) {}

  async getStats(partnerId: string, query: StatsQuery = {}) {
    const date = query.date ?? istToday();
    await this.repo.completeStaleDeliveredAssignments(partnerId);
    const [available, active, day] = await Promise.all([
      this.repo.countAvailable(),
      this.repo.countActiveForPartner(partnerId),
      this.repo.getDayStats(partnerId, date),
    ]);
    return {
      date,
      available,
      active,
      ordersDelivered: day.ordersDelivered,
      cancelled: day.cancelled,
      returns: day.returns,
      cashCollectedPaise: day.cashCollectedPaise,
      upiCollectedPaise: day.upiCollectedPaise,
    };
  }

  async listJobs(partnerId: string, query: ListJobsQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );

    let total = 0;
    let rows: DeliveryJobRow[] = [];

    if (query.tab === 'active' || query.tab === 'completed') {
      await this.repo.completeStaleDeliveredAssignments(partnerId);
    }

    switch (query.tab) {
      case 'available':
        total = await this.repo.countAvailableJobs();
        rows = await this.repo.listAvailable(limit, offset);
        break;
      case 'active':
        total = await this.repo.countActiveJobs(partnerId);
        rows = await this.repo.listActive(partnerId, limit, offset);
        break;
      case 'completed':
        total = await this.repo.countCompletedJobs(partnerId, query.date);
        rows = await this.repo.listCompleted(partnerId, limit, offset, query.date);
        break;
      default:
        throw new ValidationError('Invalid tab');
    }

    const localShops = await this.repo.listLocalShopsByOrderIds(rows.map((row) => row.order_id));
    const returnRequestIds = rows
      .filter((row) => row.purpose === 'RETURN_PICKUP' && row.return_request_id)
      .map((row) => row.return_request_id as string);
    const returnItemsByRequest = await this.support.listReturnItemSummaries(returnRequestIds);

    return {
      tab: query.tab,
      items: rows.map((row) =>
        mapJobSummary(
          row,
          localShops.get(row.order_id) ?? null,
          row.return_request_id ? (returnItemsByRequest.get(row.return_request_id) ?? []) : [],
        ),
      ),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async getJobDetail(partnerId: string, roles: RoleCode[], idOrOrderId: string) {
    const admin = isAdmin(roles);
    if (!admin) {
      await this.repo.completeStaleDeliveredAssignments(partnerId);
    }
    let job =
      (await this.repo.findJobByAssignmentId(idOrOrderId, partnerId, admin)) ??
      (await this.repo.findReturnJobForPartner(idOrOrderId, partnerId)) ??
      (await this.repo.findAvailableReturnJob(idOrOrderId)) ??
      (await this.repo.findJobByOrderIdOrNumber(idOrOrderId, partnerId, admin));

    if (!job) {
      throw new NotFoundError('Delivery job not found');
    }

    const items =
      job.purpose === 'RETURN_PICKUP' && job.return_request_id
        ? (await this.support.listReturnItems(job.return_request_id)).map((item) => ({
            id: item.order_item_id,
            productId: item.order_item_id,
            variantId: item.order_item_id,
            productName: item.product_name ?? '',
            variantLabel: item.variant_label ?? '',
            unitPricePaise: item.line_refund_paise,
            quantity: item.quantity,
            lineTotalPaise: item.line_refund_paise,
            imageUrl: toPublicAssetUrl(item.product_image_url ?? null),
            isLocalShop: false,
          }))
        : await this.listGroupedJobItems(job.order_id);

    const localShops =
      job.purpose === 'RETURN_PICKUP'
        ? new Map<string, LocalShopPickupRow>()
        : await this.repo.listLocalShopsByOrderIds([job.order_id]);

    const returnItems = items.map((item) => ({
      productName: item.productName,
      variantLabel: item.variantLabel,
      quantity: item.quantity,
    }));

    return {
      ...mapJobSummary(
        job,
        localShops.get(job.order_id) ?? null,
        job.purpose === 'RETURN_PICKUP' ? returnItems : [],
      ),
      items,
    };
  }

  async acceptReturn(partnerId: string, returnRequestId: string) {
    await this.assertPartnerEligible(partnerId);
    const assignmentId = await withTransaction(async (conn) => {
      const request = await this.support.lockReturnById(returnRequestId, conn);
      if (!request || !['APPROVED', 'PICKUP_IN_PROGRESS'].includes(request.status)) {
        throw new AppError('This pickup is no longer available.', {
          statusCode: 409,
          code: 'ORDER_NOT_AVAILABLE',
        });
      }
      const existing = await this.support.findActiveReturnAssignment(returnRequestId, conn);
      if (existing && existing.delivery_partner_id !== partnerId) {
        throw new AppError('This pickup is no longer available.', {
          statusCode: 409,
          code: 'ORDER_NOT_AVAILABLE',
        });
      }
      if (existing && ['ACCEPTED', 'IN_PROGRESS'].includes(existing.status)) {
        return existing.id;
      }
      if (!existing && request.status !== 'APPROVED') {
        throw new AppError('This pickup is no longer available.', {
          statusCode: 409,
          code: 'ORDER_NOT_AVAILABLE',
        });
      }

      const now = new Date();
      const id = existing
        ? existing.id
        : await this.repo.createAssignment(
            {
              orderId: request.order_id,
              partnerId,
              status: 'ACCEPTED',
              acceptedAt: now,
              purpose: 'RETURN_PICKUP',
              returnRequestId: request.id,
            },
            conn,
          );
      if (existing) {
        await this.repo.updateAssignmentStatus(
          existing.id,
          { status: 'ACCEPTED', acceptedAt: now },
          conn,
        );
      }
      await this.support.updateReturnStatus(request.id, { status: 'PICKUP_IN_PROGRESS' }, conn);
      await this.repo.addStatusHistory(
        { assignmentId: id, status: 'ACCEPTED', note: 'Return pickup accepted' },
        conn,
      );
      await this.postReturnChat(request.conversation_id, request.order_id, pickupAcceptedLine, conn);
      return id;
    });
    return this.getJobDetail(partnerId, ['DELIVERY_PARTNER'], assignmentId);
  }

  async claimJob(partnerId: string, roles: RoleCode[], orderId: string) {
    const result = await this.acceptAvailableOrder(partnerId, roles, orderId);
    return this.getJobDetail(partnerId, roles, result.assignmentId);
  }

  async acceptAvailableOrder(partnerId: string, roles: RoleCode[], orderId: string) {
    await this.assertPartnerEligible(partnerId);
    const result = await withTransaction(async (conn) => {
      const order = await this.repo.findOrderForClaim(orderId, conn);
      if (!order) {
        throw new NotFoundError('Order not available for delivery');
      }
      if (order.status === 'CANCELLED') {
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

      const payment = await this.ordersRepo.findPaymentByOrderId(orderId, conn);
      if (!isClaimableOrder(order.status, payment)) {
        throw new AppError('Order is no longer available.', {
          statusCode: 409,
          code: 'ORDER_NOT_AVAILABLE',
        });
      }

      const existing = await this.repo.findActiveAssignmentForOrder(orderId, conn);
      if (existing) {
        if (
          existing.delivery_partner_id === partnerId &&
          (existing.status === 'ACCEPTED' || existing.status === 'IN_PROGRESS')
        ) {
          return { assignmentId: existing.id, created: false };
        }
        if (existing.delivery_partner_id === partnerId && existing.status === 'ASSIGNED') {
          return { assignmentId: existing.id, created: false, needsAccept: true };
        }
        throw new AppError('This order has already been accepted by another delivery partner.', {
          statusCode: 409,
          code: 'ORDER_ALREADY_ASSIGNED',
        });
      }

      const now = new Date();
      const id = await this.repo.createAssignment(
        {
          orderId,
          partnerId,
          status: 'ACCEPTED',
          acceptedAt: now,
        },
        conn,
      );

      try {
        await this.repo.insertAcceptanceLock(
          { orderId, assignmentId: id, partnerId, acceptedAt: now },
          conn,
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new AppError('This order has already been accepted by another delivery partner.', {
            statusCode: 409,
            code: 'ORDER_ALREADY_ASSIGNED',
          });
        }
        throw error;
      }

      await this.repo.addStatusHistory(
        { assignmentId: id, status: 'ASSIGNED', note: 'Job claimed' },
        conn,
      );
      await this.repo.addStatusHistory(
        { assignmentId: id, status: 'ACCEPTED', note: 'Job accepted' },
        conn,
      );

      if (order.status === 'PENDING') {
        await this.repo.updateOrderStatus(orderId, 'CONFIRMED', conn);
        await this.ordersRepo.addStatusHistory(
          {
            orderId,
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            changedByUserId: partnerId,
            note: 'Accepted by delivery partner',
          },
          conn,
        );
      }

      if (payment && isOnlinePaymentMethod(payment.method) && payment.status === 'CAPTURED') {
        await this.ordersRepo.ensureDeliveryOtp(orderId, generateDeliveryOtp(), conn);
      }

      await this.syncCheckoutGroupOnClaim(orderId, partnerId, conn);

      logger.info('order_accepted', { orderId, partnerId, assignmentId: id });
      return { assignmentId: id, created: true };
    });

    if ('needsAccept' in result && result.needsAccept) {
      await this.acceptJob(partnerId, roles, result.assignmentId);
    } else if (result.created) {
      schedulePush(() => pushCustomerForOrder(orderId, 'order_accepted'));
      schedulePartnerOrderTakenAlerts(orderId, partnerId);
      logger.info('order_accept_attempted', { orderId, partnerId, result: 'accepted' });
    }

    return result;
  }

  async acceptJob(partnerId: string, roles: RoleCode[], assignmentId: string) {
    await this.assertPartnerEligible(partnerId);
    let acceptedOrderId: string | null = null;
    await withTransaction(async (conn) => {
      const assignment = await this.repo.findAssignmentByIdForPartner(
        assignmentId,
        partnerId,
        conn,
      );
      if (!assignment) {
        throw new NotFoundError('Assignment not found');
      }
      if (assignment.status === 'ACCEPTED' || assignment.status === 'IN_PROGRESS') {
        return;
      }
      if (assignment.status !== 'ASSIGNED') {
        throw new ValidationError('Only assigned jobs can be accepted');
      }
      if (assignment.purpose === 'RETURN_PICKUP') {
        if (!assignment.return_request_id) {
          throw new ValidationError('Return pickup is missing');
        }
        const request = await this.support.lockReturnById(assignment.return_request_id, conn);
        if (!request || request.status !== 'APPROVED') {
          throw new AppError('This pickup is no longer available.', {
            statusCode: 409,
            code: 'ORDER_NOT_AVAILABLE',
          });
        }
        const now = new Date();
        await this.repo.updateAssignmentStatus(
          assignmentId,
          { status: 'ACCEPTED', acceptedAt: now },
          conn,
        );
        await this.support.updateReturnStatus(request.id, { status: 'PICKUP_IN_PROGRESS' }, conn);
        await this.repo.addStatusHistory(
          { assignmentId, status: 'ACCEPTED', note: 'Return pickup accepted' },
          conn,
        );
        await this.postReturnChat(request.conversation_id, request.order_id, pickupAcceptedLine, conn);
        return;
      }

      const order = await this.repo.findOrderForClaim(assignment.order_id, conn);
      if (!order) {
        throw new NotFoundError('Order not available for delivery');
      }
      if (order.status === 'CANCELLED') {
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
      try {
        await this.repo.insertAcceptanceLock(
          {
            orderId: assignment.order_id,
            assignmentId,
            partnerId,
            acceptedAt: now,
          },
          conn,
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new AppError('This order has already been accepted by another delivery partner.', {
            statusCode: 409,
            code: 'ORDER_ALREADY_ASSIGNED',
          });
        }
        throw error;
      }

      await this.repo.updateAssignmentStatus(
        assignmentId,
        { status: 'ACCEPTED', acceptedAt: now },
        conn,
      );
      await this.repo.addStatusHistory(
        {
          assignmentId,
          status: 'ACCEPTED',
          note: 'Job accepted',
        },
        conn,
      );

      if (order.status === 'PENDING') {
        await this.repo.updateOrderStatus(assignment.order_id, 'CONFIRMED', conn);
        await this.ordersRepo.addStatusHistory(
          {
            orderId: assignment.order_id,
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            changedByUserId: partnerId,
            note: 'Accepted by delivery partner',
          },
          conn,
        );
      }

      const payment = await this.ordersRepo.findPaymentByOrderId(assignment.order_id, conn);
      if (payment && isOnlinePaymentMethod(payment.method) && payment.status === 'CAPTURED') {
        await this.ordersRepo.ensureDeliveryOtp(assignment.order_id, generateDeliveryOtp(), conn);
      }

      await this.syncCheckoutGroupOnClaim(assignment.order_id, partnerId, conn);

      logger.info('order_accepted', {
        orderId: assignment.order_id,
        partnerId,
        assignmentId,
      });
      acceptedOrderId = assignment.order_id;
    });

    if (acceptedOrderId) {
      const orderId = acceptedOrderId;
      schedulePush(() => pushCustomerForOrder(orderId, 'order_accepted'));
      schedulePartnerOrderTakenAlerts(orderId, partnerId);
    }

    return this.getJobDetail(partnerId, roles, assignmentId);
  }

  async updateJobStatus(
    partnerId: string,
    roles: RoleCode[],
    assignmentId: string,
    input: UpdateAssignmentStatusInput,
  ) {
    let otpMismatchOrderId: string | null = null;
    let pickupMismatchId: string | null = null;
    let pendingRefundId: string | null = null;
    const pendingCustomerPush: {
      notice: { orderId: string; copyKey: 'out_for_delivery' | 'order_delivered' | 'return_picked_up' } | null;
    } = { notice: null };

    try {
      await withTransaction(async (conn) => {
        const assignment = await this.repo.findAssignmentByIdForPartner(
          assignmentId,
          partnerId,
          conn,
        );
        if (!assignment) {
          throw new NotFoundError('Assignment not found');
        }

        if (assignment.purpose === 'RETURN_PICKUP') {
          const result = await this.updateReturnPickup(assignment, input, conn);
          if (result.pickupMismatch) pickupMismatchId = result.pickupMismatch;
          if (result.pendingRefundId) pendingRefundId = result.pendingRefundId;
          if (result.pickedUp) {
            pendingCustomerPush.notice = { orderId: assignment.order_id, copyKey: 'return_picked_up' };
          }
          return;
        }

        const { status, note, latitude, longitude } = input;

        if (status === 'IN_PROGRESS') {
          if (!['ACCEPTED', 'ASSIGNED'].includes(assignment.status)) {
            throw new ValidationError('Job cannot be marked in progress from its current state');
          }
          await this.repo.updateAssignmentStatus(
            assignmentId,
            { status: 'IN_PROGRESS' },
            conn,
          );
          await this.repo.updateOrderStatus(assignment.order_id, 'OUT_FOR_DELIVERY', conn);
          await this.ordersRepo.addStatusHistory(
            {
              orderId: assignment.order_id,
              fromStatus: assignment.order_status,
              toStatus: 'OUT_FOR_DELIVERY',
              changedByUserId: partnerId,
              note: note ?? 'Out for delivery',
            },
            conn,
          );
          await this.repo.addStatusHistory(
            { assignmentId, status: 'IN_PROGRESS', note, latitude, longitude },
            conn,
          );
          await this.syncCheckoutGroupStatus(assignment.order_id, partnerId, 'OUT_FOR_DELIVERY', conn);
          pendingCustomerPush.notice = { orderId: assignment.order_id, copyKey: 'out_for_delivery' };
          return;
        }

        if (status === 'COMPLETED') {
          if (!['IN_PROGRESS', 'ACCEPTED'].includes(assignment.status)) {
            throw new ValidationError('Job cannot be completed from its current state');
          }
          if (assignment.order_status === 'CANCELLED') {
            throw new AppError('This order was cancelled.', {
              statusCode: 409,
              code: 'ORDER_CANCELLED',
            });
          }
          if (assignment.order_status === 'DELIVERED') {
            throw new AppError('This order has already been delivered.', {
              statusCode: 409,
              code: 'ORDER_ALREADY_DELIVERED',
            });
          }

          const payment = await this.ordersRepo.findPaymentByOrderId(assignment.order_id, conn);
          if (!canVerifyDeliveryOtp({
            paymentMethod: payment?.method,
            paymentStatus: payment?.status,
          })) {
            throw new AppError('Payment must be completed before delivery can be confirmed.', {
              statusCode: 422,
              code: 'OTP_NOT_ALLOWED',
            });
          }

          const otpState = await this.ordersRepo.getDeliveryOtpState(
            assignment.order_id,
            conn,
          );
          if (!otpState?.delivery_otp) {
            throw new AppError(
              'Delivery OTP is not set for this order. Ask the customer to refresh their order screen.',
              { statusCode: 422, code: 'OTP_NOT_SET' },
            );
          }
          if (otpState.delivery_otp_attempts >= DELIVERY_OTP_MAX_ATTEMPTS) {
            throw otpAttemptsExhaustedError();
          }

          const provided = normalizeDeliveryOtp(input.deliveryOtp ?? '');
          if (!isValidDeliveryOtpFormat(provided) || provided !== otpState.delivery_otp) {
            otpMismatchOrderId = assignment.order_id;
            logger.info('otp_verification', {
              orderId: assignment.order_id,
              partnerId,
              result: 'invalid',
            });
            throw new ValidationError('Incorrect delivery OTP');
          }

          logger.info('otp_verification', {
            orderId: assignment.order_id,
            partnerId,
            result: 'valid',
          });

          const now = new Date();
          await this.repo.updateAssignmentStatus(
            assignmentId,
            { status: 'COMPLETED', completedAt: now },
            conn,
          );
          await this.repo.markOrderDelivered(assignment.order_id, conn);
          await this.ordersRepo.clearDeliveryOtp(assignment.order_id, conn);
          await this.ordersRepo.addStatusHistory(
            {
              orderId: assignment.order_id,
              fromStatus: assignment.order_status,
              toStatus: 'DELIVERED',
              changedByUserId: partnerId,
              note: note ?? 'Order delivered',
            },
            conn,
          );
          await this.repo.addStatusHistory(
            { assignmentId, status: 'COMPLETED', note, latitude, longitude },
            conn,
          );
          logger.info('delivery_completed', {
            orderId: assignment.order_id,
            partnerId,
            assignmentId,
          });
          await this.syncCheckoutGroupStatus(assignment.order_id, partnerId, 'DELIVERED', conn);
          pendingCustomerPush.notice = { orderId: assignment.order_id, copyKey: 'order_delivered' };
          return;
        }

        if (status === 'REJECTED') {
          if (!['ASSIGNED', 'ACCEPTED'].includes(assignment.status)) {
            throw new ValidationError('Job cannot be rejected from its current state');
          }
          await this.repo.updateAssignmentStatus(
            assignmentId,
            { status: 'REJECTED' },
            conn,
          );
          await this.repo.deleteAcceptanceLock(assignment.order_id, conn);
          await this.repo.addStatusHistory(
            { assignmentId, status: 'REJECTED', note, latitude, longitude },
            conn,
          );
          await this.releaseCheckoutGroupAssignments(assignment.order_id, conn);
          return;
        }

        throw new ValidationError('Unsupported status transition');
      });
    } catch (error) {
      if (pickupMismatchId) {
        const request = await this.support.findReturnById(pickupMismatchId);
        const attempts = (request?.pickup_code_attempts ?? 0) + 1;
        if (request) {
          await this.support.updateReturnStatus(pickupMismatchId, {
            status: request.status,
            incrementPickupAttempts: true,
          });
        }
        const remaining = Math.max(0, DELIVERY_OTP_MAX_ATTEMPTS - attempts);
        throw remaining > 0 ? otpInvalidError(remaining) : otpAttemptsExhaustedError();
      }
      if (otpMismatchOrderId) {
        const attempts = await this.ordersRepo.incrementDeliveryOtpAttempts(otpMismatchOrderId);
        const remaining = Math.max(0, DELIVERY_OTP_MAX_ATTEMPTS - attempts);
        throw remaining > 0 ? otpInvalidError(remaining) : otpAttemptsExhaustedError();
      }
      throw error;
    }

    if (pickupMismatchId) {
      const request = await this.support.findReturnById(pickupMismatchId);
      const attempts = (request?.pickup_code_attempts ?? 0) + 1;
      if (request) {
        await this.support.updateReturnStatus(pickupMismatchId, {
          status: request.status,
          incrementPickupAttempts: true,
        });
      }
      const remaining = Math.max(0, DELIVERY_OTP_MAX_ATTEMPTS - attempts);
      throw remaining > 0 ? otpInvalidError(remaining) : otpAttemptsExhaustedError();
    }

    const statusNotice = pendingCustomerPush.notice;
    if (statusNotice) {
      schedulePush(() => pushCustomerForOrder(statusNotice.orderId, statusNotice.copyKey));
    }

    if (pendingRefundId) {
      const request = await this.support.findReturnById(pendingRefundId);
      if (request) {
        await this.returns.settleRazorpayReturn({
          returnRequestId: request.id,
          razorpayPaymentId: request.razorpay_payment_id ?? null,
          amountPaise: request.refund_amount_paise,
          userId: request.user_id,
          orderId: request.order_id,
          orderNumber: request.order_number ?? '',
        });
      }
    }

    return this.getJobDetail(partnerId, roles, assignmentId);
  }

  private async updateReturnPickup(
    assignment: {
      id: string;
      order_id: string;
      status: string;
      return_request_id: string | null;
    },
    input: UpdateAssignmentStatusInput,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<{ pickupMismatch: string | null; pendingRefundId: string | null; pickedUp: boolean }> {
    if (!assignment.return_request_id) {
      throw new ValidationError('Return pickup is missing');
    }
    const request = await this.support.lockReturnById(assignment.return_request_id, conn);
    if (!request) throw new NotFoundError('Return request not found');

    if (input.status === 'REJECTED') {
      await this.repo.updateAssignmentStatus(assignment.id, { status: 'REJECTED' }, conn);
      await this.support.updateReturnStatus(request.id, { status: 'APPROVED' }, conn);
      await this.repo.addStatusHistory(
        { assignmentId: assignment.id, status: 'REJECTED', note: input.note },
        conn,
      );
      return { pickupMismatch: null, pendingRefundId: null, pickedUp: false };
    }

    if (input.status === 'IN_PROGRESS') {
      await this.repo.updateAssignmentStatus(assignment.id, { status: 'IN_PROGRESS' }, conn);
      await this.repo.addStatusHistory(
        { assignmentId: assignment.id, status: 'IN_PROGRESS', note: input.note },
        conn,
      );
      return { pickupMismatch: null, pendingRefundId: null, pickedUp: false };
    }

    if (input.status !== 'COMPLETED') {
      throw new ValidationError('Unsupported status transition');
    }
    if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
      throw new ValidationError('Pickup cannot be completed from its current state');
    }
    if (request.pickup_code_attempts >= DELIVERY_OTP_MAX_ATTEMPTS) {
      throw otpAttemptsExhaustedError();
    }
    const provided = normalizeDeliveryOtp(input.deliveryOtp ?? '');
    if (!isValidDeliveryOtpFormat(provided) || provided !== request.pickup_code) {
      return { pickupMismatch: request.id, pendingRefundId: null, pickedUp: false };
    }

    await this.repo.updateAssignmentStatus(
      assignment.id,
      { status: 'COMPLETED', completedAt: new Date() },
      conn,
    );
    await this.repo.addStatusHistory(
      { assignmentId: assignment.id, status: 'COMPLETED', note: 'Return items collected' },
      conn,
    );

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
      await this.postReturnChat(request.conversation_id, request.order_id, itemsPickedUpLine, conn);
      return { pickupMismatch: null, pendingRefundId: null, pickedUp: true };
    }

    await this.support.updateReturnStatus(
      request.id,
      { status: 'PICKED_UP', refundStatus: 'PROCESSING' },
      conn,
    );
    await this.postReturnChat(request.conversation_id, request.order_id, itemsPickedUpLine, conn);
    return { pickupMismatch: null, pendingRefundId: request.id, pickedUp: false };
  }

  private async postReturnChat(
    conversationId: string | null,
    orderId: string,
    line: (lang: 'en' | 'hi') => string,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<void> {
    if (!conversationId) return;
    const conversation = await this.support.findConversationByOrderId(orderId, conn);
    await this.support.addMessage(
      {
        conversationId,
        sender: 'AGENT',
        body: line(supportLang(conversation?.lang)),
      },
      conn,
    );
  }

  private async listGroupedJobItems(orderId: string) {
    const groupId = await this.ordersRepo.findCheckoutGroupId(orderId);
    const orderIds = groupId
      ? await this.ordersRepo.listOrderIdsByCheckoutGroup(groupId)
      : [orderId];
    const items = [];
    for (const id of orderIds) {
      const rows = await this.ordersRepo.listItems(id);
      items.push(...rows.map(mapItem));
    }
    return items;
  }

  private async siblingOrderIds(
    orderId: string,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<string[]> {
    const groupId = await this.ordersRepo.findCheckoutGroupId(orderId, conn);
    if (!groupId) return [];
    const ids = await this.ordersRepo.listOrderIdsByCheckoutGroup(groupId, conn);
    return ids.filter((id) => id !== orderId);
  }

  private async shareGroupOtp(
    orderIds: string[],
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<void> {
    let shared: string | null = null;
    for (const orderId of orderIds) {
      const state = await this.ordersRepo.getDeliveryOtpState(orderId, conn);
      if (state?.delivery_otp) {
        shared = state.delivery_otp;
        break;
      }
    }
    const otp = shared ?? generateDeliveryOtp();
    for (const orderId of orderIds) {
      await this.ordersRepo.ensureDeliveryOtp(orderId, otp, conn);
    }
  }

  private async syncCheckoutGroupOnClaim(
    orderId: string,
    partnerId: string,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<void> {
    const siblingIds = await this.siblingOrderIds(orderId, conn);
    if (siblingIds.length === 0) return;

    const now = new Date();
    for (const siblingId of siblingIds) {
      const sibling = await this.ordersRepo.lockOrderById(siblingId, conn);
      if (!sibling || sibling.status === 'CANCELLED' || sibling.status === 'DELIVERED') continue;

      const existing = await this.repo.findActiveAssignmentForOrder(siblingId, conn);
      if (!existing) {
        const assignmentId = await this.repo.createAssignment(
          { orderId: siblingId, partnerId, status: 'ACCEPTED', acceptedAt: now },
          conn,
        );
        try {
          await this.repo.insertAcceptanceLock(
            { orderId: siblingId, assignmentId, partnerId, acceptedAt: now },
            conn,
          );
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
        }
        await this.repo.addStatusHistory(
          { assignmentId, status: 'ACCEPTED', note: 'Linked checkout group' },
          conn,
        );
      }

      if (sibling.status === 'PENDING') {
        await this.repo.updateOrderStatus(siblingId, 'CONFIRMED', conn);
        await this.ordersRepo.addStatusHistory(
          {
            orderId: siblingId,
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
            changedByUserId: partnerId,
            note: 'Accepted with checkout group',
          },
          conn,
        );
      }
    }

    await this.shareGroupOtp([orderId, ...siblingIds], conn);
  }

  private async syncCheckoutGroupStatus(
    orderId: string,
    partnerId: string,
    toStatus: 'OUT_FOR_DELIVERY' | 'DELIVERED',
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<void> {
    const siblingIds = await this.siblingOrderIds(orderId, conn);
    for (const siblingId of siblingIds) {
      const sibling = await this.ordersRepo.lockOrderById(siblingId, conn);
      if (!sibling || sibling.status === 'CANCELLED' || sibling.status === 'DELIVERED') continue;
      const assignment = await this.repo.findActiveAssignmentForOrder(siblingId, conn);
      if (toStatus === 'DELIVERED') {
        if (assignment) {
          await this.repo.updateAssignmentStatus(
            assignment.id,
            { status: 'COMPLETED', completedAt: new Date() },
            conn,
          );
        }
        await this.repo.markOrderDelivered(siblingId, conn);
        await this.ordersRepo.clearDeliveryOtp(siblingId, conn);
      } else {
        if (assignment && assignment.status !== 'IN_PROGRESS') {
          await this.repo.updateAssignmentStatus(assignment.id, { status: 'IN_PROGRESS' }, conn);
        }
        await this.repo.updateOrderStatus(siblingId, 'OUT_FOR_DELIVERY', conn);
      }
      await this.ordersRepo.addStatusHistory(
        {
          orderId: siblingId,
          fromStatus: sibling.status,
          toStatus,
          changedByUserId: partnerId,
          note: 'Updated with checkout group',
        },
        conn,
      );
    }
  }

  private async releaseCheckoutGroupAssignments(
    orderId: string,
    conn: import('mysql2/promise').PoolConnection,
  ): Promise<void> {
    const siblingIds = await this.siblingOrderIds(orderId, conn);
    for (const siblingId of siblingIds) {
      const assignment = await this.repo.findActiveAssignmentForOrder(siblingId, conn);
      if (!assignment) continue;
      await this.repo.updateAssignmentStatus(assignment.id, { status: 'REJECTED' }, conn);
      await this.repo.deleteAcceptanceLock(siblingId, conn);
    }
  }

  private async assertPartnerEligible(partnerId: string): Promise<void> {
    const user = await this.authRepo.findUserById(partnerId);
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenError('Delivery partner is not active');
    }
  }
}
