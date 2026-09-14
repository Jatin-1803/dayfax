import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { BusinessAnalyticsService } from './business-analytics.service.js';
import type {
  AnalyticsExportQueryInput,
  AnalyticsOrdersQueryInput,
  AnalyticsProductsQueryInput,
  AnalyticsRangeInput,
  AnalyticsTrendQueryInput,
} from './business-analytics.schema.js';

export class BusinessAnalyticsController {
  constructor(private readonly service = new BusinessAnalyticsService()) {}

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.summary(req.query as unknown as AnalyticsRangeInput);
      sendSuccess(res, data, 'Business analytics summary loaded');
    } catch (err) {
      next(err);
    }
  };

  trend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.trend(req.query as unknown as AnalyticsTrendQueryInput);
      sendSuccess(res, data, 'Business analytics trend loaded');
    } catch (err) {
      next(err);
    }
  };

  orderProfit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.orderProfitList(
        req.query as unknown as AnalyticsOrdersQueryInput,
      );
      sendSuccess(res, data, 'Order profit loaded');
    } catch (err) {
      next(err);
    }
  };

  orderDetail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.orderProfitDetail(req.params.id as string);
      sendSuccess(res, data, 'Order profit detail loaded');
    } catch (err) {
      next(err);
    }
  };

  productProfit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.productProfitList(
        req.query as unknown as AnalyticsProductsQueryInput,
      );
      sendSuccess(res, data, 'Product profit loaded');
    } catch (err) {
      next(err);
    }
  };

  exportReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await this.service.exportCsv(
        req.query as unknown as AnalyticsExportQueryInput,
      );
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      res.status(200).send(file.body);
    } catch (err) {
      next(err);
    }
  };
}
