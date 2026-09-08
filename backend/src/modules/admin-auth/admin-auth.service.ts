import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { AdminAuthRepository } from './admin-auth.repository.js';
import type { AdminLoginInput } from './admin-auth.schema.js';

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

function mapAdminUser(row: {
  id: string;
  email: string;
  full_name: string | null;
}) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    roles: ['ADMIN'] as const,
  };
}

export class AdminAuthService {
  constructor(private readonly repo = new AdminAuthRepository()) {}

  async login(input: AdminLoginInput) {
    const email = input.email.trim().toLowerCase();
    const admin = await this.repo.findByEmail(email);
    if (!admin) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (admin.status === 'BLOCKED') {
      throw new ForbiddenError('Admin account is blocked');
    }
    if (admin.status !== 'ACTIVE') {
      throw new ForbiddenError('Admin account is inactive');
    }

    const ok = await bcrypt.compare(input.password, admin.password_hash);
    if (!ok) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.repo.touchLogin(admin.id);
    const tokens = await this.issueTokens(admin.id, admin.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: mapAdminUser(admin),
    };
  }

  async refresh(refreshToken: string) {
    const stored = await this.repo.findValidRefreshToken(refreshToken);
    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const admin = await this.repo.findById(stored.admin_user_id);
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedError('Admin not available');
    }

    await this.repo.revokeRefreshToken(stored.id);
    const tokens = await this.issueTokens(admin.id, admin.email);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async me(adminUserId: string) {
    const admin = await this.repo.findById(adminUserId);
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedError();
    }
    return mapAdminUser(admin);
  }

  async hashPassword(password: string): Promise<string> {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    return bcrypt.hash(password, 12);
  }

  private async issueTokens(adminUserId: string, email: string) {
    const accessToken = jwt.sign(
      {
        sub: adminUserId,
        email,
        phone: '',
        roles: ['ADMIN'],
        type: 'access',
        principal: 'admin',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const refreshToken = jwt.sign(
      {
        sub: adminUserId,
        type: 'refresh',
        principal: 'admin',
      },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    await this.repo.storeRefreshToken(
      adminUserId,
      refreshToken,
      parseExpiryToDate(env.JWT_REFRESH_EXPIRES_IN),
    );

    return { accessToken, refreshToken };
  }
}
