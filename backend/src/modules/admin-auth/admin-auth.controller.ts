import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminAuthService } from './admin-auth.service.js';
import type { AdminLoginInput, AdminRefreshInput } from './admin-auth.schema.js';

export class AdminAuthController {
  constructor(private readonly service = new AdminAuthService()) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.login(req.body as AdminLoginInput);
      sendSuccess(res, data, 'Admin signed in');
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as AdminRefreshInput;
      const data = await this.service.refresh(body.refreshToken);
      sendSuccess(res, data, 'Token refreshed');
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.me(req.user!.id);
      sendSuccess(res, data, 'Admin profile loaded');
    } catch (error) {
      next(error);
    }
  };
}
