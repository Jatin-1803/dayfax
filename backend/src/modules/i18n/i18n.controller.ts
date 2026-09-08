import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { I18nService } from './i18n.service.js';
import type {
  CreateUiStringInput,
  I18nBundleQuery,
  ListUiStringsQuery,
  UpdateUiStringInput,
} from './i18n.schema.js';

export class I18nController {
  constructor(private readonly service = new I18nService()) {}

  getBundle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as I18nBundleQuery;
      const data = await this.service.getBundle(query.lang);
      sendSuccess(res, data, 'Translation bundle fetched');
    } catch (error) {
      next(error);
    }
  };

  listAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listAdmin(req.query as unknown as ListUiStringsQuery);
      sendSuccess(res, data, 'UI strings fetched');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.create(req.body as CreateUiStringInput);
      sendSuccess(res, data, 'UI string created', 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.update(
        req.params.key as string,
        req.body as UpdateUiStringInput,
      );
      sendSuccess(res, data, 'UI string updated');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.remove(req.params.key as string);
      sendSuccess(res, data, 'UI string deleted');
    } catch (error) {
      next(error);
    }
  };
}
