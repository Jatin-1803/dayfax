import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AddressesService } from './addresses.service.js';
import type { CreateAddressInput, UpdateAddressInput } from './addresses.schema.js';

export class AddressesController {
  constructor(private readonly service = new AddressesService()) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.list(req.user!.id);
      sendSuccess(res, data, 'Addresses fetched');
    } catch (error) {
      next(error);
    }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getById(req.user!.id, req.params.id as string);
      sendSuccess(res, data, 'Address fetched');
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.create(req.user!.id, req.body as CreateAddressInput);
      sendSuccess(res, data, 'Address created', 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.update(
        req.user!.id,
        req.params.id as string,
        req.body as UpdateAddressInput,
      );
      sendSuccess(res, data, 'Address updated');
    } catch (error) {
      next(error);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.remove(req.user!.id, req.params.id as string);
      sendSuccess(res, data, 'Address deleted');
    } catch (error) {
      next(error);
    }
  };

  setDefault = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.setDefault(req.user!.id, req.params.id as string);
      sendSuccess(res, data, 'Default address updated');
    } catch (error) {
      next(error);
    }
  };
}
