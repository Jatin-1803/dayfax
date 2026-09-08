import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { CartRepository } from '../cart/cart.repository.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from '../payments/razorpay.client.js';
import { OrdersRepository } from './orders.repository.js';
import { createId } from '../../common/utils/id.js';
import type {
  CheckoutInput,
  ListOrdersQuery,
  OrderStatus,
  QuoteInput,
  VerifyPaymentInput,
} from './orders.schema.js';
import type { OrderItemRow, OrderRow, StatusHistoryRow, ZoneFeeRow } from './orders.repository.js';
import { AddressesRepository } from '../addresses/addresses.repository.js';
import {
  DELIVERY_OTP_VISIBLE_STATUSES,
  generateDeliveryOtp,
} from './delivery-otp.js';
import type { PoolConnection } from 'mysql2/promise';

const TRACKABLE_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

const ONLINE_METHODS = new Set(['UPI', 'CARD', 'WALLET']);

function mapOrderSummary(row: OrderRow) {
  const unpaidCod = row.payment_method === 'COD' && row.payment_status !== 'CAPTURED';
  const showOtp =
    Boolean(row.delivery_otp) &&
    DELIVERY_OTP_VISIBLE_STATUSES.has(row.status) &&
    !unpaidCod;
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
    deliveryOtp: showOtp ? row.delivery_otp : null,
    placedAt: row.placed_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    store: {
      id: row.store_id,
      name: row.store_name ?? '',
    },
    address: {
      id: row.address_id,
      label: row.address_label ?? '',
      line1: row.address_line1 ?? '',
      city: row.address_city ?? '',
    },
    payment: row.payment_method
      ? {
          method: row.payment_method,
          status: row.payment_status,
        }
      : null,
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

function mapTimeline(rows: StatusHistoryRow[], currentStatus: OrderStatus) {
  const statusRank = Object.fromEntries(TRACKABLE_STATUSES.map((s, i) => [s, i])) as Record<
    string,
    number
  >;
  const sorted = [...rows].sort((a, b) => {
    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (statusRank[a.to_status] ?? 99) - (statusRank[b.to_status] ?? 99);
  });

  const history = sorted.map((row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    note: row.note,
    at: row.created_at,
  }));

  const reached = new Set(sorted.map((r) => r.to_status));
  const steps = TRACKABLE_STATUSES.map((status) => ({
    status,
    reached: reached.has(status) || (currentStatus === 'CANCELLED' && status === 'PENDING'),
    current: currentStatus === status,
  }));

  return { history, steps, currentStatus };
}

function buildOrderNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = createId().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `DF${y}${m}${d}-${suffix}`;
}

/** Great-circle distance in km (WGS84). */
function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveSlabFee(
  distanceKm: number | null,
  slabs: { from_km: number; to_km: number | null; fee_paise: number }[],
  fallbackFeePaise: number,
): number {
  if (distanceKm == null || slabs.length === 0) {
    return fallbackFeePaise;
  }
  const match = slabs.find((slab) => {
    const from = Number(slab.from_km);
    const to = slab.to_km == null ? null : Number(slab.to_km);
    if (distanceKm < from) return false;
    if (to == null) return true;
    return distanceKm <= to;
  });
  return match ? match.fee_paise : fallbackFeePaise;
}

async function computeDeliveryFee(options: {
  repo: OrdersRepository;
  zone: ZoneFeeRow;
  itemTotalPaise: number;
  addressLat: number | null;
  addressLng: number | null;
  conn?: PoolConnection;
}): Promise<{
  deliveryFeePaise: number;
  distanceKm: number | null;
  freeDeliveryApplied: boolean;
  freeDeliveryAbovePaise: number | null;
}> {
  const slabs = await options.repo.listFeeSlabs(options.zone.id, options.conn);
  let distanceKm: number | null = null;
  if (
    options.addressLat != null &&
    options.addressLng != null &&
    options.zone.center_latitude != null &&
    options.zone.center_longitude != null
  ) {
    distanceKm = haversineKm(
      options.addressLat,
      options.addressLng,
      options.zone.center_latitude,
      options.zone.center_longitude,
    );
  }

  let deliveryFeePaise = resolveSlabFee(
    distanceKm,
    slabs,
    options.zone.delivery_fee_paise,
  );

  const freeAbove = options.zone.free_delivery_above_paise;
  const freeDeliveryApplied =
    freeAbove != null && freeAbove > 0 && options.itemTotalPaise >= freeAbove;
  if (freeDeliveryApplied) {
    deliveryFeePaise = 0;
  }

  return {
    deliveryFeePaise,
    distanceKm,
    freeDeliveryApplied,
    freeDeliveryAbovePaise: freeAbove,
  };
}

export class OrdersService {
  constructor(
    private readonly repo = new OrdersRepository(),
    private readonly cartRepo = new CartRepository(),
    private readonly notificationsRepo = new NotificationsRepository(),
    private readonly addressesRepo = new AddressesRepository(),
  ) {}

  async quote(userId: string, input: QuoteInput = {}) {
    let address = input.addressId
      ? await this.repo.findAddressForUser(input.addressId, userId)
      : null;

    if (!address) {
      const addresses = await this.addressesRepo.listByUser(userId);
      const preferred = addresses.find((a) => a.is_default === 1) ?? addresses[0] ?? null;
      if (preferred) {
        address = await this.repo.findAddressForUser(preferred.id, userId);
      }
    }

    const cart = await this.cartRepo.findActiveCart(userId);
    let itemTotalPaise = 0;
    let itemCount = 0;
    if (cart) {
      const items = await this.cartRepo.listItems(cart.id);
      itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      itemTotalPaise = items.reduce((sum, item) => sum + item.unit_price_paise * item.quantity, 0);
    }

    const serviceAreaId =
      address?.service_area_id ??
      cart?.service_area_id ??
      (await this.addressesRepo.resolveDefaultServiceAreaId());

    if (!serviceAreaId) {
      throw new ValidationError('No service area configured');
    }

    const zone = await this.repo.findZone(address?.delivery_zone_id ?? null, serviceAreaId);
    if (!zone) {
      throw new ValidationError('No delivery zone available');
    }

    const fee = await computeDeliveryFee({
      repo: this.repo,
      zone,
      itemTotalPaise,
      addressLat: address?.latitude ?? null,
      addressLng: address?.longitude ?? null,
    });
    const deliveryFeePaise = fee.deliveryFeePaise;
    const taxPaise = 0;
    const discountPaise = 0;
    const grandTotalPaise = itemTotalPaise + deliveryFeePaise + taxPaise - discountPaise;
    const meetsMinOrder = itemTotalPaise >= zone.min_order_paise;

    return {
      addressId: address?.id ?? null,
      deliveryZoneId: zone.id,
      etaMinutes: zone.eta_minutes,
      deliveryFeePaise,
      minOrderPaise: zone.min_order_paise,
      freeDeliveryAbovePaise: fee.freeDeliveryAbovePaise,
      freeDeliveryApplied: fee.freeDeliveryApplied,
      distanceKm: fee.distanceKm != null ? Number(fee.distanceKm.toFixed(2)) : null,
      itemTotalPaise,
      itemCount,
      taxPaise,
      discountPaise,
      grandTotalPaise,
      meetsMinOrder,
      amountToMinOrderPaise: meetsMinOrder ? 0 : zone.min_order_paise - itemTotalPaise,
    };
  }

  async checkout(userId: string, input: CheckoutInput) {
    const isOnline = ONLINE_METHODS.has(input.paymentMethod);
    if (isOnline && !isRazorpayConfigured()) {
      throw new ValidationError(
        'Online payments are not configured. Please use Cash on Delivery.',
      );
    }
    if (!isOnline && input.paymentMethod !== 'COD') {
      throw new ValidationError('Unsupported payment method');
    }

    if (input.idempotencyKey) {
      const existing = await this.repo.findCheckoutIdempotency(userId, input.idempotencyKey);
      if (existing) {
        const order = await this.getByIdOrNumber(userId, existing.order_id);
        const payment = await this.repo.findPaymentByOrderId(existing.order_id);
        const razorpay =
          isOnline && payment?.provider_ref
            ? {
                keyId: getRazorpayKeyId(),
                orderId: payment.provider_ref,
                amountPaise: order.grandTotalPaise,
                currency: order.currency,
                name: 'DayFax',
                description: `Order ${order.orderNumber}`,
              }
            : null;
        return { ...order, razorpay };
      }
    }

    const result = await withTransaction(async (conn) => {
      const cart = await this.cartRepo.findActiveCart(userId, conn);
      if (!cart) {
        throw new ValidationError('Your cart is empty');
      }

      const items = await this.cartRepo.listItems(cart.id, conn);
      if (items.length === 0) {
        throw new ValidationError('Your cart is empty');
      }

      // Deterministic lock order by variant_id reduces deadlock risk under contention.
      const sortedItems = [...items].sort((a, b) => a.variant_id.localeCompare(b.variant_id));

      const address = await this.repo.findAddressForUser(input.addressId, userId, conn);
      if (!address) {
        throw new NotFoundError('Address not found');
      }

      const serviceAreaId = address.service_area_id ?? cart.service_area_id;
      const zone = await this.repo.findZone(address.delivery_zone_id, serviceAreaId, conn);
      if (!zone) {
        throw new ValidationError('No delivery zone available for this address');
      }

      let itemTotalPaise = 0;
      const pricedItems: Array<{
        productId: string;
        variantId: string;
        productName: string;
        variantLabel: string;
        unitPricePaise: number;
        quantity: number;
        lineTotalPaise: number;
      }> = [];

      for (const item of sortedItems) {
        const sellable = await this.cartRepo.resolveSellableVariant(
          {
            variantId: item.variant_id,
            storeId: cart.store_id,
            forUpdate: true,
          },
          conn,
        );
        if (
          !sellable ||
          !sellable.is_available ||
          !sellable.product_active ||
          !sellable.variant_active
        ) {
          throw new ConflictError(`${item.product_name} is no longer available`);
        }
        if (sellable.quantity_available < item.quantity) {
          throw new ConflictError(
            `Only ${sellable.quantity_available} left for ${item.product_name}`,
          );
        }

        const unitPricePaise = sellable.price_paise;
        const lineTotalPaise = unitPricePaise * item.quantity;
        itemTotalPaise += lineTotalPaise;
        pricedItems.push({
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name,
          variantLabel: item.unit_label,
          unitPricePaise,
          quantity: item.quantity,
          lineTotalPaise,
        });
      }

      if (itemTotalPaise < zone.min_order_paise) {
        throw new ValidationError(
          `Minimum order is ₹${(zone.min_order_paise / 100).toFixed(0)} for this area`,
        );
      }

      const fee = await computeDeliveryFee({
        repo: this.repo,
        zone,
        itemTotalPaise,
        addressLat: address.latitude,
        addressLng: address.longitude,
        conn,
      });
      const deliveryFeePaise = fee.deliveryFeePaise;
      const taxPaise = 0;
      const discountPaise = 0;
      const grandTotalPaise = itemTotalPaise + deliveryFeePaise + taxPaise - discountPaise;
      const orderNumber = buildOrderNumber();
      const initialStatus: OrderStatus = 'PENDING';

      const createdOrderId = await this.repo.createOrder(
        {
          orderNumber,
          userId,
          storeId: cart.store_id,
          serviceAreaId,
          deliveryZoneId: zone.id,
          addressId: address.id,
          status: initialStatus,
          itemTotalPaise,
          deliveryFeePaise,
          taxPaise,
          discountPaise,
          grandTotalPaise,
          notes: input.notes,
        },
        conn,
      );

      await this.repo.addStatusHistory(
        {
          orderId: createdOrderId,
          fromStatus: null,
          toStatus: 'PENDING',
          changedByUserId: userId,
          note: 'Order placed',
        },
        conn,
      );

      for (const line of pricedItems) {
        await this.repo.createOrderItem({ orderId: createdOrderId, ...line }, conn);
        const ok = await this.repo.decrementInventory(
          cart.store_id,
          line.variantId,
          line.quantity,
          conn,
        );
        if (!ok) {
          throw new ConflictError(
            `Stock changed for ${line.productName}. Please review your cart.`,
          );
        }
      }

      await this.repo.createPayment(
        {
          orderId: createdOrderId,
          method: input.paymentMethod,
          status: 'PENDING',
          amountPaise: grandTotalPaise,
          provider: isOnline ? 'razorpay' : 'cod_stub',
        },
        conn,
      );

      await this.repo.markCartCheckedOut(cart.id, conn);

      await this.notificationsRepo.create(
        {
          userId,
          title: isOnline ? 'Complete your payment' : 'Order placed',
          body: isOnline
            ? `Order ${orderNumber} is waiting for payment.`
            : `Order ${orderNumber} placed. A delivery partner will accept it shortly.`,
          meta: {
            type: 'order',
            orderId: createdOrderId,
            orderNumber,
          },
        },
        conn,
      );

      if (input.idempotencyKey) {
        await this.repo.saveCheckoutIdempotency(
          {
            userId,
            idempotencyKey: input.idempotencyKey,
            orderId: createdOrderId,
          },
          conn,
        );
      }

      return {
        orderId: createdOrderId,
        storeId: cart.store_id,
        pricedItems,
        grandTotalPaise,
        orderNumber,
      };
    });

    let razorpay: {
      keyId: string;
      orderId: string;
      amountPaise: number;
      currency: string;
      name: string;
      description: string;
    } | null = null;

    // External HTTP must not hold a pool connection / open transaction.
    if (isOnline) {
      try {
        const rzOrder = await createRazorpayOrder({
          amountPaise: result.grandTotalPaise,
          receipt: result.orderNumber,
          notes: { orderId: result.orderId, orderNumber: result.orderNumber },
        });
        const payment = await this.repo.findPaymentByOrderId(result.orderId);
        if (payment) {
          await this.repo.updatePayment(payment.id, {
            providerRef: rzOrder.id,
            razorpayOrderId: rzOrder.id,
          });
        }
        razorpay = {
          keyId: getRazorpayKeyId(),
          orderId: rzOrder.id,
          amountPaise: result.grandTotalPaise,
          currency: 'INR',
          name: 'DayFax',
          description: `Order ${result.orderNumber}`,
        };
      } catch (error) {
        await withTransaction(async (conn) => {
          for (const line of result.pricedItems) {
            await this.repo.restoreInventory(
              result.storeId,
              line.variantId,
              line.quantity,
              conn,
            );
          }
          const payment = await this.repo.lockPaymentByOrderId(result.orderId, conn);
          if (payment) {
            await this.repo.updatePayment(payment.id, { status: 'FAILED' }, conn);
          }
          await this.repo.cancelPendingOnlineOrder(result.orderId, conn);
          await this.repo.addStatusHistory(
            {
              orderId: result.orderId,
              fromStatus: 'PENDING',
              toStatus: 'CANCELLED',
              changedByUserId: userId,
              note: 'Cancelled: payment provider unavailable',
            },
            conn,
          );
        });
        throw error;
      }
    }

    const order = await this.getByIdOrNumber(userId, result.orderId);
    return {
      ...order,
      razorpay,
    };
  }

  async verifyPayment(userId: string, orderIdOrNumber: string, input: VerifyPaymentInput) {
    const order = await this.repo.findByIdOrNumberForUser(userId, orderIdOrNumber);
    if (!order) throw new NotFoundError('Order not found');

    const existingPayment = await this.repo.findPaymentByOrderId(order.id);
    if (!existingPayment) throw new NotFoundError('Payment not found');
    if (existingPayment.status === 'CAPTURED') {
      return this.getByIdOrNumber(userId, order.id);
    }
    if (order.status === 'CANCELLED' || existingPayment.status === 'FAILED') {
      throw new ValidationError('This order is no longer awaiting payment');
    }
    if (existingPayment.status !== 'PENDING') {
      throw new ValidationError('Payment cannot be verified in its current state');
    }
    if (existingPayment.provider !== 'razorpay') {
      throw new ValidationError('This order does not use online payment');
    }
    if (existingPayment.provider_ref !== input.razorpayOrderId) {
      throw new ValidationError('Razorpay order mismatch');
    }

    const valid = verifyRazorpaySignature(input);
    if (!valid) {
      throw new ValidationError('Invalid payment signature');
    }

    await withTransaction(async (conn) => {
      const payment = await this.repo.lockPaymentByOrderId(order.id, conn);
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.status === 'CAPTURED') {
        return;
      }
      if (payment.status !== 'PENDING') {
        throw new ValidationError('Payment cannot be verified in its current state');
      }

      const lockedOrder = await this.repo.lockOrderById(order.id, conn);
      if (!lockedOrder || lockedOrder.status === 'CANCELLED') {
        throw new ValidationError('This order is no longer awaiting payment');
      }

      await this.repo.updatePayment(
        payment.id,
        {
          status: 'CAPTURED',
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          verificationSource: 'checkout',
          paidAt: new Date(),
        },
        conn,
      );

      await this.notificationsRepo.create(
        {
          userId,
          title: 'Payment successful',
          body: `Payment received for order ${order.order_number}. A delivery partner will accept it shortly.`,
          meta: {
            type: 'order',
            orderId: order.id,
            orderNumber: order.order_number,
          },
        },
        conn,
      );
    });

    return this.getByIdOrNumber(userId, order.id);
  }

  async list(userId: string, query: ListOrdersQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const total = await this.repo.countByUser(userId);
    const rows = await this.repo.listByUser(userId, limit, offset);
    return {
      items: rows.map(mapOrderSummary),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async getByIdOrNumber(userId: string, idOrNumber: string) {
    let order = await this.repo.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');

    if (
      !order.delivery_otp &&
      DELIVERY_OTP_VISIBLE_STATUSES.has(order.status) &&
      !(order.payment_method === 'COD' && order.payment_status !== 'CAPTURED')
    ) {
      await withTransaction(async (conn) => {
        await this.repo.ensureDeliveryOtp(order!.id, generateDeliveryOtp(), conn);
      });
      order = (await this.repo.findByIdOrNumberForUser(userId, order.id)) ?? order;
    }

    const [items, history] = await Promise.all([
      this.repo.listItems(order.id),
      this.repo.listStatusHistory(order.id),
    ]);

    return {
      ...mapOrderSummary(order),
      items: items.map(mapItem),
      timeline: mapTimeline(history, order.status),
    };
  }

  async getTimeline(userId: string, idOrNumber: string) {
    const order = await this.repo.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    const history = await this.repo.listStatusHistory(order.id);
    return mapTimeline(history, order.status);
  }
}
