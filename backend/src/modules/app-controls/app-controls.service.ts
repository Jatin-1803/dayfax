import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env.js';
import { writeAudit } from '../../common/audit/audit-log.js';
import { isInRollout } from '../../common/app-controls/rollout.js';
import { isBelowMinimum, isUpdateAvailable, versionInRange } from '../../common/app-controls/version.js';
import { clearSettingsCache } from '../../common/config/session-policy.js';
import { getPool } from '../../common/database/pool.js';
import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';
import type { ClientContext } from '../../common/http/client-context.js';
import { createId } from '../../common/utils/id.js';
import { clearControlCache } from './control-state.js';

const POLICY_CACHE_MS = 15_000;
let releaseCache: { at: number; byPlatform: Map<string, RowDataPacket | null> } | null = null;

interface MaintenanceState {
  enabled: boolean;
  title: string;
  message: string;
  expectedEndAt: unknown;
  allowAdmin: boolean;
  imageUrl: string | null;
  allowUserIds: string[];
}

let maintenanceCache: { at: number; value: MaintenanceState } | null = null;

const FLAG_KEYS = [
  'new_checkout',
  'new_home',
  'referral_system',
  'wallet',
  'new_search',
  'product_reviews',
  'order_tracking_v2',
  'subscription',
  'loyalty_program',
  'seasonal_theme',
  'new_banner_system',
] as const;

export { FLAG_KEYS };

function bool(value: unknown): boolean {
  return value === 1 || value === true;
}

export class AppControlsService {
  async bootstrap(client: ClientContext, userId?: string) {
    const platform = client.platform ?? 'ANDROID';
    const [release, maintenance, announcements, flags, settings] = await Promise.all([
      this.activeRelease(platform),
      this.maintenance(),
      this.activeAnnouncements(platform, client.appVersion),
      this.evaluateFlags(client, userId),
      this.publicSettings(),
    ]);

    const installedBuild = client.appBuild;
    const installedVersion = client.appVersion;
    const updateRequired = release
      ? isBelowMinimum({
          installedVersion,
          installedBuild,
          minVersion: release.min_version,
          minBuild: release.min_build,
        }) && this.forceReady(release)
      : false;
    const updateAvailable = release
      ? isUpdateAvailable({
          installedVersion,
          installedBuild,
          latestVersion: release.version,
          latestBuild: release.build_number,
        })
      : false;

    return {
      updateRequired,
      updateAvailable: updateAvailable && !updateRequired,
      latestVersion: release?.version ?? null,
      minimumVersion: release?.min_version ?? null,
      latestBuild: release?.build_number ?? null,
      minimumBuild: release?.min_build ?? null,
      storeUrl: release?.store_url ?? null,
      title: release?.title ?? null,
      message: release?.message ?? null,
      forceUpdate: updateRequired,
      maintenance: {
        enabled: maintenance.enabled,
        title: maintenance.title,
        message: maintenance.message,
        expectedEndAt: maintenance.expectedEndAt,
        imageUrl: maintenance.imageUrl,
      },
      announcements,
      featureFlags: flags,
      config: settings,
    };
  }

  async versionPolicy(platform: 'ANDROID' | 'IOS', client: ClientContext) {
    const release = await this.activeRelease(platform);
    if (!release) {
      return {
        updateRequired: false,
        updateAvailable: false,
        latestVersion: null,
        minimumVersion: null,
        storeUrl: null,
        title: null,
        message: null,
      };
    }
    const updateRequired =
      isBelowMinimum({
        installedVersion: client.appVersion,
        installedBuild: client.appBuild,
        minVersion: release.min_version,
        minBuild: release.min_build,
      }) && this.forceReady(release);
    return {
      updateRequired,
      updateAvailable:
        !updateRequired &&
        isUpdateAvailable({
          installedVersion: client.appVersion,
          installedBuild: client.appBuild,
          latestVersion: release.version,
          latestBuild: release.build_number,
        }),
      latestVersion: release.version,
      minimumVersion: release.min_version,
      storeUrl: release.store_url,
      title: release.title,
      message: release.message,
    };
  }

  async isUnsupported(client: ClientContext): Promise<boolean> {
    if (!client.platform || client.appBuild == null) return false;
    const release = await this.activeRelease(client.platform);
    if (!release || !this.forceReady(release)) return false;
    return isBelowMinimum({
      installedVersion: client.appVersion,
      installedBuild: client.appBuild,
      minVersion: release.min_version,
      minBuild: release.min_build,
    });
  }

  async maintenanceFor(userId?: string) {
    const state = await this.maintenance();
    if (!state.enabled) return { ...state, blocked: false };
    if (userId && state.allowUserIds.includes(userId)) return { ...state, blocked: false };
    return { ...state, blocked: true };
  }

  async listReleases() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, platform, version, build_number, min_version, min_build, store_url,
              title, message, force_update, enforce_at, release_notes, is_active,
              created_by, updated_by, created_at, updated_at
       FROM app_releases
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return rows.map(mapRelease);
  }

  async createRelease(adminId: string, input: ReleaseInput, requestId?: string) {
    this.assertVersion(input.version);
    this.assertVersion(input.minVersion);
    const id = createId();
    if (input.isActive) {
      await getPool().execute(
        `UPDATE app_releases SET is_active = 0 WHERE platform = ?`,
        [input.platform],
      );
    }
    await getPool().execute(
      `INSERT INTO app_releases (
         id, platform, version, build_number, min_version, min_build, store_url,
         title, message, force_update, enforce_at, release_notes, is_active, created_by, updated_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.platform,
        input.version,
        input.buildNumber,
        input.minVersion,
        input.minBuild,
        input.storeUrl ?? null,
        input.title,
        input.message,
        input.forceUpdate ? 1 : 0,
        input.enforceAt ?? null,
        input.releaseNotes ?? null,
        input.isActive ? 1 : 0,
        adminId,
        adminId,
      ],
    );
    releaseCache = null;
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'APP_VERSION_UPDATED',
      module: 'version_control',
      entityType: 'app_release',
      entityId: id,
      newValue: input,
      reason: input.reason ?? 'publish',
      requestId,
    });
    return this.listReleases();
  }

  async activateRelease(adminId: string, id: string, reason: string, requestId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, platform FROM app_releases WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new ValidationError('Release not found');
    await getPool().execute(`UPDATE app_releases SET is_active = 0 WHERE platform = ?`, [
      rows[0].platform,
    ]);
    await getPool().execute(
      `UPDATE app_releases SET is_active = 1, updated_by = ? WHERE id = ?`,
      [adminId, id],
    );
    releaseCache = null;
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'APP_VERSION_UPDATED',
      module: 'version_control',
      entityType: 'app_release',
      entityId: id,
      reason,
      newValue: { isActive: true },
      requestId,
    });
    return this.listReleases();
  }

  async listFlags() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, flag_key, name, description, enabled, platform, min_version, max_version,
              rollout_percentage, starts_at, ends_at, environment, created_by, updated_by,
              created_at, updated_at
       FROM feature_flags
       ORDER BY flag_key ASC`,
    );
    return rows.map(mapFlag);
  }

  async saveFlag(adminId: string, input: FlagInput, id?: string, requestId?: string) {
    const existing = id
      ? await this.flagById(id)
      : await this.flagByKey(input.flagKey);
    const flagId = existing?.id ?? createId();
    if (existing) {
      await getPool().execute(
        `UPDATE feature_flags
         SET name = ?, description = ?, enabled = ?, platform = ?, min_version = ?, max_version = ?,
             rollout_percentage = ?, starts_at = ?, ends_at = ?, environment = ?, updated_by = ?
         WHERE id = ?`,
        [
          input.name,
          input.description ?? null,
          input.enabled ? 1 : 0,
          input.platform,
          input.minVersion ?? null,
          input.maxVersion ?? null,
          input.rolloutPercentage,
          input.startsAt ?? null,
          input.endsAt ?? null,
          input.environment,
          adminId,
          flagId,
        ],
      );
    } else {
      await getPool().execute(
        `INSERT INTO feature_flags (
           id, flag_key, name, description, enabled, platform, min_version, max_version,
           rollout_percentage, starts_at, ends_at, environment, created_by, updated_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          flagId,
          input.flagKey,
          input.name,
          input.description ?? null,
          input.enabled ? 1 : 0,
          input.platform,
          input.minVersion ?? null,
          input.maxVersion ?? null,
          input.rolloutPercentage,
          input.startsAt ?? null,
          input.endsAt ?? null,
          input.environment,
          adminId,
          adminId,
        ],
      );
    }
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'FEATURE_FLAG_CHANGED',
      module: 'feature_flags',
      entityType: 'feature_flag',
      entityId: flagId,
      oldValue: existing,
      newValue: input,
      reason: input.reason ?? null,
      requestId,
    });
    return this.listFlags();
  }

  async listSettings() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT setting_key, value_text, value_type, updated_by, updated_at
       FROM app_settings
       ORDER BY setting_key ASC`,
    );
    return rows.map((row) => ({
      key: row.setting_key,
      value: row.value_text,
      type: row.value_type,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    }));
  }

  async updateSetting(adminId: string, key: string, value: string, reason: string, requestId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT setting_key, value_text, value_type FROM app_settings WHERE setting_key = ?`,
      [key],
    );
    if (!rows[0]) throw new ValidationError('Unknown setting');
    if (rows[0].value_type === 'int' && !/^\d+$/.test(value)) {
      throw new ValidationError('Value must be a whole number');
    }
    if (rows[0].value_type === 'bool' && value !== 'true' && value !== 'false') {
      throw new ValidationError('Value must be true or false');
    }
    await getPool().execute(
      `UPDATE app_settings SET value_text = ?, updated_by = ? WHERE setting_key = ?`,
      [value, adminId, key],
    );
    clearSettingsCache();
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'APP_CONFIG_CHANGED',
      module: 'app_config',
      entityType: 'app_setting',
      entityId: key,
      oldValue: { value: rows[0].value_text },
      newValue: { value },
      reason,
      requestId,
    });
    return this.listSettings();
  }

  async listControls() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT code, is_enabled, reason, changed_by, changed_at, expires_at
       FROM system_controls
       ORDER BY code ASC`,
    );
    return rows.map((row) => ({
      code: row.code,
      enabled: bool(row.is_enabled) && !(row.expires_at && new Date(row.expires_at).getTime() <= Date.now()),
      reason: row.reason,
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      expiresAt: row.expires_at,
    }));
  }

  async setControl(
    adminId: string,
    code: string,
    enabled: boolean,
    reason: string,
    expiresAt?: string | null,
    requestId?: string,
  ) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT code, is_enabled FROM system_controls WHERE code = ?`,
      [code],
    );
    if (!rows[0]) throw new ValidationError('Unknown control');
    await getPool().execute(
      `UPDATE system_controls
       SET is_enabled = ?, reason = ?, changed_by = ?, changed_at = CURRENT_TIMESTAMP, expires_at = ?
       WHERE code = ?`,
      [enabled ? 1 : 0, reason, adminId, expiresAt ?? null, code],
    );
    clearControlCache();
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: enabled ? 'CONTROL_ENABLED' : 'CONTROL_DISABLED',
      module: 'system_controls',
      entityType: 'system_control',
      entityId: code,
      oldValue: { enabled: bool(rows[0].is_enabled) },
      newValue: { enabled, expiresAt: expiresAt ?? null },
      reason,
      requestId,
    });
    return this.listControls();
  }

  async getMaintenance() {
    return this.maintenance();
  }

  async setMaintenance(adminId: string, input: MaintenanceInput, requestId?: string) {
    const previous = await this.maintenance();
    await getPool().execute(
      `UPDATE maintenance_settings
       SET is_enabled = ?, title = ?, message = ?, expected_end_at = ?, allow_admin = ?,
           image_url = ?, updated_by = ?
       WHERE id = 'global'`,
      [
        input.enabled ? 1 : 0,
        input.title,
        input.message,
        input.expectedEndAt ?? null,
        input.allowAdmin ? 1 : 0,
        input.imageUrl ?? null,
        adminId,
      ],
    );
    if (input.allowUserIds) {
      await getPool().execute(
        `UPDATE app_settings SET value_text = ?, updated_by = ? WHERE setting_key = 'maintenance_allow_user_ids'`,
        [input.allowUserIds.join(','), adminId],
      );
      clearSettingsCache();
    }
    maintenanceCache = null;
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: input.enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
      module: 'maintenance',
      entityType: 'maintenance',
      entityId: 'global',
      oldValue: previous,
      newValue: input,
      reason: input.reason,
      requestId,
    });
    return this.maintenance();
  }

  async listAnnouncements() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, title, message, image_url, severity, dismissible, platform,
              min_version, max_version, starts_at, ends_at, is_active, created_by, updated_at
       FROM announcements
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return rows.map(mapAnnouncement);
  }

  async saveAnnouncement(adminId: string, input: AnnouncementInput, id?: string, requestId?: string) {
    const announcementId = id ?? createId();
    if (id) {
      await getPool().execute(
        `UPDATE announcements
         SET title = ?, message = ?, image_url = ?, severity = ?, dismissible = ?, platform = ?,
             min_version = ?, max_version = ?, starts_at = ?, ends_at = ?, is_active = ?, updated_by = ?
         WHERE id = ?`,
        [
          input.title,
          input.message,
          input.imageUrl ?? null,
          input.severity,
          input.dismissible ? 1 : 0,
          input.platform,
          input.minVersion ?? null,
          input.maxVersion ?? null,
          input.startsAt ?? null,
          input.endsAt ?? null,
          input.isActive ? 1 : 0,
          adminId,
          id,
        ],
      );
    } else {
      await getPool().execute(
        `INSERT INTO announcements (
           id, title, message, image_url, severity, dismissible, platform,
           min_version, max_version, starts_at, ends_at, is_active, created_by, updated_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          announcementId,
          input.title,
          input.message,
          input.imageUrl ?? null,
          input.severity,
          input.dismissible ? 1 : 0,
          input.platform,
          input.minVersion ?? null,
          input.maxVersion ?? null,
          input.startsAt ?? null,
          input.endsAt ?? null,
          input.isActive ? 1 : 0,
          adminId,
          adminId,
        ],
      );
    }
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'ANNOUNCEMENT_CHANGED',
      module: 'announcements',
      entityType: 'announcement',
      entityId: announcementId,
      newValue: input,
      reason: input.reason ?? null,
      requestId,
    });
    return this.listAnnouncements();
  }

  async setAnnouncementActive(adminId: string, id: string, isActive: boolean, reason?: string, requestId?: string) {
    const [result] = await getPool().execute<ResultSetHeader>(
      `UPDATE announcements SET is_active = ?, updated_by = ? WHERE id = ?`,
      [isActive ? 1 : 0, adminId, id],
    );
    if (result.affectedRows === 0) throw new NotFoundError('Announcement not found');
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: isActive ? 'ANNOUNCEMENT_ACTIVATED' : 'ANNOUNCEMENT_DEACTIVATED',
      module: 'announcements',
      entityType: 'announcement',
      entityId: id,
      newValue: { isActive },
      reason: reason ?? null,
      requestId,
    });
    return this.listAnnouncements();
  }

  async deleteAnnouncement(adminId: string, id: string, reason?: string, requestId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, title FROM announcements WHERE id = ? LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundError('Announcement not found');
    await getPool().execute(`DELETE FROM announcements WHERE id = ?`, [id]);
    await writeAudit({
      actorType: 'admin',
      actorId: adminId,
      action: 'ANNOUNCEMENT_DELETED',
      module: 'announcements',
      entityType: 'announcement',
      entityId: id,
      oldValue: { title: rows[0].title },
      reason: reason ?? null,
      requestId,
    });
    return this.listAnnouncements();
  }

  async health() {
    const started = Date.now();
    let database: 'ok' | 'error' = 'ok';
    try {
      await getPool().query('SELECT 1');
    } catch {
      database = 'error';
    }
    const [webhookRows] = await getPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM razorpay_webhook_events
       WHERE processing_status = 'FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    ).catch(() => [[{ total: 0 }] as RowDataPacket[]]);

    return {
      api: 'ok',
      database,
      databaseMs: Date.now() - started,
      razorpayConfigured: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
      pushConfigured: Boolean(env.FIREBASE_SERVICE_ACCOUNT_PATH),
      failedWebhooks24h: Number(webhookRows[0]?.total ?? 0),
      uptimeSeconds: Math.trunc(process.uptime()),
    };
  }

  private forceReady(release: { force_update: number; enforce_at: Date | null }): boolean {
    if (!bool(release.force_update)) return false;
    if (release.enforce_at && new Date(release.enforce_at).getTime() > Date.now()) return false;
    return true;
  }

  private async activeRelease(platform: string) {
    if (!releaseCache || Date.now() - releaseCache.at > POLICY_CACHE_MS) {
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT platform, version, build_number, min_version, min_build, store_url, title, message,
                force_update, enforce_at
         FROM app_releases
         WHERE is_active = 1
         ORDER BY updated_at DESC`,
      );
      const byPlatform = new Map<string, RowDataPacket | null>();
      for (const row of rows) {
        if (!byPlatform.has(row.platform as string)) byPlatform.set(row.platform as string, row);
      }
      releaseCache = { at: Date.now(), byPlatform };
    }
    const cached = releaseCache.byPlatform.get(platform);
    if (!cached) return undefined;
    return cached as {
      version: string;
      build_number: number;
      min_version: string;
      min_build: number;
      store_url: string | null;
      title: string;
      message: string;
      force_update: number;
      enforce_at: Date | null;
    } | undefined;
  }

  private async maintenance() {
    if (maintenanceCache && Date.now() - maintenanceCache.at < POLICY_CACHE_MS) {
      return maintenanceCache.value;
    }
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT is_enabled, title, message, expected_end_at, allow_admin, image_url
       FROM maintenance_settings WHERE id = 'global' LIMIT 1`,
    );
    const [allow] = await getPool().query<RowDataPacket[]>(
      `SELECT value_text FROM app_settings WHERE setting_key = 'maintenance_allow_user_ids' LIMIT 1`,
    );
    const row = rows[0];
    const value = {
      enabled: bool(row?.is_enabled),
      title: (row?.title as string) ?? 'We will be back soon',
      message: (row?.message as string) ?? 'We will be back soon.',
      expectedEndAt: row?.expected_end_at ?? null,
      allowAdmin: row ? bool(row.allow_admin) : true,
      imageUrl: (row?.image_url as string | null) ?? null,
      allowUserIds: String(allow[0]?.value_text ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    };
    maintenanceCache = { at: Date.now(), value };
    return value;
  }

  private async activeAnnouncements(platform: string, version: string | null) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, title, message, image_url, severity, dismissible, platform, min_version, max_version
       FROM announcements
       WHERE is_active = 1
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at > NOW())
       ORDER BY created_at DESC
       LIMIT 10`,
    );
    return rows
      .filter((row) => row.platform === 'ALL' || row.platform === platform)
      .filter((row) => versionInRange(version, row.min_version as string | null, row.max_version as string | null))
      .map(mapAnnouncement);
  }

  private async evaluateFlags(client: ClientContext, userId?: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT flag_key, enabled, platform, min_version, max_version, rollout_percentage, starts_at, ends_at, environment
       FROM feature_flags`,
    );
    const now = Date.now();
    const result: Record<string, boolean> = {};
    for (const row of rows) {
      const key = row.flag_key as string;
      if (!bool(row.enabled)) {
        result[key] = false;
        continue;
      }
      if (row.environment !== 'ALL' && row.environment !== env.NODE_ENV) {
        result[key] = false;
        continue;
      }
      if (row.platform !== 'ALL' && row.platform !== client.platform) {
        result[key] = false;
        continue;
      }
      if (row.starts_at && new Date(row.starts_at).getTime() > now) {
        result[key] = false;
        continue;
      }
      if (row.ends_at && new Date(row.ends_at).getTime() <= now) {
        result[key] = false;
        continue;
      }
      if (!versionInRange(client.appVersion, row.min_version as string | null, row.max_version as string | null)) {
        result[key] = false;
        continue;
      }
      const stableId = userId ?? client.deviceId ?? 'anonymous';
      result[key] = isInRollout(stableId, key, Number(row.rollout_percentage));
    }
    return result;
  }

  private async publicSettings() {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT setting_key, value_text FROM app_settings
       WHERE setting_key IN ('optional_update_reminder_hours')`,
    );
    const config: Record<string, string> = {};
    for (const row of rows) config[row.setting_key as string] = String(row.value_text);
    const controls = await this.listControls();
    for (const control of controls) {
      config[control.code] = control.enabled ? 'true' : 'false';
    }
    return config;
  }

  private assertVersion(value: string) {
    if (!/^\d+(\.\d+){0,3}$/.test(value)) throw new ValidationError('Invalid version');
  }

  private async flagById(id: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, flag_key, enabled FROM feature_flags WHERE id = ?`,
      [id],
    );
    return rows[0] ?? null;
  }

  private async flagByKey(key: string) {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, flag_key, enabled FROM feature_flags WHERE flag_key = ?`,
      [key],
    );
    return rows[0] ?? null;
  }
}

function mapRelease(row: RowDataPacket) {
  return {
    id: row.id,
    platform: row.platform,
    version: row.version,
    buildNumber: row.build_number,
    minVersion: row.min_version,
    minBuild: row.min_build,
    storeUrl: row.store_url,
    title: row.title,
    message: row.message,
    forceUpdate: bool(row.force_update),
    enforceAt: row.enforce_at,
    releaseNotes: row.release_notes,
    isActive: bool(row.is_active),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFlag(row: RowDataPacket) {
  return {
    id: row.id,
    key: row.flag_key,
    name: row.name,
    description: row.description,
    enabled: bool(row.enabled),
    platform: row.platform,
    minVersion: row.min_version,
    maxVersion: row.max_version,
    rolloutPercentage: row.rollout_percentage,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    environment: row.environment,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnnouncement(row: RowDataPacket) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url,
    severity: row.severity,
    dismissible: bool(row.dismissible),
    platform: row.platform,
    minVersion: row.min_version,
    maxVersion: row.max_version,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: bool(row.is_active),
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export interface ReleaseInput {
  platform: 'ANDROID' | 'IOS';
  version: string;
  buildNumber: number;
  minVersion: string;
  minBuild: number;
  storeUrl?: string | null;
  title: string;
  message: string;
  forceUpdate: boolean;
  enforceAt?: string | null;
  releaseNotes?: string | null;
  isActive: boolean;
  reason?: string;
}

export interface FlagInput {
  flagKey: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  platform: 'ALL' | 'ANDROID' | 'IOS';
  minVersion?: string | null;
  maxVersion?: string | null;
  rolloutPercentage: number;
  startsAt?: string | null;
  endsAt?: string | null;
  environment: string;
  reason?: string;
}

export interface MaintenanceInput {
  enabled: boolean;
  title: string;
  message: string;
  expectedEndAt?: string | null;
  allowAdmin: boolean;
  imageUrl?: string | null;
  allowUserIds?: string[];
  reason: string;
}

export interface AnnouncementInput {
  title: string;
  message: string;
  imageUrl?: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  dismissible: boolean;
  platform: 'ALL' | 'ANDROID' | 'IOS';
  minVersion?: string | null;
  maxVersion?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive: boolean;
  reason?: string;
}
