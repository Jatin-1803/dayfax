import { Router } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { AddressesController } from './addresses.controller.js';
import { createAddressSchema, updateAddressSchema } from './addresses.schema.js';

const controller = new AddressesController();
export const addressesRouter = Router();

addressesRouter.use(authenticate, requireRoles('CUSTOMER', 'ADMIN'));

addressesRouter.get('/', controller.list);
addressesRouter.post('/', validateRequest(createAddressSchema), controller.create);
addressesRouter.get('/:id', controller.getOne);
addressesRouter.patch('/:id', validateRequest(updateAddressSchema), controller.update);
addressesRouter.delete('/:id', controller.remove);
addressesRouter.post('/:id/default', controller.setDefault);
