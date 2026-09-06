import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AuthController } from './auth.controller.js';
import {
  refreshTokenSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from './auth.schema.js';

const controller = new AuthController();
export const authRouter = Router();

/** Tight limit on OTP to reduce SMS abuse / DB write storms without blocking normal login. */
const otpRequestLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MS,
  limit: env.OTP_REQUEST_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
    error: { code: 'RATE_LIMITED' },
  },
});

const otpVerifyLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MS,
  limit: env.OTP_VERIFY_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP attempts. Please try again later.',
    error: { code: 'RATE_LIMITED' },
  },
});

authRouter.post(
  '/otp/request',
  otpRequestLimiter,
  validateRequest(requestOtpSchema),
  controller.requestOtp,
);
authRouter.post(
  '/otp/verify',
  otpVerifyLimiter,
  validateRequest(verifyOtpSchema),
  controller.verifyOtp,
);
authRouter.post('/token/refresh', validateRequest(refreshTokenSchema), controller.refresh);
authRouter.get('/me', authenticate, controller.me);
