-- Admin promotional pushes. Text is stored here; live delivery uses user_devices.
CREATE TABLE IF NOT EXISTS promo_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  audience ENUM('CUSTOMERS', 'PARTNERS', 'ALL') NOT NULL,
  title VARCHAR(160) NOT NULL,
  title_hi VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL,
  body_hi VARCHAR(500) NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  sent_by_admin_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_promo_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
