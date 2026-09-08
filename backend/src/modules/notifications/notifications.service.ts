import { NotFoundError } from '../../common/errors/app-error.js';
import { paginatedMeta, parsePagination } from '../../common/utils/pagination.js';
import { NotificationsRepository } from './notifications.repository.js';
import type { NotificationRow } from './notifications.repository.js';
import type { ListNotificationsQuery } from './notifications.schema.js';

function parseMeta(meta: NotificationRow['meta_json']): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta === 'object') return meta as Record<string, unknown>;
  try {
    return JSON.parse(meta) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    channel: row.channel,
    isRead: Boolean(row.is_read),
    meta: parseMeta(row.meta_json),
    createdAt: row.created_at,
  };
}

export class NotificationsService {
  constructor(private readonly repo = new NotificationsRepository()) {}

  async list(userId: string, query: ListNotificationsQuery) {
    const unreadOnly = query.unreadOnly === true;
    const { page, limit, offset } = parsePagination(
      { page: query.page, limit: query.limit },
      { limit: 20, maxLimit: 50 },
    );
    const [total, unreadCount, rows] = await Promise.all([
      this.repo.countByUser(userId, unreadOnly),
      this.repo.countByUser(userId, true),
      this.repo.listByUser(userId, limit, offset, unreadOnly),
    ]);

    return {
      items: rows.map(mapNotification),
      unreadCount,
      pagination: paginatedMeta(total, page, limit),
    };
  }

  async unreadCount(userId: string) {
    const unreadCount = await this.repo.countByUser(userId, true);
    return { unreadCount };
  }

  async markRead(userId: string, id: string) {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Notification not found');
    await this.repo.markRead(id, userId);
    const updated = await this.repo.findByIdForUser(id, userId);
    return mapNotification(updated!);
  }

  async markAllRead(userId: string) {
    const updated = await this.repo.markAllRead(userId);
    const unreadCount = await this.repo.countByUser(userId, true);
    return { updated, unreadCount };
  }

  async createForUser(
    userId: string,
    input: {
      title: string;
      body: string;
      channel?: 'PUSH' | 'SMS' | 'IN_APP';
      meta?: Record<string, unknown> | null;
    },
  ) {
    const id = await this.repo.create({ userId, ...input });
    const row = await this.repo.findByIdForUser(id, userId);
    return mapNotification(row!);
  }
}
