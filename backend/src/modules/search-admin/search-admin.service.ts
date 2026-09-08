import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/app-error.js';
import { normalizeSearchTerm } from '../../common/utils/search-normalize.js';
import { SearchIndexService } from '../search/search-index.service.js';
import { SearchRepository } from '../search/search.repository.js';
import { SearchAdminRepository } from './search-admin.repository.js';
import type {
  AddSynonymTermInput,
  CreateSynonymGroupInput,
  PutProductAliasesInput,
  UpdateSynonymGroupInput,
  ZeroResultsQuery,
} from './search-admin.schema.js';

export class SearchAdminService {
  constructor(
    private readonly repo = new SearchAdminRepository(),
    private readonly searchRepo = new SearchRepository(),
    private readonly searchIndex = new SearchIndexService(),
  ) {}

  async listSynonymGroups() {
    return this.repo.listSynonymGroups();
  }

  async createSynonymGroup(input: CreateSynonymGroupInput) {
    const canonical = normalizeSearchTerm(input.canonicalTerm);
    if (!canonical) {
      throw new ValidationError('canonicalTerm is required');
    }

    const existing = await this.repo.findTermByValue(canonical);
    if (existing) {
      throw new ConflictError(`Term "${canonical}" already exists in another group`);
    }

    for (const term of input.terms ?? []) {
      const normalized = normalizeSearchTerm(term);
      if (!normalized) continue;
      const clash = await this.repo.findTermByValue(normalized);
      if (clash) {
        throw new ConflictError(`Term "${normalized}" already exists in another group`);
      }
    }

    const id = await this.repo.createSynonymGroup({
      canonicalTerm: canonical,
      terms: input.terms ?? [],
      isActive: input.isActive ?? true,
    });

    void this.searchIndex.syncSynonyms();
    return this.repo.findSynonymGroup(id);
  }

  async updateSynonymGroup(id: string, input: UpdateSynonymGroupInput) {
    const group = await this.repo.findSynonymGroup(id);
    if (!group) throw new NotFoundError('Synonym group not found');

    if (input.canonicalTerm !== undefined) {
      const canonical = normalizeSearchTerm(input.canonicalTerm);
      if (!canonical) throw new ValidationError('canonicalTerm is required');
      const clash = await this.repo.findTermByValue(canonical);
      if (clash && clash.groupId !== id) {
        throw new ConflictError(`Term "${canonical}" already exists in another group`);
      }
    }

    await this.repo.updateSynonymGroup(id, input);
    void this.searchIndex.syncSynonyms();
    return this.repo.findSynonymGroup(id);
  }

  async deleteSynonymGroup(id: string) {
    const ok = await this.repo.deleteSynonymGroup(id);
    if (!ok) throw new NotFoundError('Synonym group not found');
    void this.searchIndex.syncSynonyms();
    return { id, deleted: true };
  }

  async addTerm(groupId: string, input: AddSynonymTermInput) {
    const group = await this.repo.findSynonymGroup(groupId);
    if (!group) throw new NotFoundError('Synonym group not found');

    const term = normalizeSearchTerm(input.term);
    if (!term) throw new ValidationError('term is required');

    const clash = await this.repo.findTermByValue(term);
    if (clash) {
      throw new ConflictError(`Term "${term}" already exists in another group`);
    }

    const termId = await this.repo.addTerm(groupId, term);
    void this.searchIndex.syncSynonyms();
    return { id: termId, term, groupId };
  }

  async deleteTerm(groupId: string, termId: string) {
    const group = await this.repo.findSynonymGroup(groupId);
    if (!group) throw new NotFoundError('Synonym group not found');

    const ok = await this.repo.deleteTerm(groupId, termId);
    if (!ok) throw new NotFoundError('Synonym term not found');
    void this.searchIndex.syncSynonyms();
    return { id: termId, deleted: true };
  }

  async getProductAliases(productId: string) {
    const exists = await this.repo.productExists(productId);
    if (!exists) throw new NotFoundError('Product not found');
    const aliases = await this.repo.listProductAliases(productId);
    return { productId, aliases };
  }

  async putProductAliases(productId: string, input: PutProductAliasesInput) {
    const exists = await this.repo.productExists(productId);
    if (!exists) throw new NotFoundError('Product not found');
    const aliases = await this.repo.replaceProductAliases(productId, input.aliases);
    void this.searchIndex.upsertProduct(productId);
    return { productId, aliases };
  }

  async listZeroResults(query: ZeroResultsQuery) {
    return this.searchRepo.listZeroResultQueries({
      limit: query.limit ?? 50,
      days: query.days ?? 14,
    });
  }

  async reindex() {
    if (!this.searchIndex.enabled) {
      throw new ValidationError(
        'Meilisearch is not configured. Set MEILI_HOST (and MEILI_MASTER_KEY) then retry.',
      );
    }
    const result = await this.searchIndex.reindexAll();
    return {
      ...result,
      meilisearchEnabled: true,
    };
  }

  async searchStatus() {
    return {
      meilisearchEnabled: this.searchIndex.enabled,
      synonymGroups: (await this.repo.listSynonymGroups()).length,
    };
  }
}
