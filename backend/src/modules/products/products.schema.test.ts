import { describe, expect, it } from 'vitest';
import { listProductsSchema, similarProductsSchema } from './products.schema.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';

describe('products schema', () => {
  it('accepts empty query with defaults left optional', () => {
    const parsed = listProductsSchema.parse({});
    expect(parsed.page).toBeUndefined();
    expect(parsed.q).toBeUndefined();
  });

  it('coerces page and limit', () => {
    const parsed = listProductsSchema.parse({ page: '2', limit: '10', q: ' milk ' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.q).toBe('milk');
  });

  it('rejects limit over max', () => {
    expect(() => listProductsSchema.parse({ limit: '100' })).toThrow();
  });
});

describe('similar products schema', () => {
  it('accepts empty query', () => {
    const parsed = similarProductsSchema.parse({});
    expect(parsed.storeId).toBeUndefined();
    expect(parsed.limit).toBeUndefined();
  });

  it('coerces limit and caps at 24', () => {
    expect(similarProductsSchema.parse({ limit: '8' }).limit).toBe(8);
    expect(() => similarProductsSchema.parse({ limit: '30' })).toThrow();
  });
});

describe('pagination helpers', () => {
  it('computes offset and caps limit', () => {
    expect(parsePagination({ page: 2, limit: 100 }, { limit: 20, maxLimit: 50 })).toEqual({
      page: 2,
      limit: 50,
      offset: 50,
    });
  });

  it('builds meta', () => {
    expect(paginatedMeta(45, 2, 20)).toMatchObject({
      page: 2,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});
