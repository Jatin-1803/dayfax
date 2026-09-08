import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../errors/app-error.js';

export type RoleCode = 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';
export type AuthPrincipal = 'user' | 'admin';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  roles: RoleCode[];
  principal: AuthPrincipal;
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
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new UnauthorizedError());
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    if (payload.type !== 'access') {
      next(new UnauthorizedError('Invalid token'));
      return;
    }
    req.user = {
      id: payload.sub,
      phone: payload.phone ?? '',
      email: payload.email,
      roles: payload.roles,
      principal: payload.principal ?? 'user',
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
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
