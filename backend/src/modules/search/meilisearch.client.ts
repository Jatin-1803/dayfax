import { env } from '../../config/env.js';
import { logger } from '../../common/logger/logger.js';

export interface MeiliProductDocument {
  id: string;
  name: string;
  nameHi: string;
  brand: string;
  description: string;
  descriptionHi: string;
  aliases: string[];
  categoryId: string;
  categoryName: string;
  storeIds: string[];
  isActive: boolean;
}

export interface MeiliSearchHit {
  id: string;
}

export interface MeiliSearchResult {
  hits: MeiliSearchHit[];
  estimatedTotalHits: number;
}

function isMeiliConfigured(): boolean {
  return Boolean(env.MEILI_HOST?.trim());
}

export class MeilisearchClient {
  private readonly host: string;
  private readonly apiKey: string;
  private readonly indexUid: string;

  constructor() {
    this.host = (env.MEILI_HOST ?? '').replace(/\/$/, '');
    this.apiKey = env.MEILI_MASTER_KEY ?? '';
    this.indexUid = env.MEILI_INDEX_PRODUCTS;
  }

  get enabled(): boolean {
    return isMeiliConfigured();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.host}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Meilisearch ${method} ${path} failed: ${response.status} ${text}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  async ensureIndex(): Promise<void> {
    try {
      await this.request('GET', `/indexes/${this.indexUid}`);
    } catch {
      await this.request('POST', '/indexes', {
        uid: this.indexUid,
        primaryKey: 'id',
      });
    }

    await this.request('PATCH', `/indexes/${this.indexUid}/settings`, {
      searchableAttributes: ['name', 'nameHi', 'aliases', 'brand', 'description', 'descriptionHi'],
      filterableAttributes: ['storeIds', 'categoryId', 'isActive'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    });
  }

  async replaceAllDocuments(documents: MeiliProductDocument[]): Promise<void> {
    await this.ensureIndex();
    await this.request('DELETE', `/indexes/${this.indexUid}/documents`);
    if (documents.length === 0) return;
    await this.request('POST', `/indexes/${this.indexUid}/documents`, documents);
  }

  async upsertDocuments(documents: MeiliProductDocument[]): Promise<void> {
    if (documents.length === 0) return;
    await this.ensureIndex();
    await this.request('POST', `/indexes/${this.indexUid}/documents`, documents);
  }

  async deleteDocument(id: string): Promise<void> {
    await this.request('DELETE', `/indexes/${this.indexUid}/documents/${id}`);
  }

  async updateSynonyms(synonyms: Record<string, string[]>): Promise<void> {
    await this.ensureIndex();
    await this.request('PUT', `/indexes/${this.indexUid}/settings/synonyms`, synonyms);
  }

  async search(options: {
    q: string;
    storeId: string;
    categoryId?: string;
    limit: number;
    offset: number;
  }): Promise<MeiliSearchResult> {
    const filters = [`storeIds = "${options.storeId}"`, 'isActive = true'];
    if (options.categoryId) {
      filters.push(`categoryId = "${options.categoryId}"`);
    }

    const result = await this.request<{
      hits: Array<{ id: string }>;
      estimatedTotalHits?: number;
      totalHits?: number;
    }>('POST', `/indexes/${this.indexUid}/search`, {
      q: options.q,
      filter: filters.join(' AND '),
      limit: options.limit,
      offset: options.offset,
      attributesToRetrieve: ['id'],
    });

    return {
      hits: result.hits.map((hit) => ({ id: hit.id })),
      estimatedTotalHits: result.estimatedTotalHits ?? result.totalHits ?? result.hits.length,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      await this.request<{ status: string }>('GET', '/health');
      return true;
    } catch (error) {
      logger.warn('Meilisearch health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

export function createMeilisearchClient(): MeilisearchClient | null {
  if (!isMeiliConfigured()) return null;
  return new MeilisearchClient();
}
