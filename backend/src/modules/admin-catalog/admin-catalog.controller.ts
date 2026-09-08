import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import type {
  CreateCategoryInput,
  PatchCategoryInput,
  PatchProductInput,
} from './admin-catalog.schema.js';

export class AdminCatalogController {
  constructor(private readonly service = new AdminCatalogService()) {}

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createCategory(req.body as CreateCategoryInput);
      sendSuccess(res, data, 'Category created', 201);
    } catch (error) {
      next(error);
    }
  };

  getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getProduct(req.params.id as string);
      sendSuccess(res, data, 'Product loaded');
    } catch (error) {
      next(error);
    }
  };

  patchCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchCategory(
        req.params.id as string,
        req.body as PatchCategoryInput,
      );
      sendSuccess(res, data, 'Category updated');
    } catch (error) {
      next(error);
    }
  };

  patchProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchProduct(
        req.params.id as string,
        req.body as PatchProductInput,
      );
      sendSuccess(res, data, 'Product updated');
    } catch (error) {
      next(error);
    }
  };
}
