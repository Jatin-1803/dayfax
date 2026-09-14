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
  pushCustomerForOrder,
  pushPartnersForOrder,
  schedulePush,
} from '../notifications/push.service.js';
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
import { isCustomerCancellableStatus, OrderCancelService } from './order-cancel.js';
import { SupportRepository } from '../support/support.repository.js';
import { mapReturnForCustomer } from '../support/returns.service.js';
import { isLocalShopStoreType, requiresOnlinePayment } from '../stores/local-shop.js';
import {
  buildCheckoutPushNotices,
  isDeferredCodSiblingPayment,
  partnerClaimOrderIdsAfterPayment,
} from './checkout-placement-notices.js';

function slicePaymentMethod(
  lines: Array<{ requiresOnlinePayment: boolean }>,
  inputPaymentMethod: CheckoutInput['paymentMethod'],
  isOnline: boolean,
): { paymentMethod: CheckoutInput['paymentMethod']; online: boolean } {
  if (lines.some((line) => line.requiresOnlinePayment)) {
    return { paymentMethod: 'UPI', online: true };
  }
  return { paymentMethod: inputPaymentMethod, online: isOnline };
}

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
const CHECKOUT_ABANDONED_NOTE = 'checkout_abandoned';

export type RazorpayCheckoutPayload = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  contact?: string;
  customerName?: string;
  email?: string;
};

export function formatRazorpayContact(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string | undefined {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  const local = digits.slice(-10);
  const cc = (countryCode ?? '+91').replace(/\D/g, '') || '91';
  return `+${cc}${local}`;
}

export function canCustomerPayOnline(input: {
  status: string;
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
}): boolean {
  if (input.status === 'CANCELLED' || input.status === 'DELIVERED') return false;
  return input.paymentMethod === 'COD' && input.paymentStatus === 'PENDING';
}

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
    isLocalShop: Boolean(row.is_local_shop),
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
    private readonly cancelService = new OrderCancelService(),
    private readonly supportRepo = new SupportRepository(),
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
    let isLocalShop = false;
    let codAllowed = true;
    if (cart) {
      const items = await this.cartRepo.listItems(cart.id);
      itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      itemTotalPaise = items.reduce((sum, item) => sum + item.unit_price_paise * item.quantity, 0);
      const hasLocal = items.some((item) => isLocalShopStoreType(item.store_type));
      const hasRegular = items.some((item) => !isLocalShopStoreType(item.store_type));
      isLocalShop = hasLocal && !hasRegular;
      codAllowed =
        items.length === 0 ||
        items.some((item) => !requiresOnlinePayment(item.online_payment_only));
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
      isLocalShop,
      codAllowed,
    };
  }

  async checkout(userId: string, input: CheckoutInput) {
    const { isControlEnabled } = await import('../app-controls/control-state.js');
    if (!(await isControlEnabled('new_orders')) || !(await isControlEnabled('checkout'))) {
      throw new ValidationError('New orders are temporarily unavailable.');
    }
    const isOnlinePayment = ONLINE_METHODS.has(input.paymentMethod);
    if (isOnlinePayment && !(await isControlEnabled('online_payments'))) {
      throw new ValidationError('Online payments are temporarily unavailable.');
    }
    if (!isOnlinePayment && input.paymentMethod === 'COD' && !(await isControlEnabled('cod'))) {
      throw new ValidationError('Cash on delivery is temporarily unavailable.');
    }
    const previewCart = await this.cartRepo.findActiveCart(userId);
    const previewItems = previewCart ? await this.cartRepo.listItems(previewCart.id) : [];
    const previewAllRequireOnline =
      previewItems.length > 0 &&
      previewItems.every((item) => requiresOnlinePayment(item.online_payment_only));
    const previewAnyRequireOnline = previewItems.some((item) =>
      requiresOnlinePayment(item.online_payment_only),
    );
    const isOnline = ONLINE_METHODS.has(input.paymentMethod);
    if (previewAllRequireOnline && !isOnline) {
      throw new ValidationError('checkout.local_shop_cod_blocked');
    }
    if (isOnline && !isRazorpayConfigured()) {
      throw new ValidationError(
        previewAnyRequireOnline
          ? 'checkout.local_shop_pay_required'
          : 'Online payments are not configured. Please use Cash on Delivery.',
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
        let payAmountPaise = payment?.amount_paise ?? order.grandTotalPaise;
        if (payment?.provider_ref && order.linkedOrders.length > 0) {
          const siblingPayment = await this.repo.findPaymentByOrderId(order.linkedOrders[0].id);
          if (siblingPayment?.provider_ref === payment.provider_ref) {
            payAmountPaise += siblingPayment.amount_paise;
          }
        }
        const razorpay =
          payment?.provider === 'razorpay' && payment.provider_ref && payment.status === 'PENDING'
            ? await this.buildRazorpayCheckout({
                userId,
                addressId: input.addressId,
                razorpayOrderId: payment.provider_ref,
                amountPaise: payAmountPaise,
                currency: order.currency,
                orderNumber: order.orderNumber,
              })
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

      const allRequireOnline = items.every((item) =>
        requiresOnlinePayment(item.online_payment_only),
      );
      if (allRequireOnline && !isOnline) {
        throw new ValidationError('checkout.local_shop_cod_blocked');
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
        storeId: string;
        productName: string;
        variantLabel: string;
        unitPricePaise: number;
        unitCostPaise: number | null;
        quantity: number;
        lineTotalPaise: number;
        isLocalShop: boolean;
        requiresOnlinePayment: boolean;
      }> = [];

      for (const item of sortedItems) {
        const lineStoreId = item.store_id || cart.store_id;
        const sellable = await this.cartRepo.resolveSellableVariant(
          {
            variantId: item.variant_id,
            storeId: lineStoreId,
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
        const unitCostPaise =
          sellable.cost_price_paise == null ? null : Number(sellable.cost_price_paise);
        const lineTotalPaise = unitPricePaise * item.quantity;
        itemTotalPaise += lineTotalPaise;
        pricedItems.push({
          productId: item.product_id,
          variantId: item.variant_id,
          storeId: lineStoreId,
          productName: item.product_name,
          variantLabel: item.unit_label,
          unitPricePaise,
          unitCostPaise,
          quantity: item.quantity,
          lineTotalPaise,
          isLocalShop: isLocalShopStoreType(item.store_type),
          requiresOnlinePayment: requiresOnlinePayment(item.online_payment_only),
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
      const localLines = pricedItems.filter((line) => line.isLocalShop);
      const regularLines = pricedItems.filter((line) => !line.isLocalShop);
      const mixed = localLines.length > 0 && regularLines.length > 0;
      const checkoutGroupId = mixed ? createId() : null;
      const slices = mixed
        ? [
            {
              lines: localLines,
              deliveryFeePaise: 0,
              isLocalShop: true,
              ...slicePaymentMethod(localLines, input.paymentMethod, isOnline),
            },
            {
              lines: regularLines,
              deliveryFeePaise,
              isLocalShop: false,
              ...slicePaymentMethod(regularLines, input.paymentMethod, isOnline),
            },
          ]
        : [
            {
              lines: pricedItems,
              deliveryFeePaise,
              isLocalShop: pricedItems.some((line) => line.isLocalShop),
              ...slicePaymentMethod(pricedItems, input.paymentMethod, isOnline),
            },
          ];

      const created: Array<{
        orderId: string;
        orderNumber: string;
        storeId: string;
        grandTotalPaise: number;
        online: boolean;
        isLocalShop: boolean;
      }> = [];

      for (const slice of slices) {
        const sliceItemTotal = slice.lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
        const sliceGrand = sliceItemTotal + slice.deliveryFeePaise;
        const orderNumber = buildOrderNumber();
        const storeId = slice.lines[0]?.storeId ?? cart.store_id;
        const createdOrderId = await this.repo.createOrder(
          {
            orderNumber,
            userId,
            storeId,
            serviceAreaId,
            deliveryZoneId: zone.id,
            addressId: address.id,
            status: 'PENDING',
            itemTotalPaise: sliceItemTotal,
            deliveryFeePaise: slice.deliveryFeePaise,
            taxPaise: 0,
            discountPaise: 0,
            grandTotalPaise: sliceGrand,
            notes: input.notes,
            isLocalShop: slice.isLocalShop,
            checkoutGroupId,
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
        for (const line of slice.lines) {
          await this.repo.createOrderItem(
            {
              orderId: createdOrderId,
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantLabel: line.variantLabel,
              unitPricePaise: line.unitPricePaise,
              unitCostPaise: line.unitCostPaise,
              quantity: line.quantity,
              lineTotalPaise: line.lineTotalPaise,
              isLocalShop: line.isLocalShop,
              storeId: line.storeId,
            },
            conn,
          );
          const ok = await this.repo.decrementInventory(
            line.storeId,
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
            method: slice.paymentMethod,
            status: 'PENDING',
            amountPaise: sliceGrand,
            provider: slice.online ? 'razorpay' : 'cod_stub',
          },
          conn,
        );
        created.push({
          orderId: createdOrderId,
          orderNumber,
          storeId,
          grandTotalPaise: sliceGrand,
          online: slice.online,
          isLocalShop: slice.isLocalShop,
        });
      }

      await this.repo.markCartCheckedOut(cart.id, conn);

      const payable = created.find((order) => order.isLocalShop) ?? created[0];
      const needsOnlinePayment = mixed ? true : isOnline;
      if (needsOnlinePayment) {
        await this.notificationsRepo.create(
          {
            userId,
            title: 'Complete your payment',
            body: `Order ${payable.orderNumber} is waiting for payment.`,
            meta: {
              type: 'order',
              orderId: payable.orderId,
              orderNumber: payable.orderNumber,
            },
          },
          conn,
        );
      } else {
        for (const order of created) {
          await this.notificationsRepo.create(
            {
              userId,
              title: 'Order placed',
              body: `Order ${order.orderNumber} placed. A delivery partner will accept it shortly.`,
              meta: {
                type: 'order',
                orderId: order.orderId,
                orderNumber: order.orderNumber,
              },
            },
            conn,
          );
        }
      }

      if (input.idempotencyKey) {
        await this.repo.saveCheckoutIdempotency(
          { userId, idempotencyKey: input.idempotencyKey, orderId: payable.orderId },
          conn,
        );
      }

      const payAmountPaise = mixed && isOnline ? grandTotalPaise : payable.grandTotalPaise;
      return {
        orderId: payable.orderId,
        storeId: payable.storeId,
        pricedItems,
        grandTotalPaise: payAmountPaise,
        orderNumber: payable.orderNumber,
        siblingOrderIds: created.filter((order) => order.orderId !== payable.orderId).map((order) => order.orderId),
        needsOnlinePayment,
        pushes: buildCheckoutPushNotices({
          needsOnlinePayment,
          payableOrderId: payable.orderId,
          created,
        }),
      };
    });

    let razorpay: RazorpayCheckoutPayload | null = null;

    // External HTTP must not hold a pool connection / open transaction.
    if (result.needsOnlinePayment) {
      try {
        const rzOrder = await createRazorpayOrder({
          amountPaise: result.grandTotalPaise,
          receipt: result.orderNumber,
          notes: { orderId: result.orderId, orderNumber: result.orderNumber },
        });
        const paymentIds = [result.orderId, ...result.siblingOrderIds];
        for (const orderId of paymentIds) {
          const payment = await this.repo.findPaymentByOrderId(orderId);
          if (!payment || payment.provider !== 'razorpay') continue;
          await this.repo.updatePayment(payment.id, {
            providerRef: rzOrder.id,
            razorpayOrderId: rzOrder.id,
          });
        }
        razorpay = await this.buildRazorpayCheckout({
          userId,
          addressId: input.addressId,
          razorpayOrderId: rzOrder.id,
          amountPaise: result.grandTotalPaise,
          currency: 'INR',
          orderNumber: result.orderNumber,
        });
      } catch (error) {
        await withTransaction(async (conn) => {
          for (const line of result.pricedItems) {
            await this.repo.restoreInventory(
              line.storeId,
              line.variantId,
              line.quantity,
              conn,
            );
          }
          for (const orderId of [result.orderId, ...result.siblingOrderIds]) {
            const payment = await this.repo.lockPaymentByOrderId(orderId, conn);
            if (payment && payment.status === 'PENDING') {
              await this.repo.updatePayment(payment.id, { status: 'FAILED' }, conn);
            }
            await this.repo.cancelPendingOnlineOrder(orderId, conn);
            await this.repo.addStatusHistory(
              {
                orderId,
                fromStatus: 'PENDING',
                toStatus: 'CANCELLED',
                changedByUserId: userId,
                note: 'Cancelled: payment provider unavailable',
              },
              conn,
            );
          }
        });
        throw error;
      }
    }

    for (const notice of result.pushes) {
      schedulePush(() => pushCustomerForOrder(notice.orderId, notice.copyKey));
      if (notice.claimable) {
        schedulePush(() => pushPartnersForOrder(notice.orderId, 'partner_new_order'));
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
      if (
        existingPayment.method === 'COD' &&
        existingPayment.provider_ref === input.razorpayOrderId &&
        verifyRazorpaySignature(input)
      ) {
        await this.repo.updatePayment(existingPayment.id, { method: 'UPI', provider: 'razorpay' });
      }
      return this.getByIdOrNumber(userId, order.id);
    }
    if (order.status === 'CANCELLED' || existingPayment.status === 'FAILED') {
      throw new ValidationError('This order is no longer awaiting payment');
    }
    if (existingPayment.status !== 'PENDING') {
      throw new ValidationError('Payment cannot be verified in its current state');
    }
    const startedOnline =
      existingPayment.provider === 'razorpay' ||
      (existingPayment.method === 'COD' && existingPayment.provider_ref === input.razorpayOrderId);
    if (!startedOnline) {
      throw new ValidationError('This order does not use online payment');
    }
    if (existingPayment.provider_ref !== input.razorpayOrderId) {
      throw new ValidationError('Razorpay order mismatch');
    }

    const valid = verifyRazorpaySignature(input);
    if (!valid) {
      throw new ValidationError('Invalid payment signature');
    }

    let capturedOrderIds: string[] = [];
    let deferredCodOrderIds: string[] = [];
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
          method: 'UPI',
          provider: 'razorpay',
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          verificationSource: 'checkout',
          paidAt: new Date(),
        },
        conn,
      );

      const capturedIds = [order.id];
      const deferredCodIds: string[] = [];
      const groupId = await this.repo.findCheckoutGroupId(order.id, conn);
      if (groupId) {
        const siblingIds = await this.repo.listOrderIdsByCheckoutGroup(groupId, conn);
        for (const siblingId of siblingIds) {
          if (siblingId === order.id) continue;
          const sibling = await this.repo.lockOrderById(siblingId, conn);
          if (!sibling || sibling.status !== 'PENDING') continue;
          const siblingPayment = await this.repo.lockPaymentByOrderId(siblingId, conn);
          if (!siblingPayment || siblingPayment.status !== 'PENDING') continue;

          if (
            siblingPayment.provider === 'razorpay' &&
            siblingPayment.provider_ref === input.razorpayOrderId
          ) {
            await this.repo.updatePayment(
              siblingPayment.id,
              {
                status: 'CAPTURED',
                method: 'UPI',
                provider: 'razorpay',
                razorpayOrderId: input.razorpayOrderId,
                razorpayPaymentId: input.razorpayPaymentId,
                verificationSource: 'checkout',
                paidAt: new Date(),
              },
              conn,
            );
            capturedIds.push(siblingId);
            continue;
          }

          if (isDeferredCodSiblingPayment(siblingPayment)) {
            deferredCodIds.push(siblingId);
          }
        }
      }

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
      capturedOrderIds = capturedIds;
      deferredCodOrderIds = deferredCodIds;
    });

    if (capturedOrderIds.length > 0) {
      schedulePush(() => pushCustomerForOrder(order.id, 'payment_successful'));
      for (const claimId of partnerClaimOrderIdsAfterPayment({
        capturedOrderIds,
        deferredCodOrderIds,
      })) {
        schedulePush(() => pushPartnersForOrder(claimId, 'partner_new_order'));
      }
    }

    return this.getByIdOrNumber(userId, order.id);
  }

  async abandonCheckoutPayment(userId: string, idOrNumber: string) {
    const orderId = await this.repo.findOwnedOrderId(userId, idOrNumber);
    if (!orderId) throw new NotFoundError('Order not found');

    await withTransaction(async (conn) => {
      const order = await this.repo.lockOrderById(orderId, conn);
      if (!order || order.user_id !== userId) {
        throw new NotFoundError('Order not found');
      }
      if (order.status === 'CANCELLED') {
        return;
      }
      if (order.status !== 'PENDING') {
        throw new ConflictError('This order can no longer be cancelled');
      }

      const payment = await this.repo.lockPaymentByOrderId(order.id, conn);
      if (!payment || payment.status === 'CAPTURED' || payment.razorpay_payment_id) {
        throw new ConflictError('This payment can no longer be cancelled');
      }
      if (payment.provider !== 'razorpay' || payment.status !== 'PENDING') {
        throw new ConflictError('This payment can no longer be cancelled');
      }

      const items = await this.repo.listItems(order.id, conn);
      for (const item of items) {
        await this.repo.restoreInventory(
          item.store_id || order.store_id,
          item.variant_id,
          item.quantity,
          conn,
        );
      }

      await this.restoreCartFromOrder(userId, order, items, conn);

      await this.repo.updatePayment(payment.id, { status: 'FAILED' }, conn);
      await this.repo.cancelPendingOnlineOrder(order.id, conn);
      await this.repo.addStatusHistory(
        {
          orderId: order.id,
          fromStatus: 'PENDING',
          toStatus: 'CANCELLED',
          changedByUserId: userId,
          note: CHECKOUT_ABANDONED_NOTE,
        },
        conn,
      );
      await this.notificationsRepo.deleteByOrderId(userId, order.id, conn);

      const groupId = await this.repo.findCheckoutGroupId(order.id, conn);
      if (groupId) {
        const siblingIds = await this.repo.listOrderIdsByCheckoutGroup(groupId, conn);
        for (const siblingId of siblingIds) {
          if (siblingId === order.id) continue;
          const sibling = await this.repo.lockOrderById(siblingId, conn);
          if (!sibling || sibling.status !== 'PENDING') continue;
          const siblingPayment = await this.repo.lockPaymentByOrderId(siblingId, conn);
          if (siblingPayment?.status === 'CAPTURED') continue;
          const siblingItems = await this.repo.listItems(siblingId, conn);
          for (const item of siblingItems) {
            await this.repo.restoreInventory(
              item.store_id || sibling.store_id,
              item.variant_id,
              item.quantity,
              conn,
            );
          }
          await this.restoreCartFromOrder(
            userId,
            { store_id: order.store_id, service_area_id: order.service_area_id },
            siblingItems,
            conn,
          );
          if (siblingPayment && siblingPayment.status === 'PENDING') {
            await this.repo.updatePayment(siblingPayment.id, { status: 'FAILED' }, conn);
          }
          await this.repo.cancelPendingOnlineOrder(siblingId, conn);
          await this.repo.addStatusHistory(
            {
              orderId: siblingId,
              fromStatus: 'PENDING',
              toStatus: 'CANCELLED',
              changedByUserId: userId,
              note: CHECKOUT_ABANDONED_NOTE,
            },
            conn,
          );
          await this.notificationsRepo.deleteByOrderId(userId, siblingId, conn);
        }
      }
    });

    return { abandoned: true };
  }

  async startOnlinePayment(userId: string, idOrNumber: string) {
    if (!isRazorpayConfigured()) {
      throw new ValidationError('Online payments are not configured');
    }

    const order = await this.repo.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    if (
      !canCustomerPayOnline({
        status: order.status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
      })
    ) {
      if (order.payment_status === 'CAPTURED') {
        return {
          alreadyPaid: true,
          razorpay: null,
          order: await this.getByIdOrNumber(userId, order.id),
        };
      }
      throw new ValidationError('This order cannot be paid online');
    }

    const prepared = await withTransaction(async (conn) => {
      const lockedOrder = await this.repo.lockOrderById(order.id, conn);
      if (!lockedOrder || lockedOrder.user_id !== userId) {
        throw new NotFoundError('Order not found');
      }
      if (lockedOrder.status === 'CANCELLED' || lockedOrder.status === 'DELIVERED') {
        throw new ValidationError('This order cannot be paid online');
      }

      const payment = await this.repo.lockPaymentByOrderId(order.id, conn);
      if (!payment) throw new NotFoundError('Payment not found');
      if (payment.status === 'CAPTURED') {
        return { alreadyPaid: true as const, razorpayOrderId: null };
      }
      if (payment.method !== 'COD' || payment.status !== 'PENDING') {
        throw new ValidationError('This order cannot be paid online');
      }

      return {
        alreadyPaid: false as const,
        razorpayOrderId: payment.provider === 'razorpay' ? payment.provider_ref : null,
        amountPaise: payment.amount_paise,
        addressId: lockedOrder.address_id,
        orderNumber: lockedOrder.order_number,
        paymentId: payment.id,
      };
    });

    if (prepared.alreadyPaid) {
      return {
        alreadyPaid: true,
        razorpay: null,
        order: await this.getByIdOrNumber(userId, order.id),
      };
    }

    let razorpayOrderId = prepared.razorpayOrderId;
    if (!razorpayOrderId) {
      const rzOrder = await createRazorpayOrder({
        amountPaise: prepared.amountPaise,
        receipt: prepared.orderNumber,
        notes: { orderId: order.id, orderNumber: prepared.orderNumber },
      });
      razorpayOrderId = rzOrder.id;
      await withTransaction(async (conn) => {
        const payment = await this.repo.lockPaymentByOrderId(order.id, conn);
        if (!payment || payment.status !== 'PENDING' || payment.method !== 'COD') {
          throw new ConflictError('This order can no longer be paid online');
        }
        await this.repo.updatePayment(
          payment.id,
          {
            provider: 'razorpay',
            providerRef: rzOrder.id,
            razorpayOrderId: rzOrder.id,
          },
          conn,
        );
      });
    }

    const razorpay = await this.buildRazorpayCheckout({
      userId,
      addressId: prepared.addressId,
      razorpayOrderId,
      amountPaise: prepared.amountPaise,
      currency: order.currency,
      orderNumber: prepared.orderNumber,
    });

    return {
      alreadyPaid: false,
      razorpay,
      order: await this.getByIdOrNumber(userId, order.id),
    };
  }

  private async buildRazorpayCheckout(input: {
    userId: string;
    addressId: string;
    razorpayOrderId: string;
    amountPaise: number;
    currency: string;
    orderNumber: string;
  }): Promise<RazorpayCheckoutPayload> {
    const customer = await this.repo.findCustomerPrefill(input.userId, input.addressId);
    const contact = formatRazorpayContact(
      customer?.phone_country_code,
      customer?.phone,
    );
    const customerName = (customer?.full_name || customer?.address_full_name || '').trim();
    const email = (customer?.email ?? '').trim();
    return {
      keyId: getRazorpayKeyId(),
      orderId: input.razorpayOrderId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      name: 'DayFax',
      description: `Order ${input.orderNumber}`,
      ...(contact ? { contact } : {}),
      ...(customerName ? { customerName } : {}),
      ...(email ? { email } : {}),
    };
  }

  private async restoreCartFromOrder(
    userId: string,
    order: { store_id: string; service_area_id: string },
    items: OrderItemRow[],
    conn: PoolConnection,
  ) {
    let cart = await this.cartRepo.findActiveCart(userId, conn);
    if (cart && cart.store_id !== order.store_id) {
      const existing = await this.cartRepo.listItems(cart.id, conn);
      if (existing.length === 0) {
        await this.cartRepo.abandonCart(cart.id, conn);
        cart = null;
      }
    }

    let cartId = cart && cart.store_id === order.store_id ? cart.id : null;
    if (!cartId) {
      if (cart) {
        await this.cartRepo.abandonCart(cart.id, conn);
      }
      cartId = await this.cartRepo.createCart(
        {
          userId,
          storeId: order.store_id,
          serviceAreaId: order.service_area_id,
        },
        conn,
      );
    }

    for (const item of items) {
      const lineStoreId = item.store_id || order.store_id;
      const existing = await this.cartRepo.findItemByVariant(
        cartId,
        item.variant_id,
        lineStoreId,
        conn,
      );
      if (existing) {
        await this.cartRepo.updateItem(
          existing.id,
          { quantity: existing.quantity + item.quantity, unitPricePaise: item.unit_price_paise },
          conn,
        );
      } else {
        await this.cartRepo.insertItem(
          {
            cartId,
            storeId: lineStoreId,
            variantId: item.variant_id,
            quantity: item.quantity,
            unitPricePaise: item.unit_price_paise,
          },
          conn,
        );
      }
    }
    await this.cartRepo.touchCart(cartId, conn);
  }

  async list(userId: string, query: ListOrdersQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const total = await this.repo.countByUser(userId);
    const rows = await this.repo.listByUser(userId, limit, offset);
    const returnStatuses = await this.supportRepo.latestReturnStatusByOrderIds(rows.map((row) => row.id));
    const groupIds = [
      ...new Set(rows.map((row) => row.checkout_group_id).filter((id): id is string => Boolean(id))),
    ];
    const linkedByGroup = new Map<string, Array<{ id: string; orderNumber: string; isLocalShop: boolean }>>();
    await Promise.all(
      groupIds.map(async (groupId) => {
        linkedByGroup.set(groupId, await this.repo.listCheckoutGroupSummaries(groupId));
      }),
    );
    return {
      items: rows.map((row) => {
        const returnStatus = returnStatuses.get(row.id);
        const linkedOrders = row.checkout_group_id
          ? (linkedByGroup.get(row.checkout_group_id) ?? []).filter((linked) => linked.id !== row.id)
          : [];
        return {
          ...mapOrderSummary(row),
          linkedOrders,
          returnRequest: returnStatus ? { status: returnStatus } : null,
        };
      }),
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
        let otp = generateDeliveryOtp();
        if (order!.checkout_group_id) {
          const siblingIds = await this.repo.listOrderIdsByCheckoutGroup(order!.checkout_group_id, conn);
          for (const siblingId of siblingIds) {
            const state = await this.repo.getDeliveryOtpState(siblingId, conn);
            if (state?.delivery_otp) {
              otp = state.delivery_otp;
              break;
            }
          }
        }
        await this.repo.ensureDeliveryOtp(order!.id, otp, conn);
      });
      order = (await this.repo.findByIdOrNumberForUser(userId, order.id)) ?? order;
    }

    const [items, history, returnRequest] = await Promise.all([
      this.repo.listItems(order.id),
      this.repo.listStatusHistory(order.id),
      this.supportRepo.findLatestReturnForOrder(order.id),
    ]);
    const returnItems = returnRequest
      ? await this.supportRepo.listReturnItems(returnRequest.id)
      : [];

    const linkedOrders = order.checkout_group_id
      ? (await this.repo.listCheckoutGroupSummaries(order.checkout_group_id)).filter(
          (linked) => linked.id !== order.id,
        )
      : [];

    return {
      ...mapOrderSummary(order),
      linkedOrders,
      canCancel: !order.is_local_shop && isCustomerCancellableStatus(order.status),
      canPayOnline: canCustomerPayOnline({
        status: order.status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
      }),
      canChatSupport: order.status === 'DELIVERED',
      items: items.map(mapItem),
      timeline: mapTimeline(history, order.status),
      returnRequest: returnRequest
        ? {
            ...mapReturnForCustomer(returnRequest),
            items: returnItems.map((item) => ({
              orderItemId: item.order_item_id,
              productName: item.product_name,
              variantLabel: item.variant_label,
              quantity: item.quantity,
            })),
          }
        : null,
    };
  }

  async cancel(userId: string, idOrNumber: string) {
    const order = await this.repo.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    const refund = await this.cancelService.cancel({
      orderId: order.id,
      actorUserId: userId,
      note: 'Cancelled by customer',
      source: 'customer',
    });
    const updated = await this.getByIdOrNumber(userId, order.id);
    return { ...updated, refund };
  }

  async getTimeline(userId: string, idOrNumber: string) {
    const order = await this.repo.findByIdOrNumberForUser(userId, idOrNumber);
    if (!order) throw new NotFoundError('Order not found');
    const history = await this.repo.listStatusHistory(order.id);
    return mapTimeline(history, order.status);
  }
}
