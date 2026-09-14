import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { assertAdminAccess, assertUserAccess } from '../auth/account-access.js';
import { hasPermission, loadAdminAccess } from '../auth/admin-permissions.js';
import { ACCESS_CLOCK_TOLERANCE_SECONDS } from '../auth/token-session.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export type RoleCode = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';
export type AuthPrincipal = 'user' | 'admin';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  roles: RoleCode[];
  principal: AuthPrincipal;
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface AccessTokenPayload {
  sub: string;
  phone?: string;
  email?: string;
  roles: RoleCode[];
  type: 'access';
  principal?: AuthPrincipal;
  sid?: string;
  iat?: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError());
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      clockTolerance: ACCESS_CLOCK_TOLERANCE_SECONDS,
    }) as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Invalid or expired token', 'TOKEN_EXPIRED'));
      return;
    }
    next(new UnauthorizedError('Invalid or expired token', 'TOKEN_INVALID'));
    return;
  }

  if (payload.type !== 'access' || !payload.sub) {
    next(new UnauthorizedError('Invalid token', 'TOKEN_INVALID'));
    return;
  }

    req.user = {
      id: payload.sub,
      phone: payload.phone ?? '',
      email: payload.email,
      roles: payload.roles ?? [],
      principal: payload.principal ?? 'user',
      sessionId: payload.sid,
    };

  const access = {
    sessionId: payload.sid,
    issuedAt: payload.iat,
  };
  const check =
    req.user.principal === 'admin'
      ? assertAdminAccess({ adminId: payload.sub, ...access })
      : assertUserAccess({ userId: payload.sub, ...access });

  void check.then(() => next()).catch(next);
}

export function requirePermission(...codes: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || req.user.principal !== 'admin') {
      next(new ForbiddenError());
      return;
    }
    void loadAdminAccess(req.user.id)
      .then((access) => {
        if (codes.some((code) => hasPermission(access.permissions, code))) {
          next();
          return;
        }
        next(new ForbiddenError('You do not have permission to perform this action'));
      })
      .catch(next);
  };
}

export function requireRoles(...allowed: RoleCode[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    const ok = req.user.roles.some((role) => allowed.includes(role));
    if (!ok) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/** Admin console routes that must be email/password admin_users sessions. */
export function requireAdminPrincipal() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (req.user.principal !== 'admin' || !req.user.roles.includes('ADMIN')) {
      next(new ForbiddenError('Admin console login required'));
      return;
    }
    next();
  };
}
