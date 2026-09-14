import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { accountDenyCode } from '../../common/account/account-status.js';
import { writeAudit } from '../../common/audit/audit-log.js';
import {
  parseExpiryToSeconds,
  refreshTokenDecision,
} from '../../common/auth/token-session.js';
import { createUserSession, revokeUserSessions } from '../../common/auth/session-store.js';
import { getSessionPolicy } from '../../common/config/session-policy.js';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { withTransaction } from '../../common/database/pool.js';
import type { ClientContext } from '../../common/http/client-context.js';
import { logger } from '../../common/logger/logger.js';
import type { RoleCode } from '../../common/middleware/auth.js';
import { isControlEnabled } from '../app-controls/control-state.js';
import { AuthRepository, type UserRecord } from './auth.repository.js';
import type {
  ChangePasswordInput,
  GoogleLoginInput,
  LinkPhoneDirectInput,
  LinkPhoneRequestInput,
  LinkPhoneVerifyInput,
  PasswordLoginInput,
  PasswordRegisterInput,
  PasswordStatusInput,
  RequestOtpInput,
  SetPasswordInput,
  UpdateProfileInput,
  VerifyOtpInput,
} from './auth.schema.js';
import { verifyGoogleIdToken } from './google-id-token.js';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '../../common/database/pool.js';

const BCRYPT_COST = 12;

export class AuthService {
  constructor(private readonly repo = new AuthRepository()) {}

  async requestOtp(input: RequestOtpInput, client: ClientContext) {
    await this.assertOtpLoginAllowed(input.phoneCountryCode, input.phone);

    const policy = await getSessionPolicy();
    const recent = await this.repo.countSecurityEvents({
      phone: input.phone,
      eventType: 'OTP_REQUESTED',
      windowMinutes: policy.failedAttemptWindowMinutes,
    });
    if (recent >= policy.otpRequestLimit) {
      await this.repo.recordSecurityEvent({
        phone: input.phone,
        eventType: 'OTP_ABUSE',
        ipAddress: client.ipAddress,
        deviceId: client.deviceId,
      });
      throw new ValidationError('Too many OTP requests. Please try again later.');
    }

    await this.repo.invalidateOlderOtps(input.phoneCountryCode, input.phone);

    const code =
      env.OTP_PROVIDER === 'dev' ? env.OTP_DEV_CODE : this.repo.generateOtp(env.OTP_LENGTH);

    const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_SECONDS * 1000);
    const challengeId = await this.repo.createOtpChallenge({
      phoneCountryCode: input.phoneCountryCode,
      phone: input.phone,
      code,
      expiresAt,
    });

    await this.repo.recordSecurityEvent({
      phone: input.phone,
      eventType: 'OTP_REQUESTED',
      ipAddress: client.ipAddress,
      deviceId: client.deviceId,
    });

    if (env.OTP_PROVIDER === 'dev') {
      logger.info('Dev OTP issued', {
        challengeId,
        phone: `${input.phoneCountryCode}${input.phone.slice(0, 2)}******`,
      });
    } else {
      logger.info('OTP dispatched via SMS provider', { challengeId });
    }

    return {
      challengeId,
      expiresInSeconds: env.OTP_EXPIRES_SECONDS,
      ...(env.NODE_ENV === 'development' ? { devOtp: code } : {}),
    };
  }

  async verifyOtp(input: VerifyOtpInput, client: ClientContext) {
    await this.assertOtpLoginAllowed(input.phoneCountryCode, input.phone);

    const policy = await getSessionPolicy();
    let user = await this.repo.findUserByPhone(input.phoneCountryCode, input.phone);
    user = await this.releaseExpiredLock(user);

    if (user?.status === 'SECURITY_LOCKED') {
      throw new ForbiddenError('Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED');
    }

    const challenge = await this.repo.findLatestActiveOtp(
      input.phoneCountryCode,
      input.phone,
    );

    if (!challenge) {
      throw new ValidationError('OTP expired or not found. Please request a new code.');
    }

    if (challenge.attempts >= challenge.max_attempts || challenge.attempts >= policy.otpVerifyAttemptLimit) {
      throw new ValidationError('Too many invalid attempts. Please request a new code.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new ValidationError('OTP expired. Please request a new code.');
    }

    const matches = this.repo.hash(input.otp) === challenge.code_hash;
    if (!matches) {
      await this.repo.incrementOtpAttempts(challenge.id);
      await this.repo.recordSecurityEvent({
        userId: user?.id,
        phone: input.phone,
        eventType: 'LOGIN_FAILED',
        ipAddress: client.ipAddress,
        deviceId: client.deviceId,
      });
      await this.maybeLock(user, input.phone, client, policy);
      throw new ValidationError('Invalid OTP');
    }

    await this.repo.consumeOtp(challenge.id);

    let isNewUser = false;
    if (!user) {
      if (!(await isControlEnabled('registration'))) {
        throw new ForbiddenError('New registrations are temporarily unavailable.', 'REGISTRATION_DISABLED');
      }
      user = await this.repo.createCustomerUser(input.phoneCountryCode, input.phone);
      isNewUser = true;
    }

    const session = await this.issueSessionForUser(user, client, policy);
    return { ...session, isNewUser };
  }

  async loginWithPassword(input: PasswordLoginInput, client: ClientContext) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }

    const policy = await getSessionPolicy();
    let user = await this.repo.findUserByPhone(input.phoneCountryCode, input.phone);
    user = await this.releaseExpiredLock(user);

    if (user?.status === 'SECURITY_LOCKED') {
      throw new ForbiddenError('Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED');
    }

    if (!user) {
      await this.repo.recordSecurityEvent({
        phone: input.phone,
        eventType: 'LOGIN_FAILED',
        ipAddress: client.ipAddress,
        deviceId: client.deviceId,
      });
      throw new AppError('Invalid phone or password.', {
        statusCode: 422,
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.password_hash) {
      throw new ForbiddenError(
        'Set a password from Profile after signing in with OTP.',
        'PASSWORD_NOT_SET',
      );
    }

    const matches = await bcrypt.compare(input.password, user.password_hash);
    if (!matches) {
      await this.repo.recordSecurityEvent({
        userId: user.id,
        phone: input.phone,
        eventType: 'LOGIN_FAILED',
        ipAddress: client.ipAddress,
        deviceId: client.deviceId,
      });
      await this.maybeLock(user, input.phone, client, policy);
      throw new AppError('Invalid phone or password.', {
        statusCode: 422,
        code: 'INVALID_CREDENTIALS',
      });
    }

    return this.issueSessionForUser(user, client, policy);
  }

  async passwordStatus(input: PasswordStatusInput) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }
    const user = await this.repo.findUserByPhone(input.phoneCountryCode, input.phone);
    return { hasPassword: Boolean(user?.password_hash) };
  }

  async registerWithPassword(input: PasswordRegisterInput, client: ClientContext) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }
    if (await isControlEnabled('login_otp')) {
      throw new ForbiddenError(
        'Use OTP to create an account when OTP login is enabled.',
        'OTP_LOGIN_REQUIRED',
      );
    }
    if (!(await isControlEnabled('registration'))) {
      throw new ForbiddenError('New registrations are temporarily unavailable.', 'REGISTRATION_DISABLED');
    }

    const policy = await getSessionPolicy();
    let user = await this.repo.findUserByPhone(input.phoneCountryCode, input.phone);
    user = await this.releaseExpiredLock(user);

    if (user?.status === 'SECURITY_LOCKED') {
      throw new ForbiddenError('Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED');
    }

    if (user?.password_hash) {
      throw new ConflictError('Account already has a password. Sign in instead.');
    }

    const hash = await bcrypt.hash(input.password, BCRYPT_COST);

    if (!user) {
      user = await this.repo.createCustomerUser(input.phoneCountryCode, input.phone);
    }

    await this.repo.setPasswordHash(user.id, hash);
    user = { ...user, password_hash: hash };

    return this.issueSessionForUser(user, client, policy);
  }

  async refresh(refreshToken: string, client: ClientContext) {
    return withTransaction(async (conn) => {
      const stored = await this.repo.findRefreshTokenForUpdate(refreshToken, conn);
      const decision = refreshTokenDecision(stored);
      if (!stored || decision === 'reject') {
        throw new UnauthorizedError('Invalid refresh token', 'REFRESH_INVALID');
      }

      const user = await this.repo.findUserById(stored.user_id);
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedError('User not available', 'REFRESH_INVALID');
      }

      const roles = await this.repo.getUserRoles(user.id);
      if (decision === 'rotate') {
        await this.repo.revokeRefreshToken(stored.id, conn);
      }

      const policy = await getSessionPolicy();
      const sessionId =
        stored.sessionId ??
        (await createUserSession(
          { userId: user.id, client, absoluteMinutes: policy.userAbsoluteTimeoutMinutes },
          conn,
        ));

      const tokens = await this.issueTokens(
        {
          userId: user.id,
          phone: user.phone,
          email: user.email,
          roles,
          sessionId,
        },
        conn,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    });
  }

  async me(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    const roles = await this.repo.getUserRoles(user.id);
    return this.toPublicUser(user, roles);
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    await this.repo.updateFullName(userId, input.fullName);
    const roles = await this.repo.getUserRoles(userId);
    return this.toPublicUser({ ...user, full_name: input.fullName }, roles);
  }

  async setPassword(userId: string, input: SetPasswordInput) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    if (user.password_hash) {
      throw new ConflictError('Password already set. Use change password instead.');
    }
    const hash = await bcrypt.hash(input.password, BCRYPT_COST);
    await this.repo.setPasswordHash(userId, hash);
    return { hasPassword: true };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    if (!user.password_hash) {
      throw new ForbiddenError('No password set yet. Set a password first.', 'PASSWORD_NOT_SET');
    }
    const matches = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!matches) {
      throw new ValidationError('Current password is incorrect.');
    }
    const hash = await bcrypt.hash(input.password, BCRYPT_COST);
    await this.repo.setPasswordHash(userId, hash);
    return { hasPassword: true };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, device_id, platform, device_name, device_model, os_version,
              app_version, app_build, created_at, last_active_at, expires_at
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_active_at DESC
       LIMIT 50`,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      platform: row.platform,
      deviceName: row.device_name,
      deviceModel: row.device_model,
      osVersion: row.os_version,
      appVersion: row.app_version,
      appBuild: row.app_build,
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
      expiresAt: row.expires_at,
      current: row.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string, reason: string) {
    await revokeUserSessions({ userId, sessionId, reason });
    await writeAudit({
      actorType: 'user',
      actorId: userId,
      action: 'SESSION_REVOKED',
      module: 'sessions',
      entityType: 'user_session',
      entityId: sessionId,
      reason,
    });
  }

  async revokeOthers(userId: string, currentSessionId: string) {
    await revokeUserSessions({
      userId,
      exceptSessionId: currentSessionId,
      reason: 'logout_others',
    });
    await writeAudit({
      actorType: 'user',
      actorId: userId,
      action: 'OTHER_SESSIONS_REVOKED',
      module: 'sessions',
      entityType: 'user',
      entityId: userId,
      reason: 'logout_others',
    });
  }

  async loginWithGoogle(input: GoogleLoginInput, client: ClientContext) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }

    const identity = await verifyGoogleIdToken(input.idToken);
    const policy = await getSessionPolicy();

    let user = await this.repo.findUserByGoogleSub(identity.sub);
    let isNewUser = false;

    if (!user) {
      const byEmail = await this.repo.findUserByEmail(identity.email);
      if (byEmail) {
        if (byEmail.google_sub && byEmail.google_sub !== identity.sub) {
          throw new ConflictError('This email is linked to another Google account.');
        }
        user = await this.releaseExpiredLock(byEmail);
        if (!user) {
          throw new UnauthorizedError();
        }
        if (!user.google_sub) {
          await this.repo.linkGoogleSub(user.id, identity.sub);
          user = { ...user, google_sub: identity.sub };
        }
        await this.repo.updateGoogleProfileFields(user.id, {
          fullName: identity.name,
          avatarUrl: identity.picture,
          email: identity.email,
        });
        const refreshed = await this.repo.findUserById(user.id);
        if (refreshed) user = refreshed;
      } else {
        if (!(await isControlEnabled('registration'))) {
          throw new ForbiddenError(
            'New registrations are temporarily unavailable.',
            'REGISTRATION_DISABLED',
          );
        }
        user = await this.repo.createGoogleCustomerUser({
          googleSub: identity.sub,
          email: identity.email,
          fullName: identity.name,
          avatarUrl: identity.picture,
        });
        isNewUser = true;
      }
    } else {
      user = await this.releaseExpiredLock(user);
      if (!user) {
        throw new UnauthorizedError();
      }
      await this.repo.updateGoogleProfileFields(user.id, {
        fullName: identity.name,
        avatarUrl: identity.picture,
        email: identity.email,
      });
      const refreshed = await this.repo.findUserById(user.id);
      if (refreshed) user = refreshed;
    }

    if (user.status === 'SECURITY_LOCKED') {
      throw new ForbiddenError('Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED');
    }

    const roles = await this.repo.getUserRoles(user.id);
    if (!roles.includes('CUSTOMER')) {
      throw new ForbiddenError('No app access for this account.', 'NO_APP_ACCESS');
    }

    const session = await this.issueSessionForUser(user, client, policy);
    return { ...session, isNewUser };
  }

  async requestLinkPhone(userId: string, input: LinkPhoneRequestInput, client: ClientContext) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }
    if (!(await isControlEnabled('login_otp'))) {
      throw new ForbiddenError(
        'OTP login is temporarily unavailable. Sign in with password.',
        'OTP_LOGIN_DISABLED',
      );
    }

    await this.assertCanLinkPhone(userId, input.phoneCountryCode, input.phone);

    const policy = await getSessionPolicy();
    const recent = await this.repo.countSecurityEvents({
      phone: input.phone,
      eventType: 'OTP_REQUESTED',
      windowMinutes: policy.failedAttemptWindowMinutes,
    });
    if (recent >= policy.otpRequestLimit) {
      await this.repo.recordSecurityEvent({
        userId,
        phone: input.phone,
        eventType: 'OTP_ABUSE',
        ipAddress: client.ipAddress,
        deviceId: client.deviceId,
      });
      throw new ValidationError('Too many OTP requests. Please try again later.');
    }

    await this.repo.invalidateOlderOtps(input.phoneCountryCode, input.phone);

    const code =
      env.OTP_PROVIDER === 'dev' ? env.OTP_DEV_CODE : this.repo.generateOtp(env.OTP_LENGTH);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_SECONDS * 1000);
    const challengeId = await this.repo.createOtpChallenge({
      phoneCountryCode: input.phoneCountryCode,
      phone: input.phone,
      code,
      expiresAt,
    });

    await this.repo.recordSecurityEvent({
      userId,
      phone: input.phone,
      eventType: 'OTP_REQUESTED',
      ipAddress: client.ipAddress,
      deviceId: client.deviceId,
      meta: { purpose: 'phone_link' },
    });

    if (env.OTP_PROVIDER === 'dev') {
      logger.info('Dev OTP issued for phone link', {
        challengeId,
        phone: `${input.phoneCountryCode}${input.phone.slice(0, 2)}******`,
      });
    }

    return {
      challengeId,
      expiresInSeconds: env.OTP_EXPIRES_SECONDS,
      ...(env.NODE_ENV === 'development' ? { devOtp: code } : {}),
    };
  }

  async verifyLinkPhone(userId: string, input: LinkPhoneVerifyInput, client: ClientContext) {
    if (!(await isControlEnabled('login_otp'))) {
      throw new ForbiddenError(
        'OTP login is temporarily unavailable. Sign in with password.',
        'OTP_LOGIN_DISABLED',
      );
    }

    const roles = await this.assertCanLinkPhone(userId, input.phoneCountryCode, input.phone);

    const policy = await getSessionPolicy();
    const challenge = await this.repo.findLatestActiveOtp(
      input.phoneCountryCode,
      input.phone,
    );

    if (!challenge) {
      throw new ValidationError('OTP expired or not found. Please request a new code.');
    }

    if (
      challenge.attempts >= challenge.max_attempts ||
      challenge.attempts >= policy.otpVerifyAttemptLimit
    ) {
      throw new ValidationError('Too many invalid attempts. Please request a new code.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new ValidationError('OTP expired or not found. Please request a new code.');
    }

    const matches = this.repo.hash(input.otp) === challenge.code_hash;
    if (!matches) {
      await this.repo.incrementOtpAttempts(challenge.id);
      await this.repo.recordSecurityEvent({
        userId,
        phone: input.phone,
        eventType: 'LOGIN_FAILED',
        ipAddress: client.ipAddress,
        deviceId: client.deviceId,
        meta: { purpose: 'phone_link' },
      });
      throw new ValidationError('Invalid OTP');
    }

    await this.repo.consumeOtp(challenge.id);
    await this.repo.setUserPhone(userId, input.phoneCountryCode, input.phone);

    const updated = await this.repo.findUserById(userId);
    if (!updated) {
      throw new UnauthorizedError();
    }

    return this.toPublicUser(updated, roles);
  }

  /**
   * When customer OTP login is disabled, allow linking a phone without SMS OTP.
   */
  async linkPhoneDirect(userId: string, input: LinkPhoneDirectInput, client: ClientContext) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }
    if (await isControlEnabled('login_otp')) {
      throw new ForbiddenError(
        'Verify this number with OTP.',
        'OTP_LOGIN_REQUIRED',
      );
    }

    const roles = await this.assertCanLinkPhone(userId, input.phoneCountryCode, input.phone);
    await this.repo.setUserPhone(userId, input.phoneCountryCode, input.phone);

    await this.repo.recordSecurityEvent({
      userId,
      phone: input.phone,
      eventType: 'PHONE_LINKED',
      ipAddress: client.ipAddress,
      deviceId: client.deviceId,
      meta: { purpose: 'phone_link_direct' },
    });

    const updated = await this.repo.findUserById(userId);
    if (!updated) {
      throw new UnauthorizedError();
    }

    return this.toPublicUser(updated, roles);
  }

  private async assertCanLinkPhone(
    userId: string,
    phoneCountryCode: string,
    phone: string,
  ): Promise<RoleCode[]> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }

    const roles = await this.repo.getUserRoles(userId);
    if (!roles.includes('CUSTOMER')) {
      throw new ForbiddenError('Only customers can link a phone.', 'NO_APP_ACCESS');
    }

    if (user.phone) {
      throw new AppError('A phone number is already linked to this account.', {
        statusCode: 409,
        code: 'PHONE_ALREADY_LINKED',
      });
    }

    const existing = await this.repo.findUserByPhone(phoneCountryCode, phone);
    if (existing && existing.id !== userId) {
      throw new AppError('This phone number is already in use.', {
        statusCode: 409,
        code: 'PHONE_IN_USE',
      });
    }

    return roles;
  }

  private async assertOtpLoginAllowed(phoneCountryCode: string, phone: string) {
    if (!(await isControlEnabled('login'))) {
      throw new ForbiddenError('Sign in is temporarily unavailable.', 'LOGIN_DISABLED');
    }
    if (await isControlEnabled('login_otp')) {
      return;
    }
    const user = await this.repo.findUserByPhone(phoneCountryCode, phone);
    if (user) {
      const roles = await this.repo.getUserRoles(user.id);
      if (roles.includes('DELIVERY_PARTNER')) {
        return;
      }
    }
    throw new ForbiddenError(
      'OTP login is temporarily unavailable. Sign in with password.',
      'OTP_LOGIN_DISABLED',
    );
  }

  private async issueSessionForUser(
    user: UserRecord,
    client: ClientContext,
    policy: Awaited<ReturnType<typeof getSessionPolicy>>,
  ) {
    const deny = accountDenyCode(user.status);
    if (deny && user.status !== 'SECURITY_LOCKED') {
      throw new ForbiddenError('Your account cannot sign in.', deny);
    }

    const roles = await this.repo.getUserRoles(user.id);
    await this.repo.touchLogin(user.id);

    const known = await this.hasSeenDevice(user.id, client.deviceId);
    const sessionId = await createUserSession({
      userId: user.id,
      client,
      absoluteMinutes: policy.userAbsoluteTimeoutMinutes,
    });

    const tokens = await this.issueTokens({
      userId: user.id,
      phone: user.phone,
      email: user.email,
      roles,
      sessionId,
    });

    await this.repo.recordSecurityEvent({
      userId: user.id,
      phone: user.phone,
      eventType: known ? 'LOGIN_SUCCESS' : 'DEVICE_LOGIN',
      ipAddress: client.ipAddress,
      deviceId: client.deviceId,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toPublicUser(user, roles),
    };
  }

  private toPublicUser(user: UserRecord, roles: RoleCode[]) {
    return {
      id: user.id,
      phoneCountryCode: user.phone_country_code,
      phone: user.phone,
      fullName: user.full_name,
      email: user.email,
      avatarUrl: user.avatar_url,
      hasPassword: Boolean(user.password_hash),
      roles,
    };
  }

  private async issueTokens(
    input: {
      userId: string;
      phone: string | null;
      email?: string | null;
      roles: RoleCode[];
      sessionId?: string;
    },
    conn?: PoolConnection,
  ) {
    const policy = await getSessionPolicy();
    const refreshSeconds = Math.min(
      parseExpiryToSeconds(env.JWT_REFRESH_EXPIRES_IN),
      policy.userRefreshTtlDays * 24 * 60 * 60,
    );

    const accessToken = jwt.sign(
      {
        sub: input.userId,
        phone: input.phone ?? '',
        ...(input.email ? { email: input.email } : {}),
        roles: input.roles,
        type: 'access',
        principal: 'user',
        ...(input.sessionId ? { sid: input.sessionId } : {}),
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const refreshToken = jwt.sign(
      {
        sub: input.userId,
        type: 'refresh',
        principal: 'user',
        ...(input.sessionId ? { sid: input.sessionId } : {}),
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: refreshSeconds },
    );

    await this.repo.storeRefreshToken(
      input.userId,
      refreshToken,
      refreshSeconds,
      conn,
      input.sessionId,
    );

    return { accessToken, refreshToken };
  }

  private async releaseExpiredLock(user: UserRecord | null): Promise<UserRecord | null> {
    if (!user || user.status !== 'SECURITY_LOCKED' || !user.status_expires_at) return user;
    if (new Date(user.status_expires_at).getTime() > Date.now()) return user;
    await this.repo.clearSecurityLock(user.id);
    return { ...user, status: 'ACTIVE', status_expires_at: null };
  }

  private async maybeLock(
    user: UserRecord | null,
    phone: string,
    client: ClientContext,
    policy: Awaited<ReturnType<typeof getSessionPolicy>>,
  ) {
    if (!user) return;
    const failed = await this.repo.countSecurityEvents({
      phone,
      eventType: 'LOGIN_FAILED',
      windowMinutes: policy.failedAttemptWindowMinutes,
    });
    if (failed < policy.maxFailedAttempts) return;
    const until = new Date(Date.now() + policy.lockDurationMinutes * 60_000);
    await this.repo.lockUser(user.id, until);
    await this.repo.recordSecurityEvent({
      userId: user.id,
      phone,
      eventType: 'ACCOUNT_LOCKED',
      ipAddress: client.ipAddress,
      deviceId: client.deviceId,
    });
    const lockouts = await this.repo.countSecurityEvents({
      phone,
      eventType: 'ACCOUNT_LOCKED',
      windowMinutes: 24 * 60,
    });
    if (lockouts >= policy.maxRepeatedLockouts) {
      await getPool().execute(
        `UPDATE users SET risk_status = 'WATCH' WHERE id = ? AND risk_status = 'NORMAL'`,
        [user.id],
      );
    }
  }

  private async hasSeenDevice(userId: string, deviceId: string | null): Promise<boolean> {
    if (!deviceId) return true;
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id FROM user_sessions WHERE user_id = ? AND device_id = ? LIMIT 1`,
      [userId, deviceId],
    );
    return rows.length > 0;
  }
}
