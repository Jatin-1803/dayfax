import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminNotificationsService } from './admin-notifications.service.js';
import type { SendPromoInput } from './admin-notifications.schema.js';

export class AdminNotificationsController {
  constructor(private readonly service = new AdminNotificationsService()) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list();
      sendSuccess(res, data, 'Promotions fetched');
    } catch (error) {
      next(error);
    }
  };

  listOrderAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page ?? 1) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50) || 50));
      const orderId =
        typeof req.query.orderId === 'string' && req.query.orderId.trim()
          ? req.query.orderId.trim()
          : undefined;
      const data = await this.service.listOrderAlerts({ page, limit, orderId });
      sendSuccess(res, data, 'Order delivery alerts fetched');
    } catch (error) {
      next(error);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.send(req.user!.id, req.body as SendPromoInput);
      sendSuccess(res, data, 'Promotion sent', 201);
    } catch (error) {
      next(error);
    }
  };
}
