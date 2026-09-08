import { describe, expect, it } from 'vitest';
import { createAddressSchema, updateAddressSchema } from './addresses.schema.js';
import { addCartItemSchema, updateCartItemSchema } from '../cart/cart.schema.js';

describe('addresses schema', () => {
  it('accepts a valid address', () => {
    const parsed = createAddressSchema.parse({
      fullName: 'Rahul Sharma',
      line1: '12 Market Road',
      city: 'Launch Town',
      pincode: '226001',
    });
    expect(parsed.label).toBe('Home');
    expect(parsed.fullName).toBe('Rahul Sharma');
    expect(parsed.pincode).toBe('226001');
  });

  it('requires a full name', () => {
    expect(() =>
      createAddressSchema.parse({
        line1: '12 Market Road',
        city: 'Launch Town',
      }),
    ).toThrow();
  });

  it('rejects invalid pincode', () => {
    expect(() =>
      createAddressSchema.parse({
        fullName: 'Rahul Sharma',
        line1: '12 Market Road',
        city: 'Launch Town',
        pincode: '12',
      }),
    ).toThrow();
  });

  it('requires at least one field on update', () => {
    expect(() => updateAddressSchema.parse({})).toThrow();
  });
});

describe('cart schema', () => {
  it('defaults quantity to 1', () => {
    const parsed = addCartItemSchema.parse({
      variantId: '018f3c4a-7b2e-7c3d-9e1a-2b4c5d6e7f80',
    });
    expect(parsed.quantity).toBe(1);
  });

  it('allows quantity 0 to remove', () => {
    expect(updateCartItemSchema.parse({ quantity: 0 }).quantity).toBe(0);
  });
});
