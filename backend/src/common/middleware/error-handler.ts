import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ServiceUnavailableError, ValidationError } from '../errors/app-error.js';
import { logger } from '../logger/logger.js';
import { env } from '../../config/env.js';

function isPoolQueueError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Queue limit reached');
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: { code: 'ROUTE_NOT_FOUND' },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId;
  const normalized = isPoolQueueError(err)
    ? new ServiceUnavailableError('Database is busy. Please retry shortly.')
    : err;

  if (normalized instanceof ZodError) {
    const validation = new ValidationError('Validation failed', normalized.flatten());
    res.status(validation.statusCode).json({
      success: false,
      message: validation.message,
      error: { code: validation.code, details: validation.details, requestId },
    });
    return;
  }

  if (normalized instanceof AppError) {
    if (!normalized.isOperational || normalized.statusCode >= 500) {
      logger.error(normalized.message, {
        code: normalized.code,
        stack: normalized.stack,
        requestId,
      });
    } else {
      logger.warn(normalized.message, { code: normalized.code, requestId });
    }

    const message =
      normalized.statusCode >= 500 &&
      normalized.statusCode !== 503 &&
      env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : normalized.message;

    res.status(normalized.statusCode).json({
      success: false,
      message,
      error: {
        code: normalized.code,
        requestId,
        ...(normalized.details !== undefined && env.NODE_ENV !== 'production'
          ? { details: normalized.details }
          : {}),
      },
    });
    return;
  }

  logger.error('Unhandled error', {
    requestId,
    error: normalized instanceof Error ? normalized.message : String(normalized),
    stack: normalized instanceof Error ? normalized.stack : undefined,
  });

  res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
    error: { code: 'INTERNAL_ERROR', requestId },
  });
}
