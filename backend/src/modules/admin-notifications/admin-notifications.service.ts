import { ValidationError } from '../../common/errors/app-error.js';
import { logger } from '../../common/logger/logger.js';
import { createId } from '../../common/utils/id.js';
import { DevicesRepository } from '../devices/devices.repository.js';
import { OrderDeliveryNotificationsRepository } from '../notifications/order-delivery-notifications.repository.js';
import { pushCustom } from '../notifications/push.service.js';
import { AdminNotificationsRepository } from './admin-notifications.repository.js';
import type { SendPromoInput } from './admin-notifications.schema.js';

const INBOX_BATCH = 200;

function hindiOrEnglish(hindi: string, english: string) {
  return hindi.trim() || english;
}

export class AdminNotificationsService {
  constructor(
    private readonly repo = new AdminNotificationsRepository(),
    private readonly devices = new DevicesRepository(),
    private readonly orderAlerts = new OrderDeliveryNotificationsRepository(),
  ) {}

  async list() {
    const rows = await this.repo.listRecent();
    return rows.map((row) => ({
      id: row.id,
      audience: row.audience,
      title: row.title,
      titleHi: row.title_hi,
      body: row.body,
      bodyHi: row.body_hi,
      recipientCount: row.recipient_count,
      sentCount: row.sent_count,
      createdAt: row.created_at,
    }));
  }

  async listOrderAlerts(input: { page: number; limit: number; orderId?: string }) {
    const offset = (input.page - 1) * input.limit;
    const result = await this.orderAlerts.listForAdmin({
      orderId: input.orderId,
      limit: input.limit,
      offset,
    });
    const totalPages = Math.max(1, Math.ceil(result.total / input.limit));
    return {
      items: result.items.map((row) => ({
        id: row.id,
        orderId: row.order_id,
        orderNumber: row.order_number ?? null,
        deliveryBoyId: row.delivery_boy_id,
        partnerName: row.partner_name ?? null,
        notificationType: row.notification_type,
        status: row.status,
        attemptCount: row.attempt_count,
        failureReason: row.failure_reason,
        sentAt: row.sent_at,
        createdAt: row.created_at,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total: result.total,
        totalPages,
        hasNextPage: input.page < totalPages,
        hasPreviousPage: input.page > 1,
      },
    };
  }

  async send(adminId: string, input: SendPromoInput) {
    const targets = await this.devices.listForPromo(input.audience);
    if (targets.length === 0) {
      throw new ValidationError('No registered devices for that audience yet.');
    }

    const promoId = createId();
    const customerRows = targets.filter((row) => row.app_role === 'CUSTOMER');
    const partnerRows = targets.filter((row) => row.app_role === 'DELIVERY_PARTNER');

    const titleHi = hindiOrEnglish(input.titleHi, input.title);
    const bodyHi = hindiOrEnglish(input.bodyHi, input.body);

    const customerPush = await pushCustom({
      rows: customerRows,
      titleEn: input.title,
      titleHi,
      bodyEn: input.body,
      bodyHi,
      audience: 'customer',
      promoId,
    });
    const partnerPush = await pushCustom({
      rows: partnerRows,
      titleEn: input.title,
      titleHi,
      bodyEn: input.body,
      bodyHi,
      audience: 'partner',
      promoId,
    });

    if (!customerPush.configured && !partnerPush.configured) {
      throw new ValidationError('Push is not configured on the server.');
    }

    const inboxByUser = new Map<string, { title: string; body: string }>();
    for (const row of customerRows) {
      if (inboxByUser.has(row.user_id)) continue;
      const hindi = row.locale === 'hi';
      inboxByUser.set(row.user_id, {
        title: hindi ? titleHi : input.title,
        body: hindi ? bodyHi : input.body,
      });
    }

    const inbox = [...inboxByUser.entries()].map(([userId, copy]) => ({
      userId,
      title: copy.title,
      body: copy.body,
      promoId,
    }));
    for (let offset = 0; offset < inbox.length; offset += INBOX_BATCH) {
      await this.repo.insertInbox(inbox.slice(offset, offset + INBOX_BATCH));
    }

    const sentCount = customerPush.sent + partnerPush.sent;
    await this.repo.insert({
      id: promoId,
      audience: input.audience,
      title: input.title,
      titleHi: input.titleHi,
      body: input.body,
      bodyHi: input.bodyHi,
      recipientCount: targets.length,
      sentCount,
      sentByAdminId: adminId,
    });

    logger.info('promo_notification_sent', {
      promoId,
      audience: input.audience,
      recipientCount: targets.length,
      sentCount,
      adminId,
    });

    return {
      id: promoId,
      audience: input.audience,
      recipientCount: targets.length,
      sentCount,
      failedCount: customerPush.failed + partnerPush.failed,
    };
  }
}
