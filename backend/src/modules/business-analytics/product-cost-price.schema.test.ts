import { describe, expect, it } from 'vitest';
import {
  createAdminProductSchema,
  patchStoreProductSchema,
} from '../admin-stores/admin-stores.schema.js';

describe('product cost price validation', () => {
  const base = {
    storeId: '11111111-1111-4111-8111-111111111111',
    name: 'Test Product',
    pricePaise: 50000,
  };

  it('rejects create without cost price', () => {
    const result = createAdminProductSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it('accepts create with cost price', () => {
    const result = createAdminProductSchema.safeParse({
      ...base,
      costPricePaise: 35000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.costPricePaise).toBe(35000);
    }
  });

  it('allows zero cost price', () => {
    const result = createAdminProductSchema.safeParse({
      ...base,
      costPricePaise: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative cost price', () => {
    const result = createAdminProductSchema.safeParse({
      ...base,
      costPricePaise: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer / decimal paise', () => {
    const result = createAdminProductSchema.safeParse({
      ...base,
      costPricePaise: 12.5,
    });
    expect(result.success).toBe(false);
  });

  it('allows patching cost price to zero', () => {
    const result = patchStoreProductSchema.safeParse({ costPricePaise: 0 });
    expect(result.success).toBe(true);
  });

  it('rejects patch with negative cost price', () => {
    const result = patchStoreProductSchema.safeParse({ costPricePaise: -100 });
    expect(result.success).toBe(false);
  });
});
