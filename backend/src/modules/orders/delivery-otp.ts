import { randomInt } from 'node:crypto';

export const DELIVERY_OTP_LENGTH = 4;
export const DELIVERY_OTP_MAX_ATTEMPTS = 5;

/** Statuses where the customer may still see / use the handover OTP. */
export const DELIVERY_OTP_VISIBLE_STATUSES = new Set([
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
]);

export function generateDeliveryOtp(length = DELIVERY_OTP_LENGTH): string {
  const max = 10 ** length;
  return String(randomInt(0, max)).padStart(length, '0');
}

export function normalizeDeliveryOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, DELIVERY_OTP_LENGTH);
}

export function isValidDeliveryOtpFormat(value: string): boolean {
  return new RegExp(`^\\d{${DELIVERY_OTP_LENGTH}}$`).test(value);
}
