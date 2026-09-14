import { describe, expect, it } from 'vitest';
import {
  parseExpiryToSeconds,
  refreshTokenDecision,
  sqlFlag,
} from './token-session.js';

describe('token session', () => {
  it('parses jwt expiry strings to seconds', () => {
    expect(parseExpiryToSeconds('15m')).toBe(900);
    expect(parseExpiryToSeconds('12h')).toBe(12 * 60 * 60);
    expect(parseExpiryToSeconds('30d')).toBe(30 * 24 * 60 * 60);
    expect(parseExpiryToSeconds('bad')).toBe(30 * 24 * 60 * 60);
  });

  it('rotates an active refresh token and reuses a recent rotation', () => {
    expect(refreshTokenDecision({ active: true, withinGrace: false })).toBe('rotate');
    expect(refreshTokenDecision({ active: false, withinGrace: true })).toBe('reuse');
    expect(refreshTokenDecision({ active: false, withinGrace: false })).toBe('reject');
    expect(refreshTokenDecision(null)).toBe('reject');
  });

  it('reads mysql boolean flags', () => {
    expect(sqlFlag(1)).toBe(true);
    expect(sqlFlag(0)).toBe(false);
    expect(sqlFlag(1n)).toBe(true);
  });
});
