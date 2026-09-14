import { describe, expect, it } from 'vitest';
import { isLocalShopStoreType, requiresOnlinePayment } from './local-shop.js';

describe('local-shop helpers', () => {
  it('treats only FOOD as local shop', () => {
    expect(isLocalShopStoreType('FOOD')).toBe(true);
    expect(isLocalShopStoreType('GROCERY')).toBe(false);
    expect(isLocalShopStoreType(null)).toBe(false);
  });

  it('gates COD from online_payment_only flag, not store type', () => {
    expect(requiresOnlinePayment(1)).toBe(true);
    expect(requiresOnlinePayment(true)).toBe(true);
    expect(requiresOnlinePayment(0)).toBe(false);
    expect(requiresOnlinePayment(false)).toBe(false);
    expect(requiresOnlinePayment(null)).toBe(false);
  });
});
