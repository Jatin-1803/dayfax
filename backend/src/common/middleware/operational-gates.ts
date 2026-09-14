import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ForbiddenError } from '../errors/app-error.js';
import { readClientContext } from '../http/client-context.js';
import { AppControlsService } from '../../modules/app-controls/app-controls.service.js';

const controls = new AppControlsService();

function skipOperationalGate(req: Request): boolean {
  const path = req.originalUrl.split('?')[0] ?? '';
  return (
    path.includes('/health') ||
    path.includes('/webhooks/') ||
    path.includes('/admin') ||
    path.endsWith('/app/bootstrap') ||
    path.endsWith('/app/version-policy')
  );
}

export function enforceOperationalGates(req: Request, res: Response, next: NextFunction): void {
  if (skipOperationalGate(req)) {
    next();
    return;
  }

  void (async () => {
    const client = readClientContext(req);
    if (await controls.isUnsupported(client)) {
      throw new ForbiddenError('Please update the app to continue.', 'UNSUPPORTED_APP_VERSION');
    }
    const userId = verifiedUserId(req);
    const maintenance = await controls.maintenanceFor(userId);
    if (maintenance.blocked) {
      throw new ForbiddenError(maintenance.message, 'MAINTENANCE');
    }
    next();
  })().catch(next);
}

function verifiedUserId(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  try {
    const payload = jwt.verify(header.slice('Bearer '.length).trim(), env.JWT_ACCESS_SECRET) as {
      sub?: string;
    };
    return payload.sub;
  } catch {
    return undefined;
  }
}
