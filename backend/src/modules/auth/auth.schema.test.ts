import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  googleLoginSchema,
  linkPhoneRequestSchema,
  linkPhoneVerifySchema,
  passwordLoginSchema,
  passwordRegisterSchema,
  passwordStatusSchema,
  requestOtpSchema,
  setPasswordSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from './auth.schema.js';

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

  it('accepts password login', () => {
    const parsed = passwordLoginSchema.parse({
      phone: '9876543210',
      password: 'secret123',
    });
    expect(parsed.password).toBe('secret123');
  });

  it('rejects short password on login', () => {
    expect(() =>
      passwordLoginSchema.parse({
        phone: '9876543210',
        password: 'short',
      }),
    ).toThrow();
  });

  it('accepts password status lookup', () => {
    const parsed = passwordStatusSchema.parse({ phone: '9876543210' });
    expect(parsed.phone).toBe('9876543210');
  });

  it('accepts password register when confirm matches', () => {
    const parsed = passwordRegisterSchema.parse({
      phone: '9876543210',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(parsed.password).toBe('secret123');
  });

  it('rejects password register when confirm mismatches', () => {
    expect(() =>
      passwordRegisterSchema.parse({
        phone: '9876543210',
        password: 'secret123',
        confirmPassword: 'other123',
      }),
    ).toThrow();
  });

  it('accepts profile name update', () => {
    const parsed = updateProfileSchema.parse({ fullName: '  Riya  ' });
    expect(parsed.fullName).toBe('Riya');
  });

  it('rejects empty profile name', () => {
    expect(() => updateProfileSchema.parse({ fullName: '   ' })).toThrow();
  });

  it('accepts set password when confirm matches', () => {
    const parsed = setPasswordSchema.parse({
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(parsed.password).toBe('secret123');
  });

  it('rejects set password when confirm mismatches', () => {
    expect(() =>
      setPasswordSchema.parse({
        password: 'secret123',
        confirmPassword: 'other123',
      }),
    ).toThrow();
  });

  it('accepts change password when confirm matches', () => {
    const parsed = changePasswordSchema.parse({
      currentPassword: 'oldpass12',
      password: 'newpass12',
      confirmPassword: 'newpass12',
    });
    expect(parsed.currentPassword).toBe('oldpass12');
  });

  it('accepts google login token', () => {
    const parsed = googleLoginSchema.parse({ idToken: 'y'.repeat(32) });
    expect(parsed.idToken.length).toBe(32);
  });

  it('accepts phone link schemas', () => {
    expect(linkPhoneRequestSchema.parse({ phone: '9876543210' }).phone).toBe('9876543210');
    expect(
      linkPhoneVerifySchema.parse({ phone: '9876543210', otp: '4321' }).otp,
    ).toBe('4321');
  });
});
