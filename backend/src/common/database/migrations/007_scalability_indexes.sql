-- Performance / concurrency indexes for high-traffic lookups.
-- token_hash is used on every refresh; without an index this is a full scan.
ALTER TABLE refresh_tokens
  ADD INDEX idx_refresh_token_hash (token_hash);

ALTER TABLE admin_refresh_tokens
  ADD INDEX idx_admin_refresh_token_hash (token_hash);

-- Keep a single payment row per order (list JOIN otherwise duplicates orders).
DELETE p1 FROM payments p1
INNER JOIN payments p2
  ON p1.order_id = p2.order_id
 AND p1.created_at < p2.created_at;

ALTER TABLE payments
  ADD UNIQUE KEY uq_payments_order (order_id);

-- Checkout idempotency: same client key returns the same order under retries.
CREATE TABLE IF NOT EXISTS checkout_idempotency (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL,
  order_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checkout_idempotency_user_key (user_id, idempotency_key),
  KEY idx_checkout_idempotency_order (order_id),
  CONSTRAINT fk_checkout_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_checkout_idempotency_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
