-- Allow recording COD collected as physical cash (alongside Razorpay QR).

ALTER TABLE payments
  MODIFY COLUMN verification_source ENUM('checkout', 'webhook', 'manual_check', 'cash') NULL;

ALTER TABLE payment_attempts
  MODIFY COLUMN verification_source ENUM('checkout', 'webhook', 'manual_check', 'cash') NULL;
