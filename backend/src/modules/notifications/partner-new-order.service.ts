import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';
import { logger } from '../../common/logger/logger.js';
import { isClaimableOrder } from '../orders/order-acceptance.js';
import { DevicesRepository } from '../devices/devices.repository.js';
import { OrderDeliveryNotificationsRepository } from './order-delivery-notifications.repository.js';
import type { PushCopyExtras, PushLocale } from './push-copy.js';
import { pushCopy } from './push-copy.js';
import { sendPartnerPush, schedulePush } from './push.service.js';

const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [800, 2500];

type PartnerOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  grand_total_paise: number;
  store_name: string | null;
  address_city: string | null;
  address_landmark: string | null;
  address_pincode: string | null;
  payment_method: string | null;
  payment_status: string | null;
};

function formatAmountPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function areaLabel(order: PartnerOrderSummary): string | undefined {
  const parts = [order.address_landmark, order.address_city, order.address_pincode].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  if (parts.length === 0) return undefined;
  return parts.slice(0, 2).join(', ');
}

function extrasFor(order: PartnerOrderSummary, locale: PushLocale): PushCopyExtras {
  const isCod = order.payment_method === 'COD';
  return {
    storeName: order.store_name?.trim() || undefined,
    area: areaLabel(order),
    paymentLabel: isCod ? (locale === 'hi' ? 'COD' : 'COD') : locale === 'hi' ? 'पेड' : 'Paid',
    amountLabel: formatAmountPaise(order.grand_total_paise),
  };
}

async function loadClaimableOrder(orderId: string): Promise<PartnerOrderSummary | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT o.id, o.order_number, o.status, o.grand_total_paise,
            s.name AS store_name,
            a.city AS address_city, a.landmark AS address_landmark, a.pincode AS address_pincode,
            p.method AS payment_method, p.status AS payment_status
     FROM orders o
     LEFT JOIN stores s ON s.id = o.store_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE o.id = ?
     LIMIT 1`,
    [orderId],
  );
  const order = rows[0] as PartnerOrderSummary | undefined;
  if (!order) return null;
  if (
    !isClaimableOrder(order.status, {
      method: order.payment_method ?? 'COD',
      status: order.payment_status ?? 'PENDING',
    })
  ) {
    return null;
  }
  return order;
}

async function loadOrderNumber(orderId: string): Promise<string | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT order_number FROM orders WHERE id = ? LIMIT 1`,
    [orderId],
  );
  return (rows[0] as { order_number: string } | undefined)?.order_number ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Post-commit partner fan-out for a newly claimable order.
 * Idempotent per (order, partner, type). Never blocks the checkout API.
 */
export function schedulePartnerNewOrderAlert(orderId: string): void {
  schedulePush(async () => {
    await notifyPartnersNewOrder(orderId);
  });
}

export async function notifyPartnersNewOrder(orderId: string): Promise<void> {
  const order = await loadClaimableOrder(orderId);
  if (!order) {
    logger.info('partner_new_order_skipped', { orderId, reason: 'not_claimable' });
    return;
  }

  const devices = new DevicesRepository();
  const audit = new OrderDeliveryNotificationsRepository();
  const deviceRows = await devices.listEligiblePartnerDevices();
  if (deviceRows.length === 0) {
    logger.info('partner_new_order_skipped', { orderId, reason: 'no_partner_devices' });
    return;
  }

  const byPartner = new Map<string, Array<{ fcm_token: string; locale: PushLocale }>>();
  for (const row of deviceRows) {
    const list = byPartner.get(row.user_id) ?? [];
    list.push({
      fcm_token: row.fcm_token,
      locale: row.locale === 'hi' ? 'hi' : 'en',
    });
    byPartner.set(row.user_id, list);
  }

  logger.info('notification_created', {
    orderId,
    type: 'partner_new_order',
    partnerCount: byPartner.size,
  });

  for (const [partnerId, tokens] of byPartner) {
    const claimId = await audit.claim({
      orderId,
      deliveryBoyId: partnerId,
      notificationType: 'partner_new_order',
      meta: {
        orderNumber: order.order_number,
        storeName: order.store_name,
      },
    });
    if (!claimId) {
      logger.info('notification_duplicate_skipped', {
        orderId,
        partnerId,
        type: 'partner_new_order',
      });
      continue;
    }

    await sendWithRetries({
      claimId,
      orderId,
      partnerId,
      tokens,
      order,
      audit,
    });
  }
}

async function sendWithRetries(input: {
  claimId: string;
  orderId: string;
  partnerId: string;
  tokens: Array<{ fcm_token: string; locale: PushLocale }>;
  order: PartnerOrderSummary;
  audit: OrderDeliveryNotificationsRepository;
}): Promise<void> {
  let lastError = 'unknown';
  for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const stillClaimable = await loadClaimableOrder(input.orderId);
      if (!stillClaimable) {
        await input.audit.markFailed(input.claimId, 'order_unavailable');
        logger.info('notification_expired', {
          orderId: input.orderId,
          partnerId: input.partnerId,
        });
        return;
      }

      const byLocale = new Map<PushLocale, string[]>();
      for (const token of input.tokens) {
        const list = byLocale.get(token.locale) ?? [];
        list.push(token.fcm_token);
        byLocale.set(token.locale, list);
      }

      let anySent = false;
      for (const [locale, fcmTokens] of byLocale) {
        const extras = extrasFor(input.order, locale);
        const copy = pushCopy('partner_new_order', locale, input.order.order_number, extras);
        const result = await sendPartnerPush({
          tokens: fcmTokens,
          title: copy.title,
          body: copy.body,
          data: {
            type: 'partner_new_order',
            orderId: input.orderId,
            orderNumber: input.order.order_number,
            audience: 'partner',
            storeName: extras.storeName ?? '',
            area: extras.area ?? '',
            paymentMethod: input.order.payment_method ?? '',
            amountPaise: String(input.order.grand_total_paise),
          },
          highPriorityChannel: true,
        });
        if (result.sent > 0) anySent = true;
        if (result.permanentFailures > 0 && result.sent === 0 && result.temporaryFailures === 0) {
          lastError = 'invalid_tokens';
        } else if (result.temporaryFailures > 0) {
          lastError = 'temporary_fcm_failure';
        }
      }

      if (anySent) {
        await input.audit.markSent(input.claimId);
        logger.info('notification_sent', {
          orderId: input.orderId,
          partnerId: input.partnerId,
          type: 'partner_new_order',
        });
        return;
      }

      lastError = lastError || 'send_failed';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'unknown';
      logger.warn('notification_failed', {
        orderId: input.orderId,
        partnerId: input.partnerId,
        attempt: attempt + 1,
        message: lastError,
      });
    }

    const delay = RETRY_DELAYS_MS[attempt];
    if (delay != null) await sleep(delay);
  }

  await input.audit.markFailed(input.claimId, lastError);
  logger.warn('notification_failed', {
    orderId: input.orderId,
    partnerId: input.partnerId,
    type: 'partner_new_order',
    final: true,
    message: lastError,
  });
}

/**
 * After atomic claim — tell other notified partners the order is gone.
 */
export function schedulePartnerOrderTakenAlerts(
  orderId: string,
  acceptedByPartnerId: string,
): void {
  schedulePush(async () => {
    await notifyPartnersOrderTaken(orderId, acceptedByPartnerId);
  });
}

export async function notifyPartnersOrderTaken(
  orderId: string,
  acceptedByPartnerId: string,
): Promise<void> {
  const orderNumber = await loadOrderNumber(orderId);
  if (!orderNumber) return;

  const audit = new OrderDeliveryNotificationsRepository();
  await audit.markAccepted(orderId, acceptedByPartnerId);
  await audit.markExpiredForOrder(orderId, acceptedByPartnerId);

  const notified = await audit.listPartnerIdsNotified(orderId);
  const others = notified.filter((id) => id !== acceptedByPartnerId);
  if (others.length === 0) return;

  const devices = new DevicesRepository();
  const deviceRows = await devices.listDevicesForPartners(others);
  const byPartner = new Map<string, Array<{ fcm_token: string; locale: PushLocale }>>();
  for (const row of deviceRows) {
    const list = byPartner.get(row.user_id) ?? [];
    list.push({
      fcm_token: row.fcm_token,
      locale: row.locale === 'hi' ? 'hi' : 'en',
    });
    byPartner.set(row.user_id, list);
  }

  for (const [partnerId, tokens] of byPartner) {
    const claimId = await audit.claim({
      orderId,
      deliveryBoyId: partnerId,
      notificationType: 'partner_order_taken',
    });
    if (!claimId) continue;

    try {
      const byLocale = new Map<PushLocale, string[]>();
      for (const token of tokens) {
        const list = byLocale.get(token.locale) ?? [];
        list.push(token.fcm_token);
        byLocale.set(token.locale, list);
      }
      let anySent = false;
      for (const [locale, fcmTokens] of byLocale) {
        const copy = pushCopy('partner_order_taken', locale, orderNumber);
        const result = await sendPartnerPush({
          tokens: fcmTokens,
          title: copy.title,
          body: copy.body,
          data: {
            type: 'partner_order_taken',
            orderId,
            orderNumber,
            audience: 'partner',
          },
          highPriorityChannel: false,
        });
        if (result.sent > 0) anySent = true;
      }
      if (anySent) {
        await audit.markSent(claimId);
      } else {
        await audit.markFailed(claimId, 'send_failed');
      }
    } catch (error) {
      await audit.markFailed(
        claimId,
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }
}
