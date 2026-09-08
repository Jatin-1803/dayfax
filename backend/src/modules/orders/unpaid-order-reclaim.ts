import { env } from '../../config/env.js';
import { withTransaction } from '../../common/database/pool.js';
import { logger } from '../../common/logger/logger.js';
import { NotificationsRepository } from '../notifications/notifications.repository.js';
import { OrdersRepository } from './orders.repository.js';

const BATCH_LIMIT = 50;

export class UnpaidOrderReclaimService {
  constructor(
    private readonly repo = new OrdersRepository(),
    private readonly notificationsRepo = new NotificationsRepository(),
  ) {}

  /**
   * Cancels abandoned online (Razorpay) PENDING orders and restores inventory.
   * Safe under concurrency via FOR UPDATE SKIP LOCKED + payment/order locks.
   */
  async reclaimExpired(options?: {
    ttlMinutes?: number;
    limit?: number;
  }): Promise<{ scanned: number; reclaimed: number }> {
    const ttlMinutes = options?.ttlMinutes ?? env.UNPAID_ORDER_TTL_MINUTES;
    const limit = options?.limit ?? BATCH_LIMIT;

    return withTransaction(async (conn) => {
      const expired = await this.repo.listExpiredUnpaidOnlineOrders(ttlMinutes, limit, conn);
      let reclaimed = 0;

      for (const row of expired) {
        const order = await this.repo.lockOrderById(row.id, conn);
        if (!order || order.status !== 'PENDING') {
          continue;
        }

        const payment = await this.repo.lockPaymentByOrderId(order.id, conn);
        if (!payment || payment.status !== 'PENDING' || payment.provider !== 'razorpay') {
          continue;
        }

        const items = await this.repo.listItems(order.id, conn);
        const sorted = [...items].sort((a, b) => a.variant_id.localeCompare(b.variant_id));
        for (const item of sorted) {
          await this.repo.restoreInventory(order.store_id, item.variant_id, item.quantity, conn);
        }

        await this.repo.updatePayment(payment.id, { status: 'FAILED' }, conn);
        await this.repo.cancelPendingOnlineOrder(order.id, conn);
        await this.repo.addStatusHistory(
          {
            orderId: order.id,
            fromStatus: 'PENDING',
            toStatus: 'CANCELLED',
            changedByUserId: undefined,
            note: `Cancelled: payment not completed within ${ttlMinutes} minutes`,
          },
          conn,
        );
        await this.notificationsRepo.create(
          {
            userId: order.user_id,
            title: 'Order cancelled',
            body: `Order ${order.order_number} was cancelled because payment was not completed. Stock has been released.`,
            meta: {
              type: 'order',
              orderId: order.id,
              orderNumber: order.order_number,
            },
          },
          conn,
        );
        reclaimed += 1;
      }

      return { scanned: expired.length, reclaimed };
    });
  }
}

let reclaimTimer: NodeJS.Timeout | null = null;
let reclaimInFlight = false;

export function startUnpaidOrderReclaimScheduler(): void {
  if (!env.UNPAID_ORDER_RECLAIM_ENABLED) {
    logger.info('Unpaid order reclaim scheduler disabled');
    return;
  }
  if (reclaimTimer) return;

  const service = new UnpaidOrderReclaimService();
  const tick = async () => {
    if (reclaimInFlight) return;
    reclaimInFlight = true;
    try {
      const result = await service.reclaimExpired();
      if (result.reclaimed > 0 || result.scanned > 0) {
        logger.info('Unpaid order reclaim finished', result);
      }
    } catch (error) {
      logger.error('Unpaid order reclaim failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      reclaimInFlight = false;
    }
  };

  // Delay first run slightly so listen() completes first.
  const initial = setTimeout(() => {
    void tick();
  }, 5_000);
  reclaimTimer = setInterval(() => {
    void tick();
  }, env.UNPAID_ORDER_RECLAIM_INTERVAL_MS);
  reclaimTimer.unref?.();
  initial.unref?.();

  logger.info('Unpaid order reclaim scheduler started', {
    ttlMinutes: env.UNPAID_ORDER_TTL_MINUTES,
    intervalMs: env.UNPAID_ORDER_RECLAIM_INTERVAL_MS,
  });
}

export function stopUnpaidOrderReclaimScheduler(): void {
  if (reclaimTimer) {
    clearInterval(reclaimTimer);
    reclaimTimer = null;
  }
}
