import type { NextFunction, Request, Response } from 'express';
import { logger } from '../logger/logger.js';

/**
 * Structured access log with duration. Skips static media noise.
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/media') || req.path.startsWith('/admin/')) {
    next();
    return;
  }

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const payload = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: req.user?.id,
    };
    if (res.statusCode >= 500) {
      logger.error('request_completed', payload);
    } else if (durationMs >= 1000 || res.statusCode >= 400) {
      logger.warn('request_completed', payload);
    } else {
      logger.info('request_completed', payload);
    }
  });
  next();
}
