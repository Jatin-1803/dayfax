/** Access tokens stay valid long enough for a working session; refresh covers the rest. */
export const ACCESS_CLOCK_TOLERANCE_SECONDS = 60;

/**
 * A refresh token that was just rotated may be presented again immediately
 * (parallel requests, a retried request, or two admin tabs). Accept that
 * replay briefly instead of logging the user out.
 */
export const REFRESH_REUSE_GRACE_SECONDS = 120;

export function parseExpiryToSeconds(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (!match) {
    return 30 * 24 * 60 * 60;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return amount * (multipliers[unit] ?? multipliers.d);
}

export type RefreshDecision = 'rotate' | 'reuse' | 'reject';

export function refreshTokenDecision(row: {
  active: boolean;
  withinGrace: boolean;
} | null): RefreshDecision {
  if (!row) return 'reject';
  if (row.active) return 'rotate';
  if (row.withinGrace) return 'reuse';
  return 'reject';
}

export function sqlFlag(value: unknown): boolean {
  return value === true || value === 1 || value === 1n || value === '1';
}
