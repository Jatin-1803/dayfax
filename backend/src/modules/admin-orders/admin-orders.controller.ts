import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminOrdersService } from './admin-orders.service.js';
import type {
  AdminAssignOrderInput,
  AdminListOrdersQuery,
  AdminPatchOrderStatusInput,
} from './admin-orders.schema.js';

export class AdminOrdersController {
  constructor(private readonly service = new AdminOrdersService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.query as unknown as AdminListOrdersQuery);
      sendSuccess(res, data, 'Orders loaded');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getOne(req.params.idOrNumber as string);
      sendSuccess(res, data, 'Order loaded');
    } catch (error) {
      next(error);
    }
  };

  patchStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchStatus(
        req.params.idOrNumber as string,
        req.user!.id,
        req.body as AdminPatchOrderStatusInput,
      );
      sendSuccess(res, data, 'Order status updated');
    } catch (error) {
      next(error);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.assignPartner(
        req.params.idOrNumber as string,
        req.user!.id,
        req.body as AdminAssignOrderInput,
      );
      sendSuccess(res, data, 'Delivery partner assigned', 201);
    } catch (error) {
      next(error);
    }
  };
}
