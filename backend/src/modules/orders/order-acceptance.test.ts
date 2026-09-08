import { describe, expect, it } from 'vitest';
import {
  canVerifyDeliveryOtp,
  decidePaymentCapture,
  isClaimableOrder,
} from './order-acceptance.js';

describe('order acceptance and COD payment rules', () => {
  it('keeps a new COD order claimable only while PENDING and unpaid', () => {
    expect(isClaimableOrder('PENDING', { method: 'COD', status: 'PENDING' })).toBe(true);
    expect(isClaimableOrder('CONFIRMED', { method: 'COD', status: 'PENDING' })).toBe(true);
    expect(isClaimableOrder('CANCELLED', { method: 'COD', status: 'PENDING' })).toBe(false);
    expect(isClaimableOrder('DELIVERED', { method: 'COD', status: 'PENDING' })).toBe(false);
  });

  it('allows unpaid online orders to stay out of the partner pool until captured', () => {
    expect(isClaimableOrder('PENDING', { method: 'UPI', status: 'PENDING' })).toBe(false);
    expect(isClaimableOrder('PENDING', { method: 'UPI', status: 'CAPTURED' })).toBe(true);
  });

  it('locks delivery OTP until payment is captured', () => {
    expect(canVerifyDeliveryOtp({ paymentMethod: 'COD', paymentStatus: 'PENDING' })).toBe(false);
    expect(canVerifyDeliveryOtp({ paymentMethod: 'COD', paymentStatus: 'FAILED' })).toBe(false);
    expect(canVerifyDeliveryOtp({ paymentMethod: 'COD', paymentStatus: 'CAPTURED' })).toBe(true);
    expect(canVerifyDeliveryOtp({ paymentMethod: 'UPI', paymentStatus: 'CAPTURED' })).toBe(true);
    expect(canVerifyDeliveryOtp({ paymentMethod: 'UPI', paymentStatus: 'PENDING' })).toBe(false);
  });

  it('captures only a matching amount and ignores a payment for another order', () => {
    expect(
      decidePaymentCapture({
        orderId: 'order-a',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        existingPaymentId: null,
        incomingPaymentId: 'pay_1',
        expectedAmountPaise: 49900,
        receivedAmountPaise: 49900,
        notesOrderId: 'order-a',
      }),
    ).toBe('CAPTURE');

    expect(
      decidePaymentCapture({
        orderId: 'order-a',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        existingPaymentId: null,
        incomingPaymentId: 'pay_1',
        expectedAmountPaise: 49900,
        receivedAmountPaise: 40000,
        notesOrderId: 'order-a',
      }),
    ).toBe('AMOUNT_MISMATCH');

    expect(
      decidePaymentCapture({
        orderId: 'order-a',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
        existingPaymentId: null,
        incomingPaymentId: 'pay_1',
        expectedAmountPaise: 49900,
        receivedAmountPaise: 49900,
        notesOrderId: 'order-b',
      }),
    ).toBe('IGNORED');
  });

  it('treats a repeated capture of the same payment as already paid', () => {
    expect(
      decidePaymentCapture({
        orderId: 'order-a',
        paymentMethod: 'COD',
        paymentStatus: 'CAPTURED',
        existingPaymentId: 'pay_1',
        incomingPaymentId: 'pay_1',
        expectedAmountPaise: 49900,
        receivedAmountPaise: 49900,
      }),
    ).toBe('ALREADY_CAPTURED');
  });
});
