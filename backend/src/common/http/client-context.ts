import type { Request } from 'express';

export type ClientPlatform = 'ANDROID' | 'IOS' | null;

export interface ClientContext {
  deviceId: string | null;
  platform: ClientPlatform;
  appVersion: string | null;
  appBuild: number | null;
  deviceName: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

function clip(value: string | undefined, max: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizePlatform(value: string | undefined): ClientPlatform {
  const raw = value?.trim().toLowerCase();
  if (raw === 'ios' || raw === 'iphone') return 'IOS';
  if (raw === 'android') return 'ANDROID';
  return null;
}

export function readClientContext(req: Request): ClientContext {
  const buildRaw = req.header('x-app-build');
  const build = buildRaw != null && buildRaw !== '' ? Number(buildRaw) : null;
  return {
    deviceId: clip(req.header('x-device-id'), 64),
    platform: normalizePlatform(req.header('x-app-platform')),
    appVersion: clip(req.header('x-app-version'), 32),
    appBuild: build != null && Number.isFinite(build) ? Math.trunc(build) : null,
    deviceName: clip(req.header('x-device-name'), 120),
    deviceModel: clip(req.header('x-device-model'), 120),
    osVersion: clip(req.header('x-os-version'), 64),
    ipAddress: clip(req.ip, 64),
    userAgent: clip(req.header('user-agent'), 255),
  };
}
