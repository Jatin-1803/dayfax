import { describe, expect, it } from 'vitest';
import {
  DELIVERY_OTP_LENGTH,
  generateDeliveryOtp,
  isValidDeliveryOtpFormat,
  normalizeDeliveryOtp,
} from './delivery-otp.js';

describe('delivery-otp', () => {
  it('generates a zero-padded numeric code of fixed length', () => {
    for (let i = 0; i < 20; i += 1) {
      const otp = generateDeliveryOtp();
      expect(otp).toHaveLength(DELIVERY_OTP_LENGTH);
      expect(otp).toMatch(/^\d{4}$/);
    }
  });

  it('normalizes and validates partner-entered OTP', () => {
    expect(normalizeDeliveryOtp(' 12-34 ')).toBe('1234');
    expect(isValidDeliveryOtpFormat('1234')).toBe(true);
    expect(isValidDeliveryOtpFormat('12a4')).toBe(false);
    expect(isValidDeliveryOtpFormat('123')).toBe(false);
  });
});
