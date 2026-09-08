import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    RAZORPAY_KEY_ID: 'rzp_test',
    RAZORPAY_KEY_SECRET: 'key-secret',
    RAZORPAY_WEBHOOK_SECRET: 'whsec_test',
  },
}));

import { verifyWebhookSignature } from './razorpay.client.js';

describe('verifyWebhookSignature', () => {
  it('accepts a valid raw-body HMAC and rejects a modified body', () => {
    const raw = Buffer.from('{"event":"qr_code.credited"}', 'utf8');
    const signature = createHmac('sha256', 'whsec_test').update(raw).digest('hex');

    expect(verifyWebhookSignature(raw, signature)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from('{"event":"other"}', 'utf8'), signature)).toBe(false);
    expect(verifyWebhookSignature(raw, undefined)).toBe(false);
  });
});
