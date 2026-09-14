import { createHash } from 'node:crypto';

/** Stable bucket 0-99 so the same user stays in or out of a rollout. */
export function rolloutBucket(flagKey: string, stableId: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${stableId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export function isInRollout(stableId: string, flagKey: string, percentage: number): boolean {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  return rolloutBucket(flagKey, stableId) < percentage;
}
