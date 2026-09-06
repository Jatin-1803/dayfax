import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { CartService } from './cart.service.js';
import type { AddCartItemInput, UpdateCartItemInput } from './cart.schema.js';

export class CartController {
  constructor(private readonly service = new CartService()) {}

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getCart(req.user!.id);
      sendSuccess(res, data, 'Cart fetched');
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.addItem(req.user!.id, req.body as AddCartItemInput);
      sendSuccess(res, data, 'Item added to cart');
    } catch (error) {
      next(error);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.updateItem(
        req.user!.id,
        req.params.itemId as string,
        req.body as UpdateCartItemInput,
      );
      sendSuccess(res, data, 'Cart item updated');
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.removeItem(req.user!.id, req.params.itemId as string);
      sendSuccess(res, data, 'Cart item removed');
    } catch (error) {
      next(error);
    }
  };

  clear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.clear(req.user!.id);
      sendSuccess(res, data, 'Cart cleared');
    } catch (error) {
      next(error);
    }
  };
}
