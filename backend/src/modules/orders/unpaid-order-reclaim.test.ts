import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    UNPAID_ORDER_TTL_MINUTES: 15,
    UNPAID_ORDER_RECLAIM_INTERVAL_MS: 60_000,
    UNPAID_ORDER_RECLAIM_ENABLED: true,
  },
}));

vi.mock('../../common/database/pool.js', () => ({
  withTransaction: async (work: (conn: unknown) => Promise<unknown>) => work({}),
}));

vi.mock('../../common/logger/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { UnpaidOrderReclaimService } from './unpaid-order-reclaim.js';

describe('UnpaidOrderReclaimService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores inventory and cancels expired unpaid online orders', async () => {
    const repo = {
      listExpiredUnpaidOnlineOrders: vi.fn().mockResolvedValue([
        {
          id: 'order-1',
          user_id: 'user-1',
          store_id: 'store-1',
          order_number: 'DF20260101-ABC',
        },
      ]),
      lockOrderById: vi.fn().mockResolvedValue({
        id: 'order-1',
        status: 'PENDING',
        store_id: 'store-1',
        user_id: 'user-1',
        order_number: 'DF20260101-ABC',
      }),
      lockPaymentByOrderId: vi.fn().mockResolvedValue({
        id: 'pay-1',
        order_id: 'order-1',
        method: 'UPI',
        status: 'PENDING',
        amount_paise: 1000,
        provider: 'razorpay',
        provider_ref: 'rzp_1',
      }),
      listItems: vi.fn().mockResolvedValue([
        { variant_id: 'var-b', quantity: 2 },
        { variant_id: 'var-a', quantity: 1 },
      ]),
      restoreInventory: vi.fn().mockResolvedValue(undefined),
      updatePayment: vi.fn().mockResolvedValue(undefined),
      cancelPendingOnlineOrder: vi.fn().mockResolvedValue(undefined),
      addStatusHistory: vi.fn().mockResolvedValue(undefined),
    };
    const notificationsRepo = {
      create: vi.fn().mockResolvedValue('n1'),
    };

    const service = new UnpaidOrderReclaimService(repo as never, notificationsRepo as never);
    const result = await service.reclaimExpired({ ttlMinutes: 15, limit: 10 });

    expect(result).toEqual({ scanned: 1, reclaimed: 1 });
    expect(repo.restoreInventory).toHaveBeenCalledTimes(2);
    // Deterministic lock/restore order by variant_id
    expect(repo.restoreInventory.mock.calls[0][1]).toBe('var-a');
    expect(repo.restoreInventory.mock.calls[1][1]).toBe('var-b');
    expect(repo.cancelPendingOnlineOrder).toHaveBeenCalledWith('order-1', expect.anything());
    expect(notificationsRepo.create).toHaveBeenCalled();
  });

  it('skips orders that are no longer pending', async () => {
    const repo = {
      listExpiredUnpaidOnlineOrders: vi.fn().mockResolvedValue([
        {
          id: 'order-1',
          user_id: 'user-1',
          store_id: 'store-1',
          order_number: 'DF20260101-ABC',
        },
      ]),
      lockOrderById: vi.fn().mockResolvedValue({
        id: 'order-1',
        status: 'CONFIRMED',
        store_id: 'store-1',
        user_id: 'user-1',
        order_number: 'DF20260101-ABC',
      }),
      lockPaymentByOrderId: vi.fn(),
      listItems: vi.fn(),
      restoreInventory: vi.fn(),
      updatePayment: vi.fn(),
      cancelPendingOnlineOrder: vi.fn(),
      addStatusHistory: vi.fn(),
    };

    const service = new UnpaidOrderReclaimService(repo as never, { create: vi.fn() } as never);
    const result = await service.reclaimExpired();

    expect(result).toEqual({ scanned: 1, reclaimed: 0 });
    expect(repo.lockPaymentByOrderId).not.toHaveBeenCalled();
  });
});
