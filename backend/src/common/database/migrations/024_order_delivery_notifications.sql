-- Idempotent partner new-order / order-taken push audit trail.
CREATE TABLE IF NOT EXISTS order_delivery_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  delivery_boy_id CHAR(36) NOT NULL,
  notification_type VARCHAR(64) NOT NULL,
  status ENUM('PENDING', 'SENT', 'FAILED', 'OPENED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
  attempt_count INT NOT NULL DEFAULT 0,
  failure_reason VARCHAR(255) NULL,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  delivered_at TIMESTAMP NULL DEFAULT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  meta_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_odn_order_partner_type (order_id, delivery_boy_id, notification_type),
  KEY idx_odn_order_id (order_id),
  KEY idx_odn_delivery_boy (delivery_boy_id),
  KEY idx_odn_status (status),
  KEY idx_odn_type_status (notification_type, status),
  KEY idx_odn_created_at (created_at),
  CONSTRAINT fk_odn_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_odn_partner FOREIGN KEY (delivery_boy_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
