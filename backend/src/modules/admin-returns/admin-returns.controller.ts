import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminReturnsService } from './admin-returns.service.js';
import type {
  AdminListReturnsQuery,
  AdminMarkPaidInput,
  AdminRejectReturnInput,
} from './admin-returns.schema.js';

export class AdminReturnsController {
  constructor(private readonly service = new AdminReturnsService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.query as unknown as AdminListReturnsQuery);
      sendSuccess(res, data, 'Returns loaded');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getOne(req.params.id as string);
      sendSuccess(res, data, 'Return loaded');
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.approve(req.params.id as string, req.user!.id);
      sendSuccess(res, data, 'Return approved');
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.reject(
        req.params.id as string,
        req.user!.id,
        req.body as AdminRejectReturnInput,
      );
      sendSuccess(res, data, 'Return rejected');
    } catch (error) {
      next(error);
    }
  };

  markPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.markPaid(
        req.params.id as string,
        req.body as AdminMarkPaidInput,
      );
      sendSuccess(res, data, 'Refund marked paid');
    } catch (error) {
      next(error);
    }
  };

  retryRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.retryRefund(req.params.id as string);
      sendSuccess(res, data, 'Refund retried');
    } catch (error) {
      next(error);
    }
  };

  markCancelPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.markCancelPaid(
        req.params.paymentId as string,
        req.body as AdminMarkPaidInput,
      );
      sendSuccess(res, data, 'Refund marked paid');
    } catch (error) {
      next(error);
    }
  };
}
