import { z } from 'zod';

const phoneCountryCode = z.string().trim().min(1).max(8).default('+91');
const phone = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const requestOtpSchema = z.object({
  phoneCountryCode,
  phone,
});

export const verifyOtpSchema = z.object({
  phoneCountryCode,
  phone,
  otp: z.string().trim().regex(/^\d{4,6}$/, 'Enter a valid OTP'),
});

export const passwordLoginSchema = z.object({
  phoneCountryCode,
  phone,
  password: passwordField,
});

export const passwordStatusSchema = z.object({
  phoneCountryCode,
  phone,
});

export const passwordRegisterSchema = z
  .object({
    phoneCountryCode,
    phone,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(120, 'Name must be at most 120 characters'),
});

export const setPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});

export const googleLoginSchema = z.object({
  idToken: z.string().trim().min(20, 'Google sign-in token is required'),
});

export const linkPhoneRequestSchema = z.object({
  phoneCountryCode,
  phone,
});

export const linkPhoneVerifySchema = z.object({
  phoneCountryCode,
  phone,
  otp: z.string().trim().regex(/^\d{4,6}$/, 'Enter a valid OTP'),
});

/** Direct phone link when customer OTP login is disabled (no SMS OTP). */
export const linkPhoneDirectSchema = z.object({
  phoneCountryCode,
  phone,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type PasswordStatusInput = z.infer<typeof passwordStatusSchema>;
export type PasswordRegisterInput = z.infer<typeof passwordRegisterSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type LinkPhoneRequestInput = z.infer<typeof linkPhoneRequestSchema>;
export type LinkPhoneVerifyInput = z.infer<typeof linkPhoneVerifySchema>;
export type LinkPhoneDirectInput = z.infer<typeof linkPhoneDirectSchema>;
