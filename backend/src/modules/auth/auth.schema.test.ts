import { describe, expect, it } from 'vitest';
import { requestOtpSchema, verifyOtpSchema } from './auth.schema.js';

describe('auth schemas', () => {
  it('accepts valid Indian phone', () => {
    const parsed = requestOtpSchema.parse({ phone: '9876543210' });
    expect(parsed.phoneCountryCode).toBe('+91');
  });

  it('rejects invalid phone', () => {
    expect(() => requestOtpSchema.parse({ phone: '12345' })).toThrow();
  });

  it('accepts 4-digit otp', () => {
    const parsed = verifyOtpSchema.parse({
      phone: '9876543210',
      otp: '1234',
    });
    expect(parsed.otp).toBe('1234');
  });
});
