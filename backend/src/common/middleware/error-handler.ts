import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors/app-error.js';
import { logger } from '../logger/logger.js';
import { env } from '../../config/env.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: { code: 'ROUTE_NOT_FOUND' },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    const validation = new ValidationError('Validation failed', err.flatten());
    res.status(validation.statusCode).json({
      success: false,
      message: validation.message,
      error: { code: validation.code, details: validation.details },
    });
    return;
  }

  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, stack: err.stack });
    } else {
      logger.warn(err.message, { code: err.code });
    }

    const message =
      err.statusCode >= 500 && env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : err.message;

    res.status(err.statusCode).json({
      success: false,
      message,
      error: {
        code: err.code,
        ...(err.details !== undefined && env.NODE_ENV !== 'production'
          ? { details: err.details }
          : {}),
      },
    });
    return;
  }

  logger.error('Unhandled error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    error: { code: 'INTERNAL_ERROR' },
  });
}
