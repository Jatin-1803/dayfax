import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { NotificationsService } from './notifications.service.js';
import type { ListNotificationsQuery } from './notifications.schema.js';

export class NotificationsController {
  constructor(private readonly service = new NotificationsService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(
        req.user!.id,
        req.query as unknown as ListNotificationsQuery,
      );
      sendSuccess(res, data, 'Notifications fetched');
    } catch (error) {
      next(error);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.unreadCount(req.user!.id);
      sendSuccess(res, data, 'Unread count fetched');
    } catch (error) {
      next(error);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.markRead(req.user!.id, req.params.id as string);
      sendSuccess(res, data, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.markAllRead(req.user!.id);
      sendSuccess(res, data, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  };
}
