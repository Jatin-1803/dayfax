import { describe, expect, it } from 'vitest';
import { accountDenyCode } from '../account/account-status.js';
import { isInRollout, rolloutBucket } from './rollout.js';
import { compareVersions, isBelowMinimum, isUpdateAvailable, parseVersion } from './version.js';
import { redactAuditValue } from '../audit/redact.js';
import { sessionExpired } from '../auth/session-store.js';

describe('version policy', () => {
  it('compares dotted versions safely', () => {
    expect(parseVersion('bad')).toBeNull();
    expect(compareVersions('1.2.0', '1.4.0')).toBe(-1);
    expect(compareVersions('1.4.0', '1.4.0')).toBe(0);
  });

  it('prefers build numbers for minimum and latest', () => {
    expect(
      isBelowMinimum({
        installedVersion: '9.0.0',
        installedBuild: 110,
        minVersion: '1.2.0',
        minBuild: 120,
      }),
    ).toBe(true);
    expect(
      isUpdateAvailable({
        installedVersion: '1.0.0',
        installedBuild: 130,
        latestVersion: '1.4.0',
        latestBuild: 140,
      }),
    ).toBe(true);
    expect(
      isUpdateAvailable({
        installedVersion: '1.4.0',
        installedBuild: 140,
        latestVersion: '1.4.0',
        latestBuild: 140,
      }),
    ).toBe(false);
  });
});

describe('feature flag rollout', () => {
  it('is deterministic for the same user and flag', () => {
    const first = rolloutBucket('new_checkout', 'user-1');
    expect(rolloutBucket('new_checkout', 'user-1')).toBe(first);
    expect(isInRollout('user-1', 'new_checkout', 0)).toBe(false);
    expect(isInRollout('user-1', 'new_checkout', 100)).toBe(true);
    expect(isInRollout('user-1', 'new_checkout', 10)).toBe(first < 10);
  });
});

describe('audit redaction', () => {
  it('removes secrets', () => {
    expect(
      redactAuditValue({
        status: 'BANNED',
        accessToken: 'secret',
        nested: { otp: '1234' },
      }),
    ).toEqual({
      status: 'BANNED',
      accessToken: '[redacted]',
      nested: { otp: '[redacted]' },
    });
  });
});

describe('account status', () => {
  it('maps denied states without treating active as denied', () => {
    expect(accountDenyCode('ACTIVE')).toBeNull();
    expect(accountDenyCode('BANNED')).toBe('ACCOUNT_BANNED');
    expect(accountDenyCode('BLOCKED')).toBe('ACCOUNT_BANNED');
    expect(accountDenyCode('SUSPENDED')).toBe('ACCOUNT_SUSPENDED');
    expect(accountDenyCode('SECURITY_LOCKED')).toBe('ACCOUNT_LOCKED');
  });
});

describe('session expiry', () => {
  it('rejects revoked, idle, and absolute expiry', () => {
    const now = new Date();
    expect(
      sessionExpired(
        {
          revoked_at: now,
          last_active_at: now,
          created_at: now,
          expires_at: new Date(now.getTime() + 60_000),
        },
        30,
      ),
    ).toBe('revoked');

    expect(
      sessionExpired(
        {
          revoked_at: null,
          last_active_at: new Date(now.getTime() - 31 * 60_000),
          created_at: now,
          expires_at: new Date(now.getTime() + 60_000),
        },
        30,
      ),
    ).toBe('idle');

    expect(
      sessionExpired(
        {
          revoked_at: null,
          last_active_at: now,
          created_at: new Date(now.getTime() - 120_000),
          expires_at: new Date(now.getTime() - 1000),
        },
        30,
      ),
    ).toBe('expired');
  });
});
