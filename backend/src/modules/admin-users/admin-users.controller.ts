import type { NextFunction, Request, Response } from 'express';
import type { RoleCode } from '../../common/middleware/auth.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminUsersService } from './admin-users.service.js';
import type { AdminGrantRoleInput, AdminListUsersQuery } from './admin-users.schema.js';

export class AdminUsersController {
  constructor(private readonly service = new AdminUsersService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.query as unknown as AdminListUsersQuery);
      sendSuccess(res, data, 'Users loaded');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getOne(req.params.id as string);
      sendSuccess(res, data, 'User loaded');
    } catch (error) {
      next(error);
    }
  };

  grantRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.grantRole(
        req.params.id as string,
        req.body as AdminGrantRoleInput,
      );
      sendSuccess(res, data, 'Role granted');
    } catch (error) {
      next(error);
    }
  };

  revokeRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.revokeRole(
        req.params.id as string,
        req.params.role as RoleCode,
      );
      sendSuccess(res, data, 'Role revoked');
    } catch (error) {
      next(error);
    }
  };
}
