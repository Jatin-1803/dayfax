import { Router } from 'express';
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

authRouter.post('/otp/request', validateRequest(requestOtpSchema), controller.requestOtp);
authRouter.post('/otp/verify', validateRequest(verifyOtpSchema), controller.verifyOtp);
authRouter.post('/token/refresh', validateRequest(refreshTokenSchema), controller.refresh);
authRouter.get('/me', authenticate, controller.me);
