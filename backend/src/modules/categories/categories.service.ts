import { NotFoundError } from '../../common/errors/app-error.js';
import { CategoriesRepository } from './categories.repository.js';
import type { ListCategoriesQuery } from './categories.schema.js';

function mapCategory(row: {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon_key: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: number;
}) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    iconKey: row.icon_key,
    imageUrl: row.image_url,
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
    });
    return rows.map(mapCategory);
  }

  async getByIdOrSlug(idOrSlug: string) {
    const row = await this.repo.findByIdOrSlug(idOrSlug);
    if (!row || !row.is_active) {
      throw new NotFoundError('Category not found');
    }
    return mapCategory(row);
  }
}
