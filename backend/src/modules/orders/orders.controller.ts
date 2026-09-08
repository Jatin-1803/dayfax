import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { OrdersService } from './orders.service.js';
import type {
  CheckoutInput,
  ListOrdersQuery,
  QuoteInput,
  VerifyPaymentInput,
} from './orders.schema.js';

export class OrdersController {
  constructor(private readonly service = new OrdersService()) {}

  quote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.quote(req.user!.id, req.query as unknown as QuoteInput);
      sendSuccess(res, data, 'Delivery quote fetched');
    } catch (error) {
      next(error);
    }
  };

  checkout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.checkout(req.user!.id, req.body as CheckoutInput);
      sendSuccess(res, data, 'Order placed', 201);
    } catch (error) {
      next(error);
    }
  };

  verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.verifyPayment(
        req.user!.id,
        req.params.idOrNumber as string,
        req.body as VerifyPaymentInput,
      );
      sendSuccess(res, data, 'Payment verified');
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.user!.id, req.query as unknown as ListOrdersQuery);
      sendSuccess(res, data, 'Orders fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getByIdOrNumber(
        req.user!.id,
        req.params.idOrNumber as string,
      );
      sendSuccess(res, data, 'Order fetched');
    } catch (error) {
      next(error);
    }
  };

  timeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getTimeline(
        req.user!.id,
        req.params.idOrNumber as string,
      );
      sendSuccess(res, data, 'Order timeline fetched');
    } catch (error) {
      next(error);
    }
  };
}
