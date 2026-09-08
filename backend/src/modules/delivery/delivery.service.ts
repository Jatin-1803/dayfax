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
import { DeliveryRepository, type DeliveryJobRow } from './delivery.repository.js';
import { isClaimableOrder, isOnlinePaymentMethod, canVerifyDeliveryOtp } from '../orders/order-acceptance.js';
import type { ListJobsQuery, UpdateAssignmentStatusInput } from './delivery.schema.js';

function mapJobSummary(row: DeliveryJobRow) {
  const paymentMethod = row.payment_method;
  const paymentStatus = row.payment_status;
  const amountPaise = row.payment_amount_paise ?? row.grand_total_paise;
  const isCod = paymentMethod === 'COD';
  const isPaid = paymentStatus === 'CAPTURED';
  const assignmentActive =
    row.assignment_status === 'ACCEPTED' || row.assignment_status === 'IN_PROGRESS';
  const otpAllowed = Boolean(assignmentActive && isPaid && (isCod || isOnlinePaymentMethod(paymentMethod)));

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    orderStatus: row.order_status,
    grandTotalPaise: row.grand_total_paise,
    currency: row.currency,
    notes: row.notes,
    placedAt: row.placed_at,
    store: {
      id: row.store_id,
      name: row.store_name,
      phoneCountryCode: row.store_phone_country_code,
      phone: row.store_phone,
      addressLine1: row.store_address_line1,
      addressLine2: row.store_address_line2,
      landmark: row.store_landmark,
      city: row.store_city,
      pincode: row.store_pincode,
      latitude: row.store_latitude != null ? Number(row.store_latitude) : null,
      longitude: row.store_longitude != null ? Number(row.store_longitude) : null,
    },
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
  ) {}

  async getStats(partnerId: string) {
    const [available, active, completedToday] = await Promise.all([
      this.repo.countAvailable(),
      this.repo.countActiveForPartner(partnerId),
      this.repo.countCompletedTodayForPartner(partnerId),
    ]);
    return { available, active, completedToday };
  }

  async listJobs(partnerId: string, query: ListJobsQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );

    let total = 0;
    let rows: DeliveryJobRow[] = [];

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
        total = await this.repo.countCompletedJobs(partnerId);
        rows = await this.repo.listCompleted(partnerId, limit, offset);
        break;
      default:
        throw new ValidationError('Invalid tab');
    }

    return {
      tab: query.tab,
      items: rows.map(mapJobSummary),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async getJobDetail(partnerId: string, roles: RoleCode[], idOrOrderId: string) {
    const admin = isAdmin(roles);
    let job =
      (await this.repo.findJobByAssignmentId(idOrOrderId, partnerId, admin)) ??
      (await this.repo.findJobByOrderIdOrNumber(idOrOrderId, partnerId, admin));

    if (!job) {
      throw new NotFoundError('Delivery job not found');
    }

    const items = await this.ordersRepo.listItems(job.order_id);
    return {
      ...mapJobSummary(job),
      items: items.map(mapItem),
    };
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
        throw new AppError('Order is no longer available.', {
          statusCode: 409,
          code: 'ORDER_NOT_AVAILABLE',
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
          throw new AppError('Order is no longer available.', {
            statusCode: 409,
            code: 'ORDER_NOT_AVAILABLE',
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

      logger.info('order_accepted', { orderId, partnerId, assignmentId: id });
      return { assignmentId: id, created: true };
    });

    if ('needsAccept' in result && result.needsAccept) {
      await this.acceptJob(partnerId, roles, result.assignmentId);
    }

    return result;
  }

  async acceptJob(partnerId: string, roles: RoleCode[], assignmentId: string) {
    await this.assertPartnerEligible(partnerId);
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
          throw new AppError('Order is no longer available.', {
            statusCode: 409,
            code: 'ORDER_ALREADY_ACCEPTED',
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

      logger.info('order_accepted', {
        orderId: assignment.order_id,
        partnerId,
        assignmentId,
      });
    });

    return this.getJobDetail(partnerId, roles, assignmentId);
  }

  async updateJobStatus(
    partnerId: string,
    roles: RoleCode[],
    assignmentId: string,
    input: UpdateAssignmentStatusInput,
  ) {
    let otpMismatchOrderId: string | null = null;

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
            throw new ValidationError(
              'Delivery OTP is not set for this order. Ask the customer to refresh their order screen.',
            );
          }
          if (otpState.delivery_otp_attempts >= DELIVERY_OTP_MAX_ATTEMPTS) {
            throw new ValidationError(
              'Too many incorrect OTP attempts. Contact support to unlock this delivery.',
            );
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
          return;
        }

        throw new ValidationError('Unsupported status transition');
      });
    } catch (error) {
      if (otpMismatchOrderId) {
        const attempts = await this.ordersRepo.incrementDeliveryOtpAttempts(otpMismatchOrderId);
        const remaining = Math.max(0, DELIVERY_OTP_MAX_ATTEMPTS - attempts);
        throw new ValidationError(
          remaining > 0
            ? `Incorrect delivery OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`
            : 'Too many incorrect OTP attempts. Contact support to unlock this delivery.',
        );
      }
      throw error;
    }

    return this.getJobDetail(partnerId, roles, assignmentId);
  }

  private async assertPartnerEligible(partnerId: string): Promise<void> {
    const user = await this.authRepo.findUserById(partnerId);
    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenError('Delivery partner is not active');
    }
  }
}
