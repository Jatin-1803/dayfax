import { existsSync } from 'node:fs';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env.js';
import { getPool } from '../../common/database/pool.js';
import { logger } from '../../common/logger/logger.js';
import { DevicesRepository, type DeviceTokenRow } from '../devices/devices.repository.js';
import { pushCopy, type PushCopyKey, type PushLocale } from './push-copy.js';

const FCM_BATCH = 500;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
const TEMPORARY_TOKEN_CODES = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/unavailable',
  'messaging/timeout',
  'messaging/message-rate-exceeded',
  'messaging/quota-exceeded',
]);

export const PARTNER_NEW_ORDER_CHANNEL = 'dayfax_new_orders';
export const DEFAULT_PUSH_CHANNEL = 'dayfax_orders';

type MessagingClient = {
  sendEachForMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data: Record<string, string>;
    android: {
      priority: 'high';
      notification?: {
        channelId: string;
        sound?: string;
        defaultVibrateTimings?: boolean;
        priority?: 'max' | 'high';
        visibility?: 'public';
      };
    };
    apns: {
      headers?: Record<string, string>;
      payload: {
        aps: {
          sound: string;
          'interruption-level'?: string;
        };
      };
    };
  }): Promise<{
    responses: Array<{ success: boolean; error?: { code?: string } }>;
  }>;
};

let messagingClient: MessagingClient | null | undefined;
let warnedMissingConfig = false;

async function loadMessaging(): Promise<MessagingClient | null> {
  if (messagingClient !== undefined) return messagingClient;

  const path = (env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '').trim();
  if (!path || !existsSync(path)) {
    messagingClient = null;
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      logger.info('push_skipped', { reason: 'firebase_not_configured' });
    }
    return null;
  }

  try {
    const appModule = await import('firebase-admin/app');
    const messagingModule = await import('firebase-admin/messaging');
    if (appModule.getApps().length === 0) {
      appModule.initializeApp({
        credential: appModule.cert(path),
      });
    }
    messagingClient = messagingModule.getMessaging();
    return messagingClient;
  } catch (error) {
    messagingClient = null;
    logger.warn('push_init_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

function groupByLocale(rows: DeviceTokenRow[]): Map<PushLocale, string[]> {
  const grouped = new Map<PushLocale, string[]>();
  for (const row of rows) {
    const locale: PushLocale = row.locale === 'hi' ? 'hi' : 'en';
    const list = grouped.get(locale) ?? [];
    list.push(row.fcm_token);
    grouped.set(locale, list);
  }
  return grouped;
}

export type PartnerPushResult = {
  sent: number;
  temporaryFailures: number;
  permanentFailures: number;
  configured: boolean;
};

export async function sendPartnerPush(input: {
  tokens: string[];
  title: string;
  body: string;
  data: Record<string, string>;
  highPriorityChannel: boolean;
}): Promise<PartnerPushResult> {
  const messaging = await loadMessaging();
  if (!messaging || input.tokens.length === 0) {
    return { sent: 0, temporaryFailures: 0, permanentFailures: 0, configured: Boolean(messaging) };
  }

  const invalid: string[] = [];
  const devices = new DevicesRepository();
  let sent = 0;
  let temporaryFailures = 0;
  let permanentFailures = 0;
  const channelId = input.highPriorityChannel ? PARTNER_NEW_ORDER_CHANNEL : DEFAULT_PUSH_CHANNEL;

  for (let offset = 0; offset < input.tokens.length; offset += FCM_BATCH) {
    const batch = input.tokens.slice(offset, offset + FCM_BATCH);
    const result = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: input.title, body: input.body },
      data: input.data,
      android: {
        priority: 'high',
        notification: {
          channelId,
          sound: 'default',
          defaultVibrateTimings: true,
          priority: input.highPriorityChannel ? 'max' : 'high',
          visibility: 'public',
        },
      },
      apns: {
        headers: input.highPriorityChannel
          ? { 'apns-priority': '10', 'apns-push-type': 'alert' }
          : { 'apns-priority': '10' },
        payload: {
          aps: {
            sound: 'default',
            ...(input.highPriorityChannel ? { 'interruption-level': 'time-sensitive' } : {}),
          },
        },
      },
    });

    result.responses.forEach((item, index) => {
      if (item.success) {
        sent += 1;
        return;
      }
      const code = item.error?.code;
      if (code && INVALID_TOKEN_CODES.has(code)) {
        permanentFailures += 1;
        const token = batch[index];
        if (token) invalid.push(token);
        return;
      }
      if (code && TEMPORARY_TOKEN_CODES.has(code)) {
        temporaryFailures += 1;
        return;
      }
      permanentFailures += 1;
    });
  }

  if (invalid.length > 0) {
    await devices.deleteTokens(invalid);
  }

  return { sent, temporaryFailures, permanentFailures, configured: true };
}

async function sendRows(
  rows: DeviceTokenRow[],
  input: { copyKey: PushCopyKey; orderId: string; orderNumber: string; audience: 'customer' | 'partner' },
): Promise<void> {
  const messaging = await loadMessaging();
  if (!messaging || rows.length === 0) return;

  const invalid: string[] = [];
  const devices = new DevicesRepository();
  const isPartnerNewOrder = input.copyKey === 'partner_new_order';
  const channelId = isPartnerNewOrder ? PARTNER_NEW_ORDER_CHANNEL : DEFAULT_PUSH_CHANNEL;

  for (const [locale, tokens] of groupByLocale(rows)) {
    const copy = pushCopy(input.copyKey, locale, input.orderNumber);
    for (let offset = 0; offset < tokens.length; offset += FCM_BATCH) {
      const batch = tokens.slice(offset, offset + FCM_BATCH);
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: copy.title, body: copy.body },
        data: {
          type: input.copyKey,
          orderId: input.orderId,
          audience: input.audience,
        },
        android: {
          priority: 'high',
          notification: {
            channelId,
            sound: 'default',
            defaultVibrateTimings: true,
            priority: isPartnerNewOrder ? 'max' : 'high',
            visibility: 'public',
          },
        },
        apns: {
          headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
          payload: {
            aps: {
              sound: 'default',
              ...(isPartnerNewOrder ? { 'interruption-level': 'time-sensitive' } : {}),
            },
          },
        },
      });
      result.responses.forEach((item, index) => {
        if (!item.success && item.error?.code && INVALID_TOKEN_CODES.has(item.error.code)) {
          const token = batch[index];
          if (token) invalid.push(token);
        }
      });
    }
  }

  if (invalid.length > 0) {
    await devices.deleteTokens(invalid);
  }
}

export function schedulePush(task: () => Promise<void>): void {
  void task().catch((error: unknown) => {
    logger.warn('push_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  });
}

export async function pushToUser(input: {
  userId: string;
  appRole: 'CUSTOMER' | 'DELIVERY_PARTNER';
  copyKey: PushCopyKey;
  orderId: string;
  orderNumber: string;
}): Promise<void> {
  const devices = new DevicesRepository();
  const rows = await devices.listForUser(input.userId, input.appRole);
  await sendRows(rows, {
    copyKey: input.copyKey,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    audience: input.appRole === 'DELIVERY_PARTNER' ? 'partner' : 'customer',
  });
}

export async function pushToPartners(input: {
  copyKey: PushCopyKey;
  orderId: string;
  orderNumber: string;
}): Promise<void> {
  const devices = new DevicesRepository();
  const rows = await devices.listForDeliveryPartners();
  await sendRows(rows, {
    copyKey: input.copyKey,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    audience: 'partner',
  });
}

export async function pushPartnersForOrder(orderId: string, copyKey: PushCopyKey): Promise<void> {
  if (copyKey === 'partner_new_order') {
    const { notifyPartnersNewOrder } = await import('./partner-new-order.service.js');
    await notifyPartnersNewOrder(orderId);
    return;
  }

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT order_number
     FROM orders
     WHERE id = ?
     LIMIT 1`,
    [orderId],
  );
  const order = rows[0] as { order_number: string } | undefined;
  if (!order) return;
  await pushToPartners({
    copyKey,
    orderId,
    orderNumber: order.order_number,
  });
}

export async function pushCustom(input: {
  rows: DeviceTokenRow[];
  titleEn: string;
  titleHi: string;
  bodyEn: string;
  bodyHi: string;
  audience: 'customer' | 'partner';
  promoId: string;
}): Promise<{ sent: number; failed: number; configured: boolean }> {
  const messaging = await loadMessaging();
  if (!messaging || input.rows.length === 0) {
    return { sent: 0, failed: 0, configured: Boolean(messaging) };
  }

  let sent = 0;
  let failed = 0;
  const invalid: string[] = [];
  const devices = new DevicesRepository();
  const grouped = groupByLocale(input.rows);

  for (const [locale, tokens] of grouped) {
    const title = locale === 'hi' ? input.titleHi : input.titleEn;
    const body = locale === 'hi' ? input.bodyHi : input.bodyEn;
    for (let offset = 0; offset < tokens.length; offset += FCM_BATCH) {
      const batch = tokens.slice(offset, offset + FCM_BATCH);
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: {
          type: 'promo',
          audience: input.audience,
          promoId: input.promoId,
        },
        android: {
          priority: 'high',
          notification: {
            channelId: DEFAULT_PUSH_CHANNEL,
            sound: 'default',
            defaultVibrateTimings: true,
            priority: 'high',
            visibility: 'public',
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default' } },
        },
      });
      result.responses.forEach((item, index) => {
        if (item.success) {
          sent += 1;
          return;
        }
        failed += 1;
        if (item.error?.code && INVALID_TOKEN_CODES.has(item.error.code)) {
          const token = batch[index];
          if (token) invalid.push(token);
        }
      });
    }
  }

  if (invalid.length > 0) {
    await devices.deleteTokens(invalid);
  }

  return { sent, failed, configured: true };
}

export async function pushCustomerForOrder(orderId: string, copyKey: PushCopyKey): Promise<void> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT user_id, order_number
     FROM orders
     WHERE id = ?
     LIMIT 1`,
    [orderId],
  );
  const order = rows[0] as { user_id: string; order_number: string } | undefined;
  if (!order) return;
  await pushToUser({
    userId: order.user_id,
    appRole: 'CUSTOMER',
    copyKey,
    orderId,
    orderNumber: order.order_number,
  });
}
