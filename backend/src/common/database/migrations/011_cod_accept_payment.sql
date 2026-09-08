-- COD accept + Razorpay QR/webhook mapping. Amounts stay on orders.grand_total_paise and payments.amount_paise.

ALTER TABLE payments
  ADD COLUMN razorpay_order_id VARCHAR(64) NULL AFTER provider_ref,
  ADD COLUMN razorpay_payment_id VARCHAR(64) NULL AFTER razorpay_order_id,
  ADD COLUMN razorpay_qr_id VARCHAR(64) NULL AFTER razorpay_payment_id,
  ADD COLUMN verification_source ENUM('checkout', 'webhook', 'manual_check') NULL AFTER razorpay_qr_id;

CREATE TABLE payment_attempts (
  id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  payment_id CHAR(36) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  razorpay_order_id VARCHAR(64) NULL,
  razorpay_payment_id VARCHAR(64) NULL,
  razorpay_qr_id VARCHAR(64) NULL,
  amount_paise INT NOT NULL,
  status ENUM(
    'CREATED',
    'PROCESSING',
    'CAPTURED',
    'FAILED',
    'EXPIRED',
    'AMOUNT_MISMATCH',
    'REFUNDED'
  ) NOT NULL DEFAULT 'CREATED',
  verification_source ENUM('checkout', 'webhook', 'manual_check') NULL,
  image_url VARCHAR(512) NULL,
  expires_at TIMESTAMP NULL,
  notes_json JSON NULL,
  verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_attempts_qr (razorpay_qr_id),
  UNIQUE KEY uq_payment_attempts_payment (razorpay_payment_id),
  KEY idx_payment_attempts_order_status (order_id, status),
  CONSTRAINT fk_payment_attempts_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_payment_attempts_payment FOREIGN KEY (payment_id) REFERENCES payments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE razorpay_webhook_events (
  id CHAR(36) NOT NULL,
  event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  razorpay_payment_id VARCHAR(64) NULL,
  razorpay_order_id VARCHAR(64) NULL,
  razorpay_qr_id VARCHAR(64) NULL,
  internal_order_id CHAR(36) NULL,
  payload_json JSON NULL,
  processing_status ENUM('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED') NOT NULL DEFAULT 'RECEIVED',
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_razorpay_webhook_event_id (event_id),
  KEY idx_razorpay_webhook_payment (razorpay_payment_id),
  KEY idx_razorpay_webhook_order (internal_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_acceptance_locks (
  order_id CHAR(36) NOT NULL,
  assignment_id CHAR(36) NOT NULL,
  delivery_partner_id CHAR(36) NOT NULL,
  accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY idx_acceptance_locks_partner (delivery_partner_id),
  CONSTRAINT fk_acceptance_locks_order FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_acceptance_locks_assignment FOREIGN KEY (assignment_id) REFERENCES delivery_assignments (id),
  CONSTRAINT fk_acceptance_locks_partner FOREIGN KEY (delivery_partner_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
