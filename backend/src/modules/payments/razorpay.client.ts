import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError, ValidationError } from '../../common/errors/app-error.js';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
}

function basicAuthHeader(): string {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString(
    'base64',
  );
  return `Basic ${token}`;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayKeyId(): string {
  if (!env.RAZORPAY_KEY_ID) {
    throw new ValidationError('Online payments are not configured');
  }
  return env.RAZORPAY_KEY_ID;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new ValidationError('Online payments are not configured');
  }

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    }),
  });

  const payload = (await response.json()) as RazorpayOrder & {
    error?: { description?: string };
  };

  if (!response.ok) {
    throw new AppError(payload.error?.description ?? 'Could not create Razorpay order', {
      statusCode: 502,
      code: 'RAZORPAY_ERROR',
    });
  }

  return payload;
}

export function verifyRazorpaySignature(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) return false;
  const body = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
  return safeEqualHex(expected, input.razorpaySignature);
}

export interface RazorpayQrCode {
  id: string;
  image_url: string;
  status: string;
  close_by: number | null;
  payment_amount: number;
}

export interface RazorpayPaymentEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string | null;
  notes?: Record<string, string> | null;
}

export function isRazorpayWebhookConfigured(): boolean {
  return Boolean(env.RAZORPAY_WEBHOOK_SECRET);
}

export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signatureHeader) return false;
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(payload).digest('hex');
  return safeEqualHex(expected, signatureHeader);
}

export async function createQrCode(input: {
  amountPaise: number;
  name: string;
  description: string;
  closeByUnix: number;
  notes: Record<string, string>;
}): Promise<RazorpayQrCode> {
  if (!isRazorpayConfigured()) {
    throw new ValidationError('Online payments are not configured');
  }

  const response = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'upi_qr',
      name: input.name.slice(0, 40),
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: input.amountPaise,
      description: input.description.slice(0, 255),
      close_by: input.closeByUnix,
      notes: input.notes,
    }),
  });

  const payload = (await response.json()) as RazorpayQrCode & {
    error?: { description?: string };
  };

  if (!response.ok || !payload.id || !payload.image_url) {
    throw new AppError(payload.error?.description ?? 'Could not create payment QR', {
      statusCode: 502,
      code: 'RAZORPAY_ERROR',
    });
  }

  return payload;
}

export async function listQrPayments(qrId: string): Promise<RazorpayPaymentEntity[]> {
  if (!isRazorpayConfigured()) {
    throw new ValidationError('Online payments are not configured');
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/payments`,
    {
      method: 'GET',
      headers: { Authorization: basicAuthHeader() },
    },
  );

  const payload = (await response.json()) as {
    items?: RazorpayPaymentEntity[];
    error?: { description?: string };
  };

  if (!response.ok) {
    throw new AppError(payload.error?.description ?? 'Could not verify payment with Razorpay', {
      statusCode: 502,
      code: 'PAYMENT_VERIFICATION_PENDING',
    });
  }

  return payload.items ?? [];
}

function safeEqualHex(expectedHex: string, actualHex: string): boolean {
  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const actualBuf = Buffer.from(actualHex, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
