import { logger } from '../../common/logger/logger.js';
import { ProductsRepository } from '../products/products.repository.js';
import {
  createMeilisearchClient,
  type MeiliProductDocument,
  type MeilisearchClient,
} from './meilisearch.client.js';
import { SearchRepository } from './search.repository.js';

export class SearchIndexService {
  constructor(
    private readonly productsRepo = new ProductsRepository(),
    private readonly searchRepo = new SearchRepository(),
    private readonly meili: MeilisearchClient | null = createMeilisearchClient(),
  ) {}

  get enabled(): boolean {
    return Boolean(this.meili?.enabled);
  }

  private toDocument(row: {
    id: string;
    name: string;
    nameHi: string | null;
    brand: string | null;
    description: string | null;
    descriptionHi: string | null;
    categoryId: string;
    categoryName: string;
    isActive: boolean;
    storeIds: string[];
    aliases: string[];
  }): MeiliProductDocument {
    return {
      id: row.id,
      name: row.name,
      nameHi: row.nameHi ?? '',
      brand: row.brand ?? '',
      description: row.description ?? '',
      descriptionHi: row.descriptionHi ?? '',
      aliases: row.aliases,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      storeIds: row.storeIds,
      isActive: row.isActive,
    };
  }

  async reindexAll(): Promise<{ documentCount: number; synonymGroups: number }> {
    if (!this.meili) {
      throw new Error('Meilisearch is not configured (set MEILI_HOST)');
    }

    const rows = await this.productsRepo.listIndexDocuments();
    const documents = rows.map((row) => this.toDocument(row));
    await this.meili.replaceAllDocuments(documents);

    const synonymMap = await this.searchRepo.listAllSynonymMaps();
    await this.meili.updateSynonyms(synonymMap);

    logger.info('Meilisearch reindex complete', {
      documentCount: documents.length,
      synonymGroups: Object.keys(synonymMap).length,
    });

    return {
      documentCount: documents.length,
      synonymGroups: Object.keys(synonymMap).length,
    };
  }

  async upsertProduct(productId: string): Promise<void> {
    if (!this.meili) return;
    try {
      const rows = await this.productsRepo.listIndexDocuments({ productId });
      if (rows.length === 0) {
        await this.meili.deleteDocument(productId);
        return;
      }
      await this.meili.upsertDocuments([this.toDocument(rows[0]!)]);
    } catch (error) {
      logger.warn('Meilisearch product upsert failed', {
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async syncSynonyms(): Promise<void> {
    if (!this.meili) return;
    try {
      const synonymMap = await this.searchRepo.listAllSynonymMaps();
      await this.meili.updateSynonyms(synonymMap);
    } catch (error) {
      logger.warn('Meilisearch synonym sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async search(options: {
    q: string;
    storeId: string;
    categoryId?: string;
    limit: number;
    offset: number;
  }): Promise<{ ids: string[]; total: number } | null> {
    if (!this.meili) return null;
    try {
      const result = await this.meili.search(options);
      return {
        ids: result.hits.map((hit) => hit.id),
        total: result.estimatedTotalHits,
      };
    } catch (error) {
      logger.warn('Meilisearch search failed; falling back to MySQL', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
