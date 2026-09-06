import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AuthService } from './auth.service.js';
import type { RefreshTokenInput, RequestOtpInput, VerifyOtpInput } from './auth.schema.js';

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  requestOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.requestOtp(req.body as RequestOtpInput);
      sendSuccess(res, data, 'OTP sent successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.verifyOtp(req.body as VerifyOtpInput);
      sendSuccess(res, data, 'Login successful');
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as RefreshTokenInput;
      const data = await this.service.refresh(body.refreshToken);
      sendSuccess(res, data, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.me(req.user!.id);
      sendSuccess(res, data, 'Profile fetched');
    } catch (error) {
      next(error);
    }
  };
}
