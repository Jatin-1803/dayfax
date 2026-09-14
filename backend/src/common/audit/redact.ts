const SECRET_KEYS = [
  'otp',
  'password',
  'token',
  'authorization',
  'refreshToken',
  'accessToken',
  'code_hash',
  'password_hash',
  'secret',
];

export function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      if (SECRET_KEYS.some((secret) => lowered.includes(secret.toLowerCase()))) {
        output[key] = '[redacted]';
      } else {
        output[key] = redactAuditValue(nested);
      }
    }
    return output;
  }
  return value;
}
