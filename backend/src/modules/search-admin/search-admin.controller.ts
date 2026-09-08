import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../common/utils/api-response.js';
import { SearchAdminService } from './search-admin.service.js';
import type {
  AddSynonymTermInput,
  CreateSynonymGroupInput,
  PutProductAliasesInput,
  UpdateSynonymGroupInput,
  ZeroResultsQuery,
} from './search-admin.schema.js';

export class SearchAdminController {
  constructor(private readonly service = new SearchAdminService()) {}

  listSynonymGroups = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.listSynonymGroups();
      sendSuccess(res, data, 'Synonym groups fetched');
    } catch (error) {
      next(error);
    }
  };

  createSynonymGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.createSynonymGroup(req.body as CreateSynonymGroupInput);
      sendSuccess(res, data, 'Synonym group created', 201);
    } catch (error) {
      next(error);
    }
  };

  updateSynonymGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.updateSynonymGroup(
        req.params.id as string,
        req.body as UpdateSynonymGroupInput,
      );
      sendSuccess(res, data, 'Synonym group updated');
    } catch (error) {
      next(error);
    }
  };

  deleteSynonymGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.deleteSynonymGroup(req.params.id as string);
      sendSuccess(res, data, 'Synonym group deleted');
    } catch (error) {
      next(error);
    }
  };

  addTerm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.addTerm(
        req.params.id as string,
        req.body as AddSynonymTermInput,
      );
      sendSuccess(res, data, 'Synonym term added', 201);
    } catch (error) {
      next(error);
    }
  };

  deleteTerm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.deleteTerm(
        req.params.id as string,
        req.params.termId as string,
      );
      sendSuccess(res, data, 'Synonym term deleted');
    } catch (error) {
      next(error);
    }
  };

  getProductAliases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getProductAliases(req.params.id as string);
      sendSuccess(res, data, 'Product aliases fetched');
    } catch (error) {
      next(error);
    }
  };

  putProductAliases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.putProductAliases(
        req.params.id as string,
        req.body as PutProductAliasesInput,
      );
      sendSuccess(res, data, 'Product aliases updated');
    } catch (error) {
      next(error);
    }
  };

  listZeroResults = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.listZeroResults(req.query as unknown as ZeroResultsQuery);
      sendSuccess(res, data, 'Zero-result queries fetched');
    } catch (error) {
      next(error);
    }
  };

  reindex = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.reindex();
      sendSuccess(res, data, 'Search index rebuilt');
    } catch (error) {
      next(error);
    }
  };

  status = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.searchStatus();
      sendSuccess(res, data, 'Search status fetched');
    } catch (error) {
      next(error);
    }
  };
}
