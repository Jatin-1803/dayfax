/** Prefer build numbers. Fall back to dotted version. Invalid data never force-updates. */

export function parseVersion(value: string | null | undefined): number[] | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^v/i, '');
  if (!/^\d+(\.\d+){0,3}$/.test(cleaned)) return null;
  return cleaned.split('.').map((part) => Number(part));
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return 0;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function isBelowMinimum(input: {
  installedVersion?: string | null;
  installedBuild?: number | null;
  minVersion: string;
  minBuild: number;
}): boolean {
  if (input.installedBuild != null && Number.isFinite(input.installedBuild) && input.minBuild > 0) {
    return input.installedBuild < input.minBuild;
  }
  if (!input.installedVersion) return false;
  return compareVersions(input.installedVersion, input.minVersion) < 0;
}

export function isUpdateAvailable(input: {
  installedVersion?: string | null;
  installedBuild?: number | null;
  latestVersion: string;
  latestBuild: number;
}): boolean {
  if (input.installedBuild != null && Number.isFinite(input.installedBuild) && input.latestBuild > 0) {
    return input.installedBuild < input.latestBuild;
  }
  if (!input.installedVersion) return false;
  return compareVersions(input.installedVersion, input.latestVersion) < 0;
}

export function versionInRange(
  installed: string | null | undefined,
  minVersion?: string | null,
  maxVersion?: string | null,
): boolean {
  if (minVersion && installed && compareVersions(installed, minVersion) < 0) return false;
  if (maxVersion && installed && compareVersions(installed, maxVersion) > 0) return false;
  return true;
}
