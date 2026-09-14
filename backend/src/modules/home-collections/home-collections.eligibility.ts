export const HOME_COLLECTION_ITEM_LIMIT = 24;
export const ADMIN_COLLECTION_LIMIT = 100;

export type HomeCollectionStatus = 'live' | 'scheduled' | 'expired' | 'disabled';

export function homeCollectionStatus(
  input: {
    isActive: boolean;
    startAt: Date;
    endAt: Date;
  },
  now: Date,
): HomeCollectionStatus {
  if (!input.isActive) return 'disabled';
  if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    return 'disabled';
  }
  if (input.endAt.getTime() <= now.getTime()) return 'expired';
  if (input.startAt.getTime() > now.getTime()) return 'scheduled';
  return 'live';
}

export function compareHomeCollectionPriority(
  a: { priority: number; createdAt: Date },
  b: { priority: number; createdAt: Date },
): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export function pickWinningCollectionId(
  rows: Array<{
    id: string;
    isActive: boolean;
    startAt: Date;
    endAt: Date;
    priority: number;
    createdAt: Date;
  }>,
  now: Date,
): string | null {
  const live = rows.filter((row) => homeCollectionStatus(row, now) === 'live');
  if (live.length === 0) return null;
  live.sort(compareHomeCollectionPriority);
  return live[0]?.id ?? null;
}
