import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '../database/pool.js';

export interface SessionPolicy {
  userIdleTimeoutMinutes: number;
  userAbsoluteTimeoutMinutes: number;
  userRefreshTtlDays: number;
  adminIdleTimeoutMinutes: number;
  adminAbsoluteTimeoutMinutes: number;
  forceLogoutOnSecurityChange: boolean;
  maxFailedAttempts: number;
  failedAttemptWindowMinutes: number;
  lockDurationMinutes: number;
  maxRepeatedLockouts: number;
  otpRequestLimit: number;
  otpVerifyAttemptLimit: number;
  optionalUpdateReminderHours: number;
  maintenanceAllowUserIds: string[];
}

const DEFAULTS: SessionPolicy = {
  userIdleTimeoutMinutes: 43200,
  userAbsoluteTimeoutMinutes: 43200,
  userRefreshTtlDays: 30,
  adminIdleTimeoutMinutes: 480,
  adminAbsoluteTimeoutMinutes: 1440,
  forceLogoutOnSecurityChange: true,
  maxFailedAttempts: 5,
  failedAttemptWindowMinutes: 15,
  lockDurationMinutes: 15,
  maxRepeatedLockouts: 3,
  otpRequestLimit: 8,
  otpVerifyAttemptLimit: 5,
  optionalUpdateReminderHours: 24,
  maintenanceAllowUserIds: [],
};

const INT_KEYS: Record<string, keyof SessionPolicy> = {
  user_idle_timeout_minutes: 'userIdleTimeoutMinutes',
  user_absolute_timeout_minutes: 'userAbsoluteTimeoutMinutes',
  user_refresh_ttl_days: 'userRefreshTtlDays',
  admin_idle_timeout_minutes: 'adminIdleTimeoutMinutes',
  admin_absolute_timeout_minutes: 'adminAbsoluteTimeoutMinutes',
  max_failed_attempts: 'maxFailedAttempts',
  failed_attempt_window_minutes: 'failedAttemptWindowMinutes',
  lock_duration_minutes: 'lockDurationMinutes',
  max_repeated_lockouts: 'maxRepeatedLockouts',
  otp_request_limit: 'otpRequestLimit',
  otp_verify_attempt_limit: 'otpVerifyAttemptLimit',
  optional_update_reminder_hours: 'optionalUpdateReminderHours',
};

let cached: { at: number; value: SessionPolicy } | null = null;
const CACHE_MS = 30_000;

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function parseSettingsRows(
  rows: Array<{ setting_key: string; value_text: string }>,
): SessionPolicy {
  const next: SessionPolicy = { ...DEFAULTS };
  for (const row of rows) {
    if (row.setting_key === 'force_logout_on_security_change') {
      next.forceLogoutOnSecurityChange = row.value_text === 'true' || row.value_text === '1';
    } else if (row.setting_key === 'maintenance_allow_user_ids') {
      next.maintenanceAllowUserIds = row.value_text
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    } else {
      const field = INT_KEYS[row.setting_key];
      if (field) {
        (next[field] as number) = clampInt(Number(row.value_text), 1, 525600, next[field] as number);
      }
    }
  }
  return next;
}

export async function getSessionPolicy(): Promise<SessionPolicy> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT setting_key, value_text FROM app_settings`,
    );
    const value = parseSettingsRows(
      rows.map((row) => ({
        setting_key: row.setting_key as string,
        value_text: String(row.value_text),
      })),
    );
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULTS;
  }
}

export function clearSettingsCache(): void {
  cached = null;
}

export function defaultSessionPolicy(): SessionPolicy {
  return { ...DEFAULTS };
}
