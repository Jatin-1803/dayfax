import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { AdminZonesService } from './admin-zones.service.js';
import type {
  CreateDeliveryZoneInput,
  CreateFeeSlabInput,
  CreateLocationInput,
  CreateServiceAreaInput,
  PatchDeliveryZoneInput,
  PatchFeeSlabInput,
  PatchLocationInput,
  PatchServiceAreaInput,
} from './admin-zones.schema.js';

export class AdminZonesController {
  constructor(private readonly service = new AdminZonesService()) {}

  listLocations = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listLocations(), 'Locations loaded');
    } catch (error) {
      next(error);
    }
  };

  createLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createLocation(req.body as CreateLocationInput);
      sendSuccess(res, data, 'Location created', 201);
    } catch (error) {
      next(error);
    }
  };

  patchLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchLocation(
        req.params.id as string,
        req.body as PatchLocationInput,
      );
      sendSuccess(res, data, 'Location updated');
    } catch (error) {
      next(error);
    }
  };

  listServiceAreas = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listServiceAreas(), 'Service areas loaded');
    } catch (error) {
      next(error);
    }
  };

  createServiceArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createServiceArea(req.body as CreateServiceAreaInput);
      sendSuccess(res, data, 'Service area created', 201);
    } catch (error) {
      next(error);
    }
  };

  patchServiceArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchServiceArea(
        req.params.id as string,
        req.body as PatchServiceAreaInput,
      );
      sendSuccess(res, data, 'Service area updated');
    } catch (error) {
      next(error);
    }
  };

  listDeliveryZones = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.listDeliveryZones(), 'Delivery zones loaded');
    } catch (error) {
      next(error);
    }
  };

  createDeliveryZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createDeliveryZone(req.body as CreateDeliveryZoneInput);
      sendSuccess(res, data, 'Delivery zone created', 201);
    } catch (error) {
      next(error);
    }
  };

  patchDeliveryZone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchDeliveryZone(
        req.params.id as string,
        req.body as PatchDeliveryZoneInput,
      );
      sendSuccess(res, data, 'Delivery zone updated');
    } catch (error) {
      next(error);
    }
  };

  listFeeSlabs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.listFeeSlabs(req.params.id as string),
        'Fee slabs loaded',
      );
    } catch (error) {
      next(error);
    }
  };

  createFeeSlab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.createFeeSlab(
        req.params.id as string,
        req.body as CreateFeeSlabInput,
      );
      sendSuccess(res, data, 'Fee slab created', 201);
    } catch (error) {
      next(error);
    }
  };

  patchFeeSlab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.patchFeeSlab(
        req.params.zoneId as string,
        req.params.slabId as string,
        req.body as PatchFeeSlabInput,
      );
      sendSuccess(res, data, 'Fee slab updated');
    } catch (error) {
      next(error);
    }
  };

  deleteFeeSlab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteFeeSlab(
        req.params.zoneId as string,
        req.params.slabId as string,
      );
      sendSuccess(res, null, 'Fee slab deleted');
    } catch (error) {
      next(error);
    }
  };
}
