import { describe, expect, it } from 'vitest';
import { checkoutSchema, listOrdersSchema } from './orders.schema.js';

describe('orders schema', () => {
  it('defaults payment method to COD', () => {
    const parsed = checkoutSchema.parse({
      addressId: '018f3c4a-7b2e-7c3d-9e1a-2b4c5d6e7f80',
    });
    expect(parsed.paymentMethod).toBe('COD');
  });

  it('rejects invalid payment method', () => {
    expect(() =>
      checkoutSchema.parse({
        addressId: '018f3c4a-7b2e-7c3d-9e1a-2b4c5d6e7f80',
        paymentMethod: 'CRYPTO',
      }),
    ).toThrow();
  });

  it('coerces list pagination', () => {
    const parsed = listOrdersSchema.parse({ page: '2', limit: '10' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
  });

  it('accepts optional idempotency key', () => {
    const parsed = checkoutSchema.parse({
      addressId: '018f3c4a-7b2e-7c3d-9e1a-2b4c5d6e7f80',
      idempotencyKey: 'chk_test_key_12345',
    });
    expect(parsed.idempotencyKey).toBe('chk_test_key_12345');
  });
});
