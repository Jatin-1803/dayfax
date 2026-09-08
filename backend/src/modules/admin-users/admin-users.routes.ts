import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminUsersController } from './admin-users.controller.js';
import {
  adminGrantRoleSchema,
  adminListUsersSchema,
  adminRevokeRoleParamsSchema,
  adminUserIdParamsSchema,
} from './admin-users.schema.js';

const controller = new AdminUsersController();
export const adminUsersRouter = Router();

adminUsersRouter.use(authenticate, requireAdminPrincipal());

adminUsersRouter.get('/', validateRequest(adminListUsersSchema, 'query'), controller.list);
adminUsersRouter.get(
  '/:id',
  validateRequest(adminUserIdParamsSchema, 'params'),
  controller.getOne,
);
adminUsersRouter.post(
  '/:id/roles',
  validateRequest(adminUserIdParamsSchema, 'params'),
  validateRequest(adminGrantRoleSchema),
  controller.grantRole,
);
adminUsersRouter.delete(
  '/:id/roles/:role',
  validateRequest(adminRevokeRoleParamsSchema, 'params'),
  controller.revokeRole,
);
