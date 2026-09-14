import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env.js';
import {
  parseExpiryToSeconds,
  refreshTokenDecision,
} from '../../common/auth/token-session.js';
import { withTransaction } from '../../common/database/pool.js';
import {
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { createAdminSession } from '../../common/auth/session-store.js';
import { loadAdminAccess } from '../../common/auth/admin-permissions.js';
import { getSessionPolicy } from '../../common/config/session-policy.js';
import type { ClientContext } from '../../common/http/client-context.js';
import { AdminAuthRepository } from './admin-auth.repository.js';
import type { AdminLoginInput } from './admin-auth.schema.js';

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

  async login(input: AdminLoginInput, client: ClientContext) {
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
    const policy = await getSessionPolicy();
    const sessionId = await createAdminSession({
      adminUserId: admin.id,
      client,
      absoluteMinutes: policy.adminAbsoluteTimeoutMinutes,
    });
    const tokens = await this.issueTokens(admin.id, admin.email, undefined, sessionId);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await this.mapWithAccess(admin),
    };
  }

  async refresh(refreshToken: string, client: ClientContext) {
    return withTransaction(async (conn) => {
      const stored = await this.repo.findRefreshTokenForUpdate(refreshToken, conn);
      const decision = refreshTokenDecision(stored);
      if (!stored || decision === 'reject') {
        throw new UnauthorizedError('Invalid refresh token', 'REFRESH_INVALID');
      }

      const admin = await this.repo.findById(stored.admin_user_id);
      if (!admin || admin.status !== 'ACTIVE') {
        throw new UnauthorizedError('Admin not available', 'REFRESH_INVALID');
      }

      if (decision === 'rotate') {
        await this.repo.revokeRefreshToken(stored.id, conn);
      }

      const policy = await getSessionPolicy();
      const sessionId =
        stored.sessionId ??
        (await createAdminSession(
          {
            adminUserId: admin.id,
            client,
            absoluteMinutes: policy.adminAbsoluteTimeoutMinutes,
          },
          conn,
        ));
      const tokens = await this.issueTokens(admin.id, admin.email, conn, sessionId);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    });
  }

  async me(adminUserId: string) {
    const admin = await this.repo.findById(adminUserId);
    if (!admin || admin.status !== 'ACTIVE') {
      throw new UnauthorizedError();
    }
    return this.mapWithAccess(admin);
  }

  private async mapWithAccess(admin: { id: string; email: string; full_name: string | null }) {
    const access = await loadAdminAccess(admin.id);
    return {
      ...mapAdminUser(admin),
      consoleRoles: access.roles,
      permissions: [...access.permissions],
    };
  }

  async hashPassword(password: string): Promise<string> {
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    return bcrypt.hash(password, 12);
  }

  private async issueTokens(
    adminUserId: string,
    email: string,
    conn?: PoolConnection,
    sessionId?: string,
  ) {
    const accessToken = jwt.sign(
      {
        sub: adminUserId,
        email,
        phone: '',
        roles: ['ADMIN'],
        type: 'access',
        principal: 'admin',
        ...(sessionId ? { sid: sessionId } : {}),
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
      parseExpiryToSeconds(env.JWT_REFRESH_EXPIRES_IN),
      conn,
      sessionId,
    );

    return { accessToken, refreshToken };
  }
}
