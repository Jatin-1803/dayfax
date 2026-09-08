import { ConflictError, NotFoundError } from '../../common/errors/app-error.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { I18nRepository } from './i18n.repository.js';
import type {
  AppLang,
  CreateUiStringInput,
  ListUiStringsQuery,
  UpdateUiStringInput,
} from './i18n.schema.js';

type BundlePayload = {
  version: number;
  lang: AppLang;
  strings: Record<string, string>;
};

/** Short in-process cache — safe for single Node instance; invalidated on admin writes. */
const bundleCache = new Map<AppLang, { expiresAt: number; payload: BundlePayload }>();
const BUNDLE_TTL_MS = 60_000;

export class I18nService {
  constructor(private readonly repo = new I18nRepository()) {}

  async getBundle(lang: AppLang) {
    const cached = bundleCache.get(lang);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const [version, strings] = await Promise.all([
      this.repo.getVersion(),
      this.repo.getBundle(lang),
    ]);
    const payload: BundlePayload = { version, lang, strings };
    bundleCache.set(lang, { expiresAt: Date.now() + BUNDLE_TTL_MS, payload });
    return payload;
  }

  private invalidateBundleCache(): void {
    bundleCache.clear();
  }

  async listAdmin(query: ListUiStringsQuery) {
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 50, maxLimit: 200 },
    );
    const { rows, total } = await this.repo.list({ limit, offset, q: query.q });
    const version = await this.repo.getVersion();
    return {
      version,
      items: rows.map((row) => ({
        key: row.string_key,
        en: row.en_value,
        hi: row.hi_value,
        updatedAt: row.updated_at,
      })),
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async create(input: CreateUiStringInput) {
    const existing = await this.repo.findByKey(input.key);
    if (existing) {
      throw new ConflictError('Translation key already exists');
    }
    await this.repo.create({ key: input.key, en: input.en, hi: input.hi });
    const version = await this.repo.bumpVersion();
    this.invalidateBundleCache();
    return {
      version,
      item: { key: input.key, en: input.en, hi: input.hi },
    };
  }

  async update(key: string, input: UpdateUiStringInput) {
    const existing = await this.repo.findByKey(key);
    if (!existing) {
      throw new NotFoundError('Translation key not found');
    }
    await this.repo.update(key, input);
    const version = await this.repo.bumpVersion();
    const updated = await this.repo.findByKey(key);
    this.invalidateBundleCache();
    return {
      version,
      item: {
        key: updated!.string_key,
        en: updated!.en_value,
        hi: updated!.hi_value,
        updatedAt: updated!.updated_at,
      },
    };
  }

  async remove(key: string) {
    const deleted = await this.repo.delete(key);
    if (!deleted) {
      throw new NotFoundError('Translation key not found');
    }
    const version = await this.repo.bumpVersion();
    this.invalidateBundleCache();
    return { version, key };
  }
}
