-- FCM tokens for customer and delivery-partner push. Bound to the logged-in user.
CREATE TABLE IF NOT EXISTS user_devices (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  fcm_token VARCHAR(512) NOT NULL,
  platform ENUM('android', 'ios') NOT NULL,
  locale ENUM('en', 'hi') NOT NULL DEFAULT 'en',
  app_role ENUM('CUSTOMER', 'DELIVERY_PARTNER') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_devices_token (fcm_token),
  KEY idx_user_devices_user_role (user_id, app_role),
  KEY idx_user_devices_role (app_role),
  CONSTRAINT fk_user_devices_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
