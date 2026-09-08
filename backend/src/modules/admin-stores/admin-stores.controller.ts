import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminStoresService } from './admin-stores.service.js';
import type {
  CreateAdminProductInput,
  CreateStoreInput,
  PatchStoreInput,
  PatchStoreProductInput,
} from './admin-stores.schema.js';

export class AdminStoresController {
  constructor(private readonly service = new AdminStoresService()) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list();
      sendSuccess(res, data, 'Stores fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getOne(req.params.id as string);
      sendSuccess(res, data, 'Store fetched');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.create(req.body as CreateStoreInput);
      sendSuccess(res, data, 'Store created', 201);
    } catch (error) {
      next(error);
    }
  };

  patch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patch(req.params.id as string, req.body as PatchStoreInput);
      sendSuccess(res, data, 'Store updated');
    } catch (error) {
      next(error);
    }
  };

  listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.listProducts(req.params.id as string);
      sendSuccess(res, data, 'Store products fetched');
    } catch (error) {
      next(error);
    }
  };

  patchStoreProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchStoreProduct(
        req.params.id as string,
        req.params.productId as string,
        req.body as PatchStoreProductInput,
      );
      sendSuccess(res, data, 'Store product updated');
    } catch (error) {
      next(error);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createProduct(req.body as CreateAdminProductInput);
      sendSuccess(res, data, 'Product created', 201);
    } catch (error) {
      next(error);
    }
  };
}
