import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import {
  googleLoginSchema,
  linkPhoneRequestSchema,
  linkPhoneVerifySchema,
} from './auth.schema.js';

vi.mock('./google-id-token.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

vi.mock('../app-controls/control-state.js', () => ({
  isControlEnabled: vi.fn(async () => true),
}));

vi.mock('../../common/config/session-policy.js', () => ({
  getSessionPolicy: vi.fn(async () => ({
    userAbsoluteTimeoutMinutes: 60 * 24 * 30,
    userRefreshTtlDays: 30,
    failedAttemptWindowMinutes: 15,
    otpRequestLimit: 10,
    otpVerifyAttemptLimit: 5,
    maxFailedAttempts: 10,
    lockDurationMinutes: 30,
    maxRepeatedLockouts: 5,
  })),
}));

vi.mock('../../common/auth/session-store.js', () => ({
  createUserSession: vi.fn(async () => 'session-1'),
  revokeUserSessions: vi.fn(),
}));

vi.mock('../../common/audit/audit-log.js', () => ({
  writeAudit: vi.fn(),
}));

vi.mock('../../common/database/pool.js', () => ({
  getPool: vi.fn(() => ({
    query: vi.fn(async () => [[]]),
    execute: vi.fn(),
  })),
  withTransaction: vi.fn(async (fn: (conn: unknown) => Promise<unknown>) => fn({})),
}));

import { verifyGoogleIdToken } from './google-id-token.js';
import { AuthService } from './auth.service.js';
import type { AuthRepository, UserRecord } from './auth.repository.js';

const verifyGoogleIdTokenMock = vi.mocked(verifyGoogleIdToken);

function baseUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    phone_country_code: null,
    phone: null,
    full_name: 'Riya',
    email: 'riya@gmail.com',
    avatar_url: null,
    google_sub: 'google-sub-1',
    password_hash: null,
    status: 'ACTIVE',
    status_expires_at: null,
    ...overrides,
  };
}

function mockRepo(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    findUserByGoogleSub: vi.fn(async () => null),
    findUserByEmail: vi.fn(async () => null),
    findUserById: vi.fn(async () => baseUser()),
    findUserByPhone: vi.fn(async () => null),
    createGoogleCustomerUser: vi.fn(async () => baseUser()),
    linkGoogleSub: vi.fn(async () => undefined),
    updateGoogleProfileFields: vi.fn(async () => undefined),
    setUserPhone: vi.fn(async () => undefined),
    getUserRoles: vi.fn(async () => ['CUSTOMER'] as const),
    touchLogin: vi.fn(async () => undefined),
    storeRefreshToken: vi.fn(async () => undefined),
    recordSecurityEvent: vi.fn(async () => undefined),
    clearSecurityLock: vi.fn(async () => undefined),
    createOtpChallenge: vi.fn(async () => 'challenge-1'),
    invalidateOlderOtps: vi.fn(async () => ({})),
    findLatestActiveOtp: vi.fn(async () => null),
    incrementOtpAttempts: vi.fn(async () => undefined),
    consumeOtp: vi.fn(async () => undefined),
    hash: (v: string) => v,
    generateOtp: () => '1234',
    countSecurityEvents: vi.fn(async () => 0),
    ...overrides,
  } as unknown as AuthRepository;
}

const client = {
  ipAddress: '127.0.0.1',
  deviceId: 'device-1',
  platform: 'android',
  deviceName: null,
  deviceModel: null,
  osVersion: null,
  appVersion: null,
  appBuild: null,
};

describe('google / phone-link schemas', () => {
  it('accepts google id token', () => {
    const parsed = googleLoginSchema.parse({
      idToken: 'x'.repeat(40),
    });
    expect(parsed.idToken.length).toBe(40);
  });

  it('accepts link phone request/verify', () => {
    expect(linkPhoneRequestSchema.parse({ phone: '9876543210' }).phone).toBe('9876543210');
    expect(
      linkPhoneVerifySchema.parse({ phone: '9876543210', otp: '1234' }).otp,
    ).toBe('1234');
  });
});

describe('AuthService.loginWithGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyGoogleIdTokenMock.mockResolvedValue({
      sub: 'google-sub-1',
      email: 'riya@gmail.com',
      emailVerified: true,
      name: 'Riya',
      picture: 'https://example.com/a.png',
    });
  });

  it('creates a new customer when Google identity is unknown', async () => {
    const created = baseUser({ id: 'new-user' });
    const repo = mockRepo({
      createGoogleCustomerUser: vi.fn(async () => created),
      findUserById: vi.fn(async () => created),
    });
    const service = new AuthService(repo);

    const result = await service.loginWithGoogle({ idToken: 'token-token-token-token' }, client);

    expect(result.isNewUser).toBe(true);
    expect(result.user.id).toBe('new-user');
    expect(result.user.phone).toBeNull();
    expect(result.accessToken).toBeTruthy();
    expect(repo.createGoogleCustomerUser).toHaveBeenCalled();
  });

  it('logs in an existing user by google_sub', async () => {
    const existing = baseUser({ id: 'existing' });
    const repo = mockRepo({
      findUserByGoogleSub: vi.fn(async () => existing),
      findUserById: vi.fn(async () => existing),
    });
    const service = new AuthService(repo);

    const result = await service.loginWithGoogle({ idToken: 'token-token-token-token' }, client);

    expect(result.isNewUser).toBe(false);
    expect(result.user.id).toBe('existing');
    expect(repo.createGoogleCustomerUser).not.toHaveBeenCalled();
  });

  it('links google_sub when email matches an existing account', async () => {
    const byEmail = baseUser({
      id: 'email-user',
      google_sub: null,
      phone: '9876543210',
      phone_country_code: '+91',
    });
    const linked = { ...byEmail, google_sub: 'google-sub-1' };
    const repo = mockRepo({
      findUserByEmail: vi.fn(async () => byEmail),
      findUserById: vi.fn(async () => linked),
    });
    const service = new AuthService(repo);

    const result = await service.loginWithGoogle({ idToken: 'token-token-token-token' }, client);

    expect(result.isNewUser).toBe(false);
    expect(repo.linkGoogleSub).toHaveBeenCalledWith('email-user', 'google-sub-1');
    expect(result.user.id).toBe('email-user');
  });
});

describe('AuthService.verifyLinkPhone', () => {
  it('rejects when the phone belongs to another user', async () => {
    const repo = mockRepo({
      findUserById: vi.fn(async () => baseUser({ phone: null })),
      findUserByPhone: vi.fn(async () =>
        baseUser({ id: 'other-user', phone: '9876543210', phone_country_code: '+91' }),
      ),
    });
    const service = new AuthService(repo);

    await expect(
      service.verifyLinkPhone(
        'user-1',
        { phoneCountryCode: '+91', phone: '9876543210', otp: '1234' },
        client,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
