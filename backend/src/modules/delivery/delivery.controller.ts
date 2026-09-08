import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { CodPaymentService } from '../payments/cod-payment.service.js';
import { DeliveryService } from './delivery.service.js';
import type { ListJobsQuery, UpdateAssignmentStatusInput } from './delivery.schema.js';

export class DeliveryController {
  constructor(
    private readonly service = new DeliveryService(),
    private readonly payments = new CodPaymentService(),
  ) {}

  stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getStats(req.user!.id);
      sendSuccess(res, data, 'Delivery stats fetched');
    } catch (error) {
      next(error);
    }
  };

  listJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listJobs(
        req.user!.id,
        req.query as unknown as ListJobsQuery,
      );
      sendSuccess(res, data, 'Delivery jobs fetched');
    } catch (error) {
      next(error);
    }
  };

  getJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getJobDetail(
        req.user!.id,
        req.user!.roles,
        req.params.idOrOrderId as string,
      );
      sendSuccess(res, data, 'Delivery job fetched');
    } catch (error) {
      next(error);
    }
  };

  claimJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accepted = await this.service.acceptAvailableOrder(
        req.user!.id,
        req.user!.roles,
        req.params.orderId as string,
      );
      const data = await this.service.getJobDetail(
        req.user!.id,
        req.user!.roles,
        accepted.assignmentId,
      );
      sendSuccess(res, data, 'Delivery job claimed', accepted.created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  };

  acceptOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const accepted = await this.service.acceptAvailableOrder(
        req.user!.id,
        req.user!.roles,
        req.params.orderId as string,
      );
      const data = await this.service.getJobDetail(
        req.user!.id,
        req.user!.roles,
        accepted.assignmentId,
      );
      sendSuccess(res, data, 'Delivery order accepted', accepted.created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  };

  createPaymentQr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.payments.createOrReuseQr(
        req.user!.id,
        req.params.orderId as string,
      );
      sendSuccess(res, data, 'Payment QR ready');
    } catch (error) {
      next(error);
    }
  };

  checkPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.payments.checkPayment(
        req.user!.id,
        req.params.orderId as string,
      );
      sendSuccess(res, data, 'Payment status checked');
    } catch (error) {
      next(error);
    }
  };

  collectCash = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.payments.collectCash(
        req.user!.id,
        req.params.orderId as string,
      );
      sendSuccess(res, data, 'Cash collected');
    } catch (error) {
      next(error);
    }
  };

  acceptJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.acceptJob(
        req.user!.id,
        req.user!.roles,
        req.params.assignmentId as string,
      );
      sendSuccess(res, data, 'Delivery job accepted');
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.updateJobStatus(
        req.user!.id,
        req.user!.roles,
        req.params.assignmentId as string,
        req.body as UpdateAssignmentStatusInput,
      );
      sendSuccess(res, data, 'Delivery status updated');
    } catch (error) {
      next(error);
    }
  };
}
