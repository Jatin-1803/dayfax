import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { logger } from '../../common/logger/logger.js';
import type { RoleCode } from '../../common/middleware/auth.js';
import { AuthRepository } from './auth.repository.js';
import type { RequestOtpInput, VerifyOtpInput } from './auth.schema.js';

function parseExpiryToDate(expiresIn: string): Date {
  const match = /^(\d+)([smhd])$/.exec(expiresIn);
  if (!match) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return new Date(Date.now() + amount * (multipliers[unit] ?? multipliers.d));
}

export class AuthService {
  constructor(private readonly repo = new AuthRepository()) {}

  async requestOtp(input: RequestOtpInput) {
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

    if (env.OTP_PROVIDER === 'dev') {
      logger.info('Dev OTP issued', {
        challengeId,
        phone: `${input.phoneCountryCode}${input.phone.slice(0, 2)}******`,
      });
    } else {
      // SMS provider integration point (Twilio/MSG91/etc.)
      logger.info('OTP dispatched via SMS provider', { challengeId });
    }

    return {
      challengeId,
      expiresInSeconds: env.OTP_EXPIRES_SECONDS,
      ...(env.NODE_ENV === 'development' ? { devOtp: code } : {}),
    };
  }

  async verifyOtp(input: VerifyOtpInput) {
    const challenge = await this.repo.findLatestActiveOtp(
      input.phoneCountryCode,
      input.phone,
    );

    if (!challenge) {
      throw new ValidationError('OTP expired or not found. Please request a new code.');
    }

    if (challenge.attempts >= challenge.max_attempts) {
      throw new ValidationError('Too many invalid attempts. Please request a new code.');
    }

    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new ValidationError('OTP expired. Please request a new code.');
    }

    const matches = this.repo.hash(input.otp) === challenge.code_hash;
    if (!matches) {
      await this.repo.incrementOtpAttempts(challenge.id);
      throw new ValidationError('Invalid OTP');
    }

    await this.repo.consumeOtp(challenge.id);

    let user = await this.repo.findUserByPhone(input.phoneCountryCode, input.phone);
    if (!user) {
      user = await this.repo.createCustomerUser(input.phoneCountryCode, input.phone);
    }

    if (user.status === 'BLOCKED') {
      throw new ForbiddenError('Your account is blocked. Contact support.');
    }

    const roles = await this.repo.getUserRoles(user.id);
    await this.repo.touchLogin(user.id);

    const tokens = await this.issueTokens({
      userId: user.id,
      phone: user.phone,
      roles,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        phoneCountryCode: user.phone_country_code,
        phone: user.phone,
        fullName: user.full_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        roles,
      },
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.repo.findValidRefreshToken(refreshToken);
    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.repo.findUserById(stored.user_id);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User not available');
    }

    const roles = await this.repo.getUserRoles(user.id);
    await this.repo.revokeRefreshToken(stored.id);

    const tokens = await this.issueTokens({
      userId: user.id,
      phone: user.phone,
      roles,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async me(userId: string) {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    const roles = await this.repo.getUserRoles(user.id);
    return {
      id: user.id,
      phoneCountryCode: user.phone_country_code,
      phone: user.phone,
      fullName: user.full_name,
      email: user.email,
      avatarUrl: user.avatar_url,
      roles,
    };
  }

  private async issueTokens(input: {
    userId: string;
    phone: string;
    roles: RoleCode[];
  }) {
    const accessToken = jwt.sign(
      {
        sub: input.userId,
        phone: input.phone,
        roles: input.roles,
        type: 'access',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const refreshToken = jwt.sign(
      {
        sub: input.userId,
        type: 'refresh',
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    await this.repo.storeRefreshToken(
      input.userId,
      refreshToken,
      parseExpiryToDate(env.JWT_REFRESH_EXPIRES_IN),
    );

    return { accessToken, refreshToken };
  }
}
