import { Router } from 'express';
import { authenticate, requireAdminPrincipal } from '../../common/middleware/auth.js';
import { validateRequest } from '../../common/middleware/validate.js';
import { SearchAdminController } from './search-admin.controller.js';
import {
  addSynonymTermSchema,
  createSynonymGroupSchema,
  productIdParamsSchema,
  putProductAliasesSchema,
  synonymGroupIdParamsSchema,
  synonymTermParamsSchema,
  updateSynonymGroupSchema,
  zeroResultsQuerySchema,
} from './search-admin.schema.js';

const controller = new SearchAdminController();
export const searchAdminRouter = Router();

searchAdminRouter.use(authenticate, requireAdminPrincipal());

searchAdminRouter.get('/status', controller.status);
searchAdminRouter.post('/reindex', controller.reindex);
searchAdminRouter.get(
  '/zero-results',
  validateRequest(zeroResultsQuerySchema, 'query'),
  controller.listZeroResults,
);

searchAdminRouter.get('/synonym-groups', controller.listSynonymGroups);
searchAdminRouter.post(
  '/synonym-groups',
  validateRequest(createSynonymGroupSchema),
  controller.createSynonymGroup,
);
searchAdminRouter.patch(
  '/synonym-groups/:id',
  validateRequest(synonymGroupIdParamsSchema, 'params'),
  validateRequest(updateSynonymGroupSchema),
  controller.updateSynonymGroup,
);
searchAdminRouter.delete(
  '/synonym-groups/:id',
  validateRequest(synonymGroupIdParamsSchema, 'params'),
  controller.deleteSynonymGroup,
);
searchAdminRouter.post(
  '/synonym-groups/:id/terms',
  validateRequest(synonymGroupIdParamsSchema, 'params'),
  validateRequest(addSynonymTermSchema),
  controller.addTerm,
);
searchAdminRouter.delete(
  '/synonym-groups/:id/terms/:termId',
  validateRequest(synonymTermParamsSchema, 'params'),
  controller.deleteTerm,
);

export const adminProductSearchRouter = Router();
adminProductSearchRouter.use(authenticate, requireAdminPrincipal());

adminProductSearchRouter.get(
  '/:id/search-aliases',
  validateRequest(productIdParamsSchema, 'params'),
  controller.getProductAliases,
);
adminProductSearchRouter.put(
  '/:id/search-aliases',
  validateRequest(productIdParamsSchema, 'params'),
  validateRequest(putProductAliasesSchema),
  controller.putProductAliases,
);
