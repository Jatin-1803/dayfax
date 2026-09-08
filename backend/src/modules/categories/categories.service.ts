import { NotFoundError } from '../../common/errors/app-error.js';
import { pickLocalizedRequired } from '../../common/utils/localize.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import { CategoriesRepository } from './categories.repository.js';
import type { GetCategoryQuery, ListCategoriesQuery } from './categories.schema.js';
import type { AppLang } from '../i18n/i18n.schema.js';

function mapCategory(
  row: {
    id: string;
    parent_id: string | null;
    name: string;
    name_hi: string | null;
    slug: string;
    icon_key: string | null;
    image_url: string | null;
    sort_order: number;
    is_active: number;
  },
  lang: AppLang,
) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: pickLocalizedRequired(lang, row.name, row.name_hi),
    slug: row.slug,
    iconKey: row.icon_key,
    imageUrl: toPublicAssetUrl(row.image_url),
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
  };
}

export class CategoriesService {
  constructor(private readonly repo = new CategoriesRepository()) {}

  async list(query: ListCategoriesQuery) {
    const rows = await this.repo.list({
      parentId: query.parentId,
      includeInactive: query.includeInactive,
      includeChildren: query.includeChildren,
    });
    return rows.map((row) => mapCategory(row, query.lang));
  }

  async getByIdOrSlug(idOrSlug: string, query: GetCategoryQuery) {
    const row = await this.repo.findByIdOrSlug(idOrSlug);
    if (!row || !row.is_active) {
      throw new NotFoundError('Category not found');
    }
    return mapCategory(row, query.lang);
  }
}
