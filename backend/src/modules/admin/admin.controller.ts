import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminService } from './admin.service.js';
import type {
  CreateDeliveryPartnerInput,
  ListDeliveryPartnersQuery,
} from './admin.schema.js';

export class AdminController {
  constructor(private readonly service = new AdminService()) {}

  createDeliveryPartner = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.createOrPromoteDeliveryPartner(
        req.body as CreateDeliveryPartnerInput,
      );
      const statusCode = data.created ? 201 : 200;
      const message = data.created
        ? 'Delivery partner created'
        : data.roleAdded
          ? 'Delivery partner role granted'
          : 'Delivery partner already exists';
      sendSuccess(res, data, message, statusCode);
    } catch (error) {
      next(error);
    }
  };

  listDeliveryPartners = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.listDeliveryPartners(
        req.query as unknown as ListDeliveryPartnersQuery,
      );
      sendSuccess(res, data, 'Delivery partners loaded');
    } catch (error) {
      next(error);
    }
  };
}
