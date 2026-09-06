import winston from 'winston';
import { env } from '../../config/env.js';

const sensitiveKeys = ['otp', 'password', 'token', 'authorization', 'refreshToken', 'accessToken'];

function redact(info: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...info };
  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      clone[key] = '[REDACTED]';
    }
  }
  return clone;
}

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;
      const safeRest = redact(rest as Record<string, unknown>);
      const meta = Object.keys(safeRest).length ? ` ${JSON.stringify(safeRest)}` : '';
      return `${timestamp} [${level}] ${message}${meta}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});
