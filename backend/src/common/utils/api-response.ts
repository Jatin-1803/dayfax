import type { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Request successful',
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}
