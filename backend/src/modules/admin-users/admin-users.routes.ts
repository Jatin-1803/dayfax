import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAdminPrincipal, requirePermission } from '../../common/middleware/auth.js';
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

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const idSchema = z.object({ id: z.string().uuid() });

adminUsersRouter.get('/:id/sessions', requirePermission('sessions.view'), validateRequest(idSchema, 'params'), controller.sessions);
adminUsersRouter.get('/:id/activity', requirePermission('users.view'), validateRequest(idSchema, 'params'), controller.activity);
adminUsersRouter.get('/:id/notes', requirePermission('users.view'), validateRequest(idSchema, 'params'), controller.notes);
adminUsersRouter.post(
  '/:id/notes',
  requirePermission('users.edit'),
  validateRequest(idSchema, 'params'),
  validateRequest(z.object({ body: z.string().trim().min(1).max(2000) })),
  controller.addNote,
);
adminUsersRouter.post('/:id/suspend', requirePermission('users.suspend'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema.extend({ expiresAt: z.string().datetime().nullable().optional() })), controller.suspend);
adminUsersRouter.post('/:id/unsuspend', requirePermission('users.suspend'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.unsuspend);
adminUsersRouter.post('/:id/ban', requirePermission('users.ban'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.ban);
adminUsersRouter.post('/:id/unban', requirePermission('users.unban'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.unban);
adminUsersRouter.post('/:id/deactivate', requirePermission('users.deactivate'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.deactivate);
adminUsersRouter.post('/:id/activate', requirePermission('users.edit'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.activate);
adminUsersRouter.post('/:id/restore', requirePermission('users.edit'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.restore);
adminUsersRouter.post('/:id/force-logout', requirePermission('sessions.revoke'), validateRequest(idSchema, 'params'), validateRequest(reasonSchema), controller.forceLogout);
adminUsersRouter.post(
  '/:id/sessions/:sessionId/revoke',
  requirePermission('sessions.revoke'),
  validateRequest(z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }), 'params'),
  validateRequest(reasonSchema),
  controller.revokeSession,
);
adminUsersRouter.post(
  '/:id/risk',
  requirePermission('users.edit'),
  validateRequest(idSchema, 'params'),
  validateRequest(z.object({
    riskStatus: z.enum(['NORMAL', 'WATCH', 'SUSPICIOUS', 'RESTRICTED']),
    reason: z.string().trim().min(3).max(500),
  })),
  controller.risk,
);
