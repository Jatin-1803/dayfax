import type { PushCopyKey } from '../notifications/push-copy.js';

export type CheckoutPushNotice = {
  orderId: string;
  copyKey: Extract<PushCopyKey, 'payment_waiting' | 'order_placed'>;
  claimable: boolean;
};

/**
 * When checkout still needs online payment (pure UPI or mixed local+COD),
 * never send "order placed" / partner claim until payment succeeds.
 * Pure COD can notify immediately.
 */
export function buildCheckoutPushNotices(input: {
  needsOnlinePayment: boolean;
  payableOrderId: string;
  created: Array<{ orderId: string }>;
}): CheckoutPushNotice[] {
  if (input.needsOnlinePayment) {
    return [
      {
        orderId: input.payableOrderId,
        copyKey: 'payment_waiting',
        claimable: false,
      },
    ];
  }

  return input.created.map((order) => ({
    orderId: order.orderId,
    copyKey: 'order_placed' as const,
    claimable: true,
  }));
}

/**
 * After online payment capture, partners may claim every paid order plus any
 * COD sibling that was held until the checkout group finished paying.
 */
export function partnerClaimOrderIdsAfterPayment(input: {
  capturedOrderIds: string[];
  deferredCodOrderIds: string[];
}): string[] {
  return [...new Set([...input.capturedOrderIds, ...input.deferredCodOrderIds])];
}

export function isDeferredCodSiblingPayment(payment: {
  method: string;
  status: string;
  provider: string;
}): boolean {
  return (
    payment.method === 'COD' &&
    payment.status === 'PENDING' &&
    payment.provider === 'cod_stub'
  );
}
