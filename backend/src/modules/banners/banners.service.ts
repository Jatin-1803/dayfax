import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import { pickLocalizedRequired } from '../../common/utils/localize.js';
import { toPublicAssetUrl } from '../../common/utils/public-url.js';
import type { AppLang } from '../i18n/i18n.schema.js';
import { BannersRepository, type HomeBannerRow } from './banners.repository.js';
import type { CreateBannerInput, PatchBannerInput } from './banners.schema.js';

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function mapBannerAdmin(row: HomeBannerRow) {
  return {
    id: row.id,
    title: row.title,
    titleHi: row.title_hi,
    imageUrl: row.image_url,
    linkPath: row.link_path,
    priority: Number(row.priority),
    isActive: Boolean(row.is_active),
    startAt: toDate(row.start_at).toISOString(),
    endAt: toDate(row.end_at).toISOString(),
    createdAt: toDate(row.created_at).toISOString(),
    updatedAt: toDate(row.updated_at).toISOString(),
  };
}

export function mapBannerPublic(row: HomeBannerRow, lang: AppLang) {
  return {
    id: row.id,
    title: pickLocalizedRequired(lang, row.title, row.title_hi),
    imageUrl: toPublicAssetUrl(row.image_url),
    linkPath: row.link_path,
    priority: Number(row.priority),
  };
}

export class BannersService {
  constructor(private readonly repo = new BannersRepository()) {}

  async listActive(lang: AppLang) {
    const rows = await this.repo.listActive();
    return rows.map((row) => mapBannerPublic(row, lang));
  }

  async listAdmin() {
    const rows = await this.repo.listAdmin();
    return rows.map(mapBannerAdmin);
  }

  async getAdmin(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError('Banner not found');
    return mapBannerAdmin(row);
  }

  async create(input: CreateBannerInput) {
    const id = await this.repo.insert(input);
    return this.getAdmin(id);
  }

  async patch(id: string, input: PatchBannerInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Banner not found');

    const startAt = input.startAt ?? toDate(existing.start_at);
    const endAt = input.endAt ?? toDate(existing.end_at);
    if (endAt.getTime() <= startAt.getTime()) {
      throw new ValidationError('End time must be after start time');
    }

    const updated = await this.repo.update(id, input);
    if (!updated) throw new NotFoundError('Banner not found');
    return this.getAdmin(id);
  }

  async remove(id: string) {
    const removed = await this.repo.softDelete(id);
    if (!removed) throw new NotFoundError('Banner not found');
  }
}
