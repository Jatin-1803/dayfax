-- Customer support chat, damaged-item returns, and refund tracking.

ALTER TABLE payments
  ADD COLUMN refund_status ENUM('NONE', 'PENDING', 'PROCESSING', 'PAID', 'FAILED') NOT NULL DEFAULT 'NONE' AFTER paid_at,
  ADD COLUMN razorpay_refund_id VARCHAR(64) NULL AFTER refund_status,
  ADD COLUMN refund_payout_ref VARCHAR(128) NULL AFTER razorpay_refund_id;

ALTER TABLE delivery_assignments
  ADD COLUMN purpose ENUM('DELIVERY', 'RETURN_PICKUP') NOT NULL DEFAULT 'DELIVERY' AFTER delivery_partner_id,
  ADD COLUMN return_request_id CHAR(36) NULL AFTER purpose,
  ADD KEY idx_delivery_purpose_status (purpose, status),
  ADD KEY idx_delivery_return_request (return_request_id);

CREATE TABLE IF NOT EXISTS support_conversations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  agent_display_name VARCHAR(80) NOT NULL DEFAULT 'Ananya',
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_support_conversations_order (order_id),
  KEY idx_support_conversations_user (user_id, updated_at),
  CONSTRAINT fk_support_conversations_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_support_conversations_order FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  sender ENUM('CUSTOMER', 'AGENT') NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_support_messages_conversation (conversation_id, created_at),
  CONSTRAINT fk_support_messages_conversation FOREIGN KEY (conversation_id) REFERENCES support_conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_requests (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  conversation_id CHAR(36) NULL,
  reason ENUM('DAMAGED') NOT NULL DEFAULT 'DAMAGED',
  customer_note VARCHAR(1000) NOT NULL,
  status ENUM(
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'PICKUP_IN_PROGRESS',
    'PICKED_UP',
    'REFUND_PENDING',
    'REFUNDED'
  ) NOT NULL DEFAULT 'PENDING_REVIEW',
  refund_amount_paise INT NOT NULL,
  refund_method ENUM('RAZORPAY', 'MANUAL') NOT NULL,
  refund_status ENUM('NONE', 'PENDING', 'PROCESSING', 'PAID', 'FAILED') NOT NULL DEFAULT 'NONE',
  razorpay_refund_id VARCHAR(64) NULL,
  refund_payout_ref VARCHAR(128) NULL,
  pickup_code CHAR(4) NOT NULL,
  pickup_code_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  admin_note VARCHAR(500) NULL,
  reviewed_by_admin_id CHAR(36) NULL,
  reviewed_at TIMESTAMP NULL,
  picked_up_at TIMESTAMP NULL,
  refunded_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_return_requests_order (order_id, status),
  KEY idx_return_requests_status (status, created_at),
  KEY idx_return_requests_user (user_id, created_at),
  CONSTRAINT fk_return_requests_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_return_requests_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_return_requests_conversation FOREIGN KEY (conversation_id) REFERENCES support_conversations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS return_request_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  return_request_id CHAR(36) NOT NULL,
  order_item_id CHAR(36) NOT NULL,
  quantity INT NOT NULL,
  note VARCHAR(255) NULL,
  line_refund_paise INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_return_request_item (return_request_id, order_item_id),
  KEY idx_return_request_items_request (return_request_id),
  CONSTRAINT fk_return_request_items_request FOREIGN KEY (return_request_id) REFERENCES return_requests(id),
  CONSTRAINT fk_return_request_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE delivery_assignments
  ADD CONSTRAINT fk_delivery_return_request
  FOREIGN KEY (return_request_id) REFERENCES return_requests(id);
