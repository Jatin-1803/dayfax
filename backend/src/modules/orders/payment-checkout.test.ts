import { describe, expect, it } from 'vitest';
import { canCustomerPayOnline, formatRazorpayContact } from './orders.service.js';

describe('formatRazorpayContact', () => {
  it('prefixes the country code and last 10 digits', () => {
    expect(formatRazorpayContact('+91', '9876543210')).toBe('+919876543210');
    expect(formatRazorpayContact('91', '98765 43210')).toBe('+919876543210');
  });

  it('returns undefined when the phone is too short', () => {
    expect(formatRazorpayContact('+91', '12345')).toBeUndefined();
  });
});

describe('canCustomerPayOnline', () => {
  it('allows unpaid COD before delivery', () => {
    expect(
      canCustomerPayOnline({
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      }),
    ).toBe(true);
  });

  it('blocks captured, cancelled, delivered, and online orders', () => {
    expect(
      canCustomerPayOnline({
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        paymentStatus: 'CAPTURED',
      }),
    ).toBe(false);
    expect(
      canCustomerPayOnline({
        status: 'DELIVERED',
        paymentMethod: 'COD',
        paymentStatus: 'PENDING',
      }),
    ).toBe(false);
    expect(
      canCustomerPayOnline({
        status: 'PENDING',
        paymentMethod: 'UPI',
        paymentStatus: 'PENDING',
      }),
    ).toBe(false);
  });
});
