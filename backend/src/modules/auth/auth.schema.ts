import { z } from 'zod';

export const requestOtpSchema = z.object({
  phoneCountryCode: z.string().trim().min(1).max(8).default('+91'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

export const verifyOtpSchema = z.object({
  phoneCountryCode: z.string().trim().min(1).max(8).default('+91'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  otp: z.string().trim().regex(/^\d{4,6}$/, 'Enter a valid OTP'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
