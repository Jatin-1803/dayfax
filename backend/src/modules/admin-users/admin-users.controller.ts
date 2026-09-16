import type { NextFunction, Request, Response } from 'express';
import type { RoleCode } from '../../common/middleware/auth.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AccountLifecycleService } from './account-lifecycle.service.js';
import { AdminUsersService } from './admin-users.service.js';
import type { AdminGrantRoleInput, AdminListUsersQuery } from './admin-users.schema.js';

export class AdminUsersController {
  constructor(
    private readonly service = new AdminUsersService(),
    private readonly lifecycle = new AccountLifecycleService(),
  ) {}

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
      const data = await this.service.getOne(String(req.params.id) as string);
      sendSuccess(res, data, 'User loaded');
    } catch (error) {
      next(error);
    }
  };

  grantRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.grantRole(
        String(req.params.id) as string,
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
        String(req.params.id) as string,
        req.params.role as RoleCode,
      );
      sendSuccess(res, data, 'Role revoked');
    } catch (error) {
      next(error);
    }
  };

  private reason(req: Request) {
    return {
      userId: String(req.params.id),
      adminId: req.user!.id,
      reason: String(req.body.reason ?? ''),
      requestId: req.requestId,
      ipAddress: req.ip,
    };
  }

  suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.changeStatus({
        ...this.reason(req),
        status: 'SUSPENDED',
        expiresAt: req.body.expiresAt ?? null,
        action: 'USER_SUSPENDED',
      });
      sendSuccess(res, data, 'User suspended');
    } catch (error) {
      next(error);
    }
  };

  unsuspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.unsuspend(String(req.params.id), req.user!.id, req.body.reason, req.requestId);
      sendSuccess(res, data, 'User unsuspended');
    } catch (error) {
      next(error);
    }
  };

  ban = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.changeStatus({
        ...this.reason(req),
        status: 'BANNED',
        action: 'USER_BANNED',
      });
      sendSuccess(res, data, 'User banned');
    } catch (error) {
      next(error);
    }
  };

  unban = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.unban(String(req.params.id), req.user!.id, req.body.reason, req.requestId);
      sendSuccess(res, data, 'User unbanned');
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.changeStatus({
        ...this.reason(req),
        status: 'INACTIVE',
        action: 'USER_DEACTIVATED',
      });
      sendSuccess(res, data, 'User deactivated');
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.changeStatus({
        ...this.reason(req),
        status: 'ACTIVE',
        action: 'USER_ACTIVATED',
      });
      sendSuccess(res, data, 'User activated');
    } catch (error) {
      next(error);
    }
  };

  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.restore(String(req.params.id), req.user!.id, req.body.reason, req.requestId);
      sendSuccess(res, data, 'User restored');
    } catch (error) {
      next(error);
    }
  };

  softDelete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.softDelete(
        String(req.params.id),
        req.user!.id,
        req.body.reason,
        req.requestId,
      );
      sendSuccess(res, data, 'User deleted');
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.adminResetPassword(
        String(req.params.id),
        req.user!.id,
        req.body,
        req.requestId,
        req.ip,
      );
      sendSuccess(res, data, 'Password updated');
    } catch (error) {
      next(error);
    }
  };

  forceLogout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.forceLogout(String(req.params.id), req.user!.id, req.body.reason, req.requestId);
      sendSuccess(res, data, 'User signed out');
    } catch (error) {
      next(error);
    }
  };

  sessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.lifecycle.sessions(String(req.params.id)), 'Sessions');
    } catch (error) {
      next(error);
    }
  };

  revokeSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.lifecycle.revokeSession(
        String(req.params.id),
        String(req.params.sessionId),
        req.user!.id,
        req.body.reason,
        req.requestId,
      );
      sendSuccess(res, { revoked: true }, 'Session revoked');
    } catch (error) {
      next(error);
    }
  };

  risk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.setRisk(
        String(req.params.id),
        req.user!.id,
        req.body.riskStatus,
        req.body.reason,
        req.requestId,
      );
      sendSuccess(res, data, 'Risk updated');
    } catch (error) {
      next(error);
    }
  };

  notes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.lifecycle.notes(String(req.params.id)), 'Notes');
    } catch (error) {
      next(error);
    }
  };

  addNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.lifecycle.addNote(String(req.params.id), req.user!.id, req.body.body);
      sendSuccess(res, data, 'Note added', 201);
    } catch (error) {
      next(error);
    }
  };

  activity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.lifecycle.activity(String(req.params.id)), 'Activity');
    } catch (error) {
      next(error);
    }
  };
}
