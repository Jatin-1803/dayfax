import { Router } from 'express';
import { authenticate, requireRoles } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { CartController } from './cart.controller.js';
import { addCartItemSchema, updateCartItemSchema } from './cart.schema.js';

const controller = new CartController();
export const cartRouter = Router();

cartRouter.use(authenticate, requireRoles('CUSTOMER', 'ADMIN'));

cartRouter.get('/', controller.get);
cartRouter.delete('/', controller.clear);
cartRouter.post('/items', validateRequest(addCartItemSchema), controller.addItem);
cartRouter.patch('/items/:itemId', validateRequest(updateCartItemSchema), controller.updateItem);
cartRouter.delete('/items/:itemId', controller.removeItem);
