import { describe, expect, it } from 'vitest';
import {
  buildCheckoutPushNotices,
  isDeferredCodSiblingPayment,
  partnerClaimOrderIdsAfterPayment,
} from './checkout-placement-notices.js';

describe('buildCheckoutPushNotices', () => {
  it('defers order_placed for mixed checkout that still needs online payment', () => {
    const notices = buildCheckoutPushNotices({
      needsOnlinePayment: true,
      payableOrderId: 'local-order',
      created: [{ orderId: 'local-order' }, { orderId: 'cod-sibling' }],
    });

    expect(notices).toEqual([
      {
        orderId: 'local-order',
        copyKey: 'payment_waiting',
        claimable: false,
      },
    ]);
  });

  it('sends order_placed immediately for pure COD checkout', () => {
    const notices = buildCheckoutPushNotices({
      needsOnlinePayment: false,
      payableOrderId: 'cod-order',
      created: [{ orderId: 'cod-order' }],
    });

    expect(notices).toEqual([
      {
        orderId: 'cod-order',
        copyKey: 'order_placed',
        claimable: true,
      },
    ]);
  });
});

describe('partnerClaimOrderIdsAfterPayment', () => {
  it('includes deferred COD siblings after local payment succeeds', () => {
    expect(
      partnerClaimOrderIdsAfterPayment({
        capturedOrderIds: ['local-order'],
        deferredCodOrderIds: ['cod-sibling'],
      }),
    ).toEqual(['local-order', 'cod-sibling']);
  });
});

describe('isDeferredCodSiblingPayment', () => {
  it('matches pending COD stub payments held for mixed checkout', () => {
    expect(
      isDeferredCodSiblingPayment({
        method: 'COD',
        status: 'PENDING',
        provider: 'cod_stub',
      }),
    ).toBe(true);
    expect(
      isDeferredCodSiblingPayment({
        method: 'UPI',
        status: 'PENDING',
        provider: 'razorpay',
      }),
    ).toBe(false);
  });
});
