import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { I18nController } from './i18n.controller.js';
import {
  createUiStringSchema,
  i18nBundleQuerySchema,
  listUiStringsQuerySchema,
  updateUiStringSchema,
  uiStringKeyParamsSchema,
} from './i18n.schema.js';

const controller = new I18nController();

/** Public versioned UI string bundle (cached by clients). */
export const i18nPublicRouter = Router();
i18nPublicRouter.get(
  '/bundle',
  validateRequest(i18nBundleQuerySchema, 'query'),
  controller.getBundle,
);

/** ADMIN CRUD for UI translations. */
export const i18nAdminRouter = Router();
i18nAdminRouter.use(authenticate, requireAdminPrincipal());

i18nAdminRouter.get(
  '/strings',
  validateRequest(listUiStringsQuerySchema, 'query'),
  controller.listAdmin,
);
i18nAdminRouter.post(
  '/strings',
  validateRequest(createUiStringSchema),
  controller.create,
);
i18nAdminRouter.put(
  '/strings/:key',
  validateRequest(uiStringKeyParamsSchema, 'params'),
  validateRequest(updateUiStringSchema),
  controller.update,
);
i18nAdminRouter.delete(
  '/strings/:key',
  validateRequest(uiStringKeyParamsSchema, 'params'),
  controller.remove,
);
