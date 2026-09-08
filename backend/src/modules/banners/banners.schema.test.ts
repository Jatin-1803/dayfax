import { describe, expect, it } from 'vitest';
import { compareBannerPriority, isBannerEligible } from './banners.eligibility.js';
import { createBannerSchema, patchBannerSchema } from './banners.schema.js';

const validBanner = {
  title: 'Groceries at your door',
  titleHi: 'आपके दरवाज़े पर किराना',
  imageUrl: '/media/catalog/uploads/example.webp',
  linkPath: '/categories',
  priority: 10,
  isActive: true,
  startAt: '2026-09-08T00:00:00.000Z',
  endAt: '2027-09-08T00:00:00.000Z',
};

describe('banner schema', () => {
  it('accepts a scheduled in-app banner', () => {
    const parsed = createBannerSchema.parse(validBanner);
    expect(parsed.linkPath).toBe('/categories');
    expect(parsed.priority).toBe(10);
    expect(parsed.startAt).toBeInstanceOf(Date);
  });

  it('treats an empty link path as no click target', () => {
    const parsed = createBannerSchema.parse({ ...validBanner, linkPath: '' });
    expect(parsed.linkPath).toBeNull();
  });

  it('rejects external links', () => {
    expect(() =>
      createBannerSchema.parse({ ...validBanner, linkPath: 'https://example.com' }),
    ).toThrow();
  });

  it('rejects an end time that is not after the start time', () => {
    expect(() =>
      createBannerSchema.parse({
        ...validBanner,
        endAt: '2026-09-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('rejects a patch that only sets an invalid window', () => {
    expect(() =>
      patchBannerSchema.parse({
        startAt: '2027-01-02T00:00:00.000Z',
        endAt: '2027-01-01T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('allows enabling a banner without other fields', () => {
    const parsed = patchBannerSchema.parse({ isActive: false });
    expect(parsed.isActive).toBe(false);
  });
});

describe('banner eligibility', () => {
  const now = new Date('2026-09-08T06:00:00.000Z');

  it('includes a banner inside its window', () => {
    expect(
      isBannerEligible(
        {
          isActive: true,
          startAt: new Date('2026-09-01T00:00:00.000Z'),
          endAt: new Date('2026-09-09T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(true);
  });

  it('excludes inactive, future, expired, and deleted banners', () => {
    expect(
      isBannerEligible(
        {
          isActive: false,
          startAt: new Date('2026-09-01T00:00:00.000Z'),
          endAt: new Date('2026-09-09T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isBannerEligible(
        {
          isActive: true,
          startAt: new Date('2026-09-09T00:00:00.000Z'),
          endAt: new Date('2026-09-10T00:00:00.000Z'),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isBannerEligible(
        {
          isActive: true,
          startAt: new Date('2026-09-01T00:00:00.000Z'),
          endAt: now,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isBannerEligible(
        {
          isActive: true,
          startAt: new Date('2026-09-01T00:00:00.000Z'),
          endAt: new Date('2026-09-09T00:00:00.000Z'),
          deletedAt: now,
        },
        now,
      ),
    ).toBe(false);
  });

  it('sorts higher priority first, then newer createdAt', () => {
    const older = { priority: 10, createdAt: new Date('2026-09-01T00:00:00.000Z') };
    const newer = { priority: 10, createdAt: new Date('2026-09-02T00:00:00.000Z') };
    const higher = { priority: 20, createdAt: new Date('2026-01-01T00:00:00.000Z') };
    expect([older, higher, newer].sort(compareBannerPriority).map((row) => row.priority)).toEqual([
      20, 10, 10,
    ]);
    expect(compareBannerPriority(newer, older)).toBeLessThan(0);
  });
});
