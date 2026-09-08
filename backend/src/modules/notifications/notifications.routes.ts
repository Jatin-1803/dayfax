import { Router } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { NotificationsController } from './notifications.controller.js';
import { listNotificationsSchema } from './notifications.schema.js';

const controller = new NotificationsController();
export const notificationsRouter = Router();

notificationsRouter.use(authenticate, requireRoles('CUSTOMER', 'ADMIN'));

notificationsRouter.get('/', validateRequest(listNotificationsSchema, 'query'), controller.list);
notificationsRouter.get('/unread-count', controller.unreadCount);
notificationsRouter.post('/read-all', controller.markAllRead);
notificationsRouter.post('/:id/read', controller.markRead);
