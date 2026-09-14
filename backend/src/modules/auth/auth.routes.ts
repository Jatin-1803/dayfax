import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AuthController } from './auth.controller.js';
import {
  changePasswordSchema,
  googleLoginSchema,
  linkPhoneDirectSchema,
  linkPhoneRequestSchema,
  linkPhoneVerifySchema,
  passwordLoginSchema,
  passwordRegisterSchema,
  passwordStatusSchema,
  refreshTokenSchema,
  requestOtpSchema,
  setPasswordSchema,
  updateProfileSchema,
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

const passwordLoginLimiter = rateLimit({
  windowMs: env.OTP_RATE_LIMIT_WINDOW_MS,
  limit: env.OTP_VERIFY_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
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
authRouter.post(
  '/google',
  passwordLoginLimiter,
  validateRequest(googleLoginSchema),
  controller.loginWithGoogle,
);
authRouter.post(
  '/password/login',
  passwordLoginLimiter,
  validateRequest(passwordLoginSchema),
  controller.loginWithPassword,
);
authRouter.post(
  '/password/status',
  passwordLoginLimiter,
  validateRequest(passwordStatusSchema),
  controller.passwordStatus,
);
authRouter.post(
  '/password/register',
  passwordLoginLimiter,
  validateRequest(passwordRegisterSchema),
  controller.registerWithPassword,
);
authRouter.post('/token/refresh', validateRequest(refreshTokenSchema), controller.refresh);
authRouter.get('/me', authenticate, controller.me);
authRouter.patch('/me', authenticate, validateRequest(updateProfileSchema), controller.updateProfile);
authRouter.post(
  '/phone/link/request',
  authenticate,
  otpRequestLimiter,
  validateRequest(linkPhoneRequestSchema),
  controller.requestLinkPhone,
);
authRouter.post(
  '/phone/link/verify',
  authenticate,
  otpVerifyLimiter,
  validateRequest(linkPhoneVerifySchema),
  controller.verifyLinkPhone,
);
authRouter.post(
  '/phone/link',
  authenticate,
  passwordLoginLimiter,
  validateRequest(linkPhoneDirectSchema),
  controller.linkPhoneDirect,
);
authRouter.post('/password', authenticate, validateRequest(setPasswordSchema), controller.setPassword);
authRouter.post(
  '/password/change',
  authenticate,
  validateRequest(changePasswordSchema),
  controller.changePassword,
);
authRouter.get('/sessions', authenticate, controller.sessions);
authRouter.post('/sessions/revoke-others', authenticate, controller.revokeOthers);
authRouter.post('/sessions/:id/revoke', authenticate, controller.revokeSession);
