const ONLINE_METHODS = new Set(['UPI', 'CARD', 'WALLET']);

export function isOnlinePaymentMethod(method: string | null | undefined): boolean {
  return method != null && ONLINE_METHODS.has(method);
}

export function isClaimableOrder(
  orderStatus: string,
  payment: { method: string; status: string } | null,
): boolean {
  if (orderStatus === 'CANCELLED' || orderStatus === 'DELIVERED') return false;
  if (orderStatus === 'CONFIRMED' || orderStatus === 'PREPARING' || orderStatus === 'READY_FOR_PICKUP') {
    return true;
  }
  if (orderStatus !== 'PENDING' || !payment) return false;
  if (payment.method === 'COD' && payment.status === 'PENDING') return true;
  return isOnlinePaymentMethod(payment.method) && payment.status === 'CAPTURED';
}

export function canVerifyDeliveryOtp(input: {
  paymentMethod: string | null | undefined;
  paymentStatus: string | null | undefined;
}): boolean {
  return input.paymentStatus === 'CAPTURED';
}

export type PaymentDecision =
  | 'CAPTURE'
  | 'ALREADY_CAPTURED'
  | 'AMOUNT_MISMATCH'
  | 'IGNORED';

export function decidePaymentCapture(input: {
  orderId: string;
  paymentMethod: string;
  paymentStatus: string;
  existingPaymentId: string | null;
  incomingPaymentId: string;
  expectedAmountPaise: number;
  receivedAmountPaise: number;
  notesOrderId?: string | null;
}): PaymentDecision {
  if (input.notesOrderId && input.notesOrderId !== input.orderId) return 'IGNORED';
  if (input.paymentStatus === 'CAPTURED') {
    if (!input.existingPaymentId || input.existingPaymentId === input.incomingPaymentId) {
      return 'ALREADY_CAPTURED';
    }
    return 'IGNORED';
  }
  if (input.paymentMethod === 'COD' && input.paymentStatus !== 'PENDING' && input.paymentStatus !== 'AUTHORIZED') {
    return 'IGNORED';
  }
  if (input.receivedAmountPaise !== input.expectedAmountPaise) return 'AMOUNT_MISMATCH';
  return 'CAPTURE';
}
