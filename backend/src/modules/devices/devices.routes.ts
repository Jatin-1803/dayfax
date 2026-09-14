import { Router } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { DevicesController } from './devices.controller.js';
import { registerDeviceSchema, unregisterDeviceSchema } from './devices.schema.js';

const controller = new DevicesController();
export const devicesRouter = Router();

devicesRouter.use(authenticate, requireRoles('CUSTOMER', 'DELIVERY_PARTNER'));

devicesRouter.post('/', validateRequest(registerDeviceSchema), controller.register);
devicesRouter.delete('/', validateRequest(unregisterDeviceSchema), controller.unregister);
