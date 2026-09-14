import { describe, expect, it } from 'vitest';
import { mapSupportOrderIdentity } from './support.service.js';
import { mapReturnItemSummaries } from '../delivery/delivery.service.js';

describe('return order identity', () => {
  it('includes order number, shop, and date on the support conversation', () => {
    const placedAt = new Date('2026-09-08T10:00:00.000Z');
    expect(
      mapSupportOrderIdentity({
        order_number: 'DF20260908-000001',
        store_name: 'DayFax Mart',
        placed_at: placedAt,
      }),
    ).toEqual({
      orderNumber: 'DF20260908-000001',
      storeName: 'DayFax Mart',
      placedAt,
    });
  });

  it('falls back to an empty shop name', () => {
    expect(
      mapSupportOrderIdentity({
        order_number: 'DF20260908-000001',
        store_name: null,
        placed_at: new Date('2026-09-08T10:00:00.000Z'),
      }).storeName,
    ).toBe('');
  });

  it('keeps return item names for the partner job summary', () => {
    expect(
      mapReturnItemSummaries([
        { productName: 'Milk', variantLabel: '1 L', quantity: 1 },
        { productName: 'Bread', variantLabel: '', quantity: 2 },
      ]),
    ).toEqual([
      { productName: 'Milk', variantLabel: '1 L', quantity: 1 },
      { productName: 'Bread', variantLabel: '', quantity: 2 },
    ]);
  });
});
