import { describe, expect, it, vi, beforeEach } from 'vitest';

const claim = vi.fn();
const markSent = vi.fn();
const markFailed = vi.fn();
const markAccepted = vi.fn();
const markExpiredForOrder = vi.fn();
const listPartnerIdsNotified = vi.fn();
const listEligiblePartnerDevices = vi.fn();
const listDevicesForPartners = vi.fn();
const sendPartnerPush = vi.fn();
const query = vi.fn();

vi.mock('../../common/database/pool.js', () => ({
  getPool: () => ({ query }),
}));

vi.mock('../../common/logger/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../devices/devices.repository.js', () => ({
  DevicesRepository: class {
    listEligiblePartnerDevices = listEligiblePartnerDevices;
    listDevicesForPartners = listDevicesForPartners;
  },
}));

vi.mock('./order-delivery-notifications.repository.js', () => ({
  OrderDeliveryNotificationsRepository: class {
    claim = claim;
    markSent = markSent;
    markFailed = markFailed;
    markAccepted = markAccepted;
    markExpiredForOrder = markExpiredForOrder;
    listPartnerIdsNotified = listPartnerIdsNotified;
  },
}));

vi.mock('./push.service.js', () => ({
  schedulePush: (task: () => Promise<void>) => {
    void task();
  },
  sendPartnerPush,
}));

vi.mock('../orders/order-acceptance.js', () => ({
  isClaimableOrder: () => true,
}));

describe('notifyPartnersNewOrder idempotency', () => {
  beforeEach(() => {
    vi.resetModules();
    claim.mockReset();
    markSent.mockReset();
    markFailed.mockReset();
    sendPartnerPush.mockReset();
    listEligiblePartnerDevices.mockReset();
    query.mockReset();

    query.mockResolvedValue([
      [
        {
          id: 'order-1',
          order_number: 'ORD-1',
          status: 'PENDING',
          grand_total_paise: 85000,
          store_name: 'ABC Store',
          address_city: 'Sector 45',
          address_landmark: null,
          address_pincode: null,
          payment_method: 'COD',
          payment_status: 'PENDING',
        },
      ],
    ]);

    listEligiblePartnerDevices.mockResolvedValue([
      { user_id: 'partner-a', fcm_token: 'token-a', locale: 'en' },
      { user_id: 'partner-b', fcm_token: 'token-b', locale: 'en' },
    ]);
  });

  it('skips partners already claimed for the same order', async () => {
    claim
      .mockResolvedValueOnce('claim-a')
      .mockResolvedValueOnce(null);
    sendPartnerPush.mockResolvedValue({
      sent: 1,
      temporaryFailures: 0,
      permanentFailures: 0,
      configured: true,
    });

    const { notifyPartnersNewOrder } = await import('./partner-new-order.service.js');
    await notifyPartnersNewOrder('order-1');

    expect(claim).toHaveBeenCalledTimes(2);
    expect(sendPartnerPush).toHaveBeenCalledTimes(1);
    expect(markSent).toHaveBeenCalledWith('claim-a');
  });

  it('does not send when no partner devices exist', async () => {
    listEligiblePartnerDevices.mockResolvedValue([]);
    const { notifyPartnersNewOrder } = await import('./partner-new-order.service.js');
    await notifyPartnersNewOrder('order-1');
    expect(claim).not.toHaveBeenCalled();
    expect(sendPartnerPush).not.toHaveBeenCalled();
  });
});
