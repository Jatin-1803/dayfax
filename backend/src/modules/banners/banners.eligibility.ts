export const ACTIVE_BANNER_LIMIT = 8;

export function isBannerEligible(
  input: {
    isActive: boolean;
    startAt: Date;
    endAt: Date;
    deletedAt?: Date | null;
  },
  now: Date,
): boolean {
  if (input.deletedAt) return false;
  if (!input.isActive) return false;
  if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    return false;
  }
  if (input.startAt.getTime() > now.getTime()) return false;
  if (input.endAt.getTime() <= now.getTime()) return false;
  return true;
}

export function compareBannerPriority(
  a: { priority: number; createdAt: Date },
  b: { priority: number; createdAt: Date },
): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return b.createdAt.getTime() - a.createdAt.getTime();
}
