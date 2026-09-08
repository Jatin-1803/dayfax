import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { adminLoginSchema, adminRefreshSchema } from './admin-auth.schema.js';

const controller = new AdminAuthController();
export const adminAuthRouter = Router();

adminAuthRouter.post('/login', validateRequest(adminLoginSchema), controller.login);
adminAuthRouter.post(
  '/token/refresh',
  validateRequest(adminRefreshSchema),
  controller.refresh,
);
adminAuthRouter.get('/me', authenticate, requireAdminPrincipal(), controller.me);
