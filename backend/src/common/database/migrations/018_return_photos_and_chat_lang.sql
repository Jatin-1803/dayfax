-- Conversation language for later support messages, and damage-photo evidence.

ALTER TABLE support_conversations
  ADD COLUMN lang ENUM('en', 'hi') NOT NULL DEFAULT 'en' AFTER status,
  ADD COLUMN item_picker_open TINYINT(1) NOT NULL DEFAULT 0 AFTER lang;

CREATE TABLE IF NOT EXISTS return_request_photos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  return_request_id CHAR(36) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_return_request_photos_request (return_request_id),
  CONSTRAINT fk_return_request_photos_request FOREIGN KEY (return_request_id) REFERENCES return_requests(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
