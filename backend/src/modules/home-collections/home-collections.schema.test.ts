import { describe, expect, it } from 'vitest';
import {
  compareHomeCollectionPriority,
  homeCollectionStatus,
  pickWinningCollectionId,
} from './home-collections.eligibility.js';
import { createHomeCollectionSchema, patchHomeCollectionSchema } from './home-collections.schema.js';

const productA = '11111111-1111-4111-8111-111111111111';
const productB = '22222222-2222-4222-8222-222222222222';

const validCollection = {
  headline: 'Holi specials',
  headlineHi: 'होली स्पेशल',
  priority: 10,
  isActive: true,
  startAt: '2026-03-01T00:00:00.000Z',
  endAt: '2026-03-20T00:00:00.000Z',
  productIds: [productA, productB],
};

describe('home collection schema', () => {
  it('accepts a scheduled collection with ordered products', () => {
    const parsed = createHomeCollectionSchema.parse(validCollection);
    expect(parsed.headline).toBe('Holi specials');
    expect(parsed.headlineHi).toBe('होली स्पेशल');
    expect(parsed.productIds).toEqual([productA, productB]);
    expect(parsed.startAt).toBeInstanceOf(Date);
  });

  it('treats an empty Hindi headline as null', () => {
    const parsed = createHomeCollectionSchema.parse({ ...validCollection, headlineHi: '  ' });
    expect(parsed.headlineHi).toBeNull();
  });

  it('rejects duplicate products and an invalid window', () => {
    expect(() =>
      createHomeCollectionSchema.parse({ ...validCollection, productIds: [productA, productA] }),
    ).toThrow();
    expect(() =>
      createHomeCollectionSchema.parse({
        ...validCollection,
        endAt: '2026-02-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('allows a status-only patch without products', () => {
    const parsed = patchHomeCollectionSchema.parse({ isActive: false });
    expect(parsed.isActive).toBe(false);
    expect(parsed.productIds).toBeUndefined();
    expect(parsed.headlineHi).toBeUndefined();
  });
});

describe('home collection winner', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');

  it('marks only an enabled in-window campaign as live', () => {
    expect(
      homeCollectionStatus(
        {
          isActive: true,
          startAt: new Date('2026-03-01T00:00:00.000Z'),
          endAt: new Date('2026-03-20T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('live');
    expect(
      homeCollectionStatus(
        {
          isActive: false,
          startAt: new Date('2026-03-01T00:00:00.000Z'),
          endAt: new Date('2026-03-20T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('disabled');
    expect(
      homeCollectionStatus(
        {
          isActive: true,
          startAt: new Date('2026-03-15T00:00:00.000Z'),
          endAt: new Date('2026-03-20T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe('scheduled');
  });

  it('picks the higher priority live campaign, then the newer one', () => {
    const older = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      isActive: true,
      startAt: new Date('2026-03-01T00:00:00.000Z'),
      endAt: new Date('2026-03-20T00:00:00.000Z'),
      priority: 5,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const newerSamePriority = {
      ...older,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const higher = {
      ...older,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      priority: 20,
    };

    expect(compareHomeCollectionPriority(newerSamePriority, older)).toBeLessThan(0);
    expect(pickWinningCollectionId([older, newerSamePriority], now)).toBe(newerSamePriority.id);
    expect(pickWinningCollectionId([older, higher, { ...newerSamePriority, isActive: false }], now)).toBe(
      higher.id,
    );
  });
});
