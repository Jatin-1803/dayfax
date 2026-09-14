export const ACCOUNT_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'BLOCKED',
  'SUSPENDED',
  'BANNED',
  'SECURITY_LOCKED',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const RISK_STATUSES = ['NORMAL', 'WATCH', 'SUSPICIOUS', 'RESTRICTED'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const DENIED_ACCOUNT_CODES: Record<string, string> = {
  INACTIVE: 'ACCOUNT_INACTIVE',
  BLOCKED: 'ACCOUNT_BANNED',
  SUSPENDED: 'ACCOUNT_SUSPENDED',
  BANNED: 'ACCOUNT_BANNED',
  SECURITY_LOCKED: 'ACCOUNT_LOCKED',
};

export function accountDenyCode(status: string): string | null {
  return DENIED_ACCOUNT_CODES[status] ?? null;
}

export function isLoginBlocked(status: string): boolean {
  return status === 'BLOCKED' || status === 'BANNED' || status === 'SUSPENDED' || status === 'INACTIVE';
}
