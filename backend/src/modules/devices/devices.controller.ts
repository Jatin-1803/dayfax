import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { DevicesService } from './devices.service.js';
import type { RegisterDeviceInput, UnregisterDeviceInput } from './devices.schema.js';

export class DevicesController {
  constructor(private readonly service = new DevicesService()) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.register(req.user!.id, req.user!.roles, req.body as RegisterDeviceInput);
      sendSuccess(res, { registered: true }, 'Device registered');
    } catch (error) {
      next(error);
    }
  };

  unregister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.unregister(req.user!.id, req.body as UnregisterDeviceInput);
      sendSuccess(res, { registered: false }, 'Device unregistered');
    } catch (error) {
      next(error);
    }
  };
}
