-- Account lifecycle, sessions, audit, RBAC, version policy, flags, and operational controls.
-- Additive only. Existing refresh tokens stay valid until they expire.

ALTER TABLE users
  MODIFY status ENUM(
    'ACTIVE',
    'INACTIVE',
    'BLOCKED',
    'SUSPENDED',
    'BANNED',
    'SECURITY_LOCKED'
  ) NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE users
  ADD COLUMN risk_status ENUM('NORMAL', 'WATCH', 'SUSPICIOUS', 'RESTRICTED') NOT NULL DEFAULT 'NORMAL' AFTER status,
  ADD COLUMN status_expires_at TIMESTAMP NULL AFTER last_login_at,
  ADD COLUMN sessions_valid_after TIMESTAMP NULL AFTER status_expires_at,
  ADD COLUMN suspicious_at TIMESTAMP NULL AFTER sessions_valid_after;

ALTER TABLE admin_users
  ADD COLUMN sessions_valid_after TIMESTAMP NULL AFTER last_login_at;

CREATE TABLE IF NOT EXISTS user_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  device_id VARCHAR(64) NULL,
  platform VARCHAR(16) NULL,
  device_name VARCHAR(120) NULL,
  device_model VARCHAR(120) NULL,
  os_version VARCHAR(64) NULL,
  app_version VARCHAR(32) NULL,
  app_build INT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  revoke_reason VARCHAR(255) NULL,
  KEY idx_user_sessions_user (user_id, revoked_at),
  KEY idx_user_sessions_device (user_id, device_id),
  KEY idx_user_sessions_expires (expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  admin_user_id CHAR(36) NOT NULL,
  device_id VARCHAR(64) NULL,
  platform VARCHAR(16) NULL,
  device_name VARCHAR(120) NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  revoke_reason VARCHAR(255) NULL,
  KEY idx_admin_sessions_user (admin_user_id, revoked_at),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE refresh_tokens
  ADD COLUMN session_id CHAR(36) NULL AFTER user_id,
  ADD KEY idx_refresh_tokens_session (session_id);

ALTER TABLE admin_refresh_tokens
  ADD COLUMN session_id CHAR(36) NULL AFTER admin_user_id,
  ADD KEY idx_admin_refresh_session (session_id);

CREATE TABLE IF NOT EXISTS user_status_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  previous_status VARCHAR(32) NOT NULL,
  new_status VARCHAR(32) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  admin_id CHAR(36) NULL,
  expires_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  revoked_by CHAR(36) NULL,
  revoke_reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_status_events_user (user_id, created_at),
  CONSTRAINT fk_user_status_events_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_security_events (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  phone VARCHAR(20) NULL,
  event_type VARCHAR(64) NOT NULL,
  ip_address VARCHAR(64) NULL,
  device_id VARCHAR(64) NULL,
  meta_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_security_phone (phone, event_type, created_at),
  KEY idx_user_security_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_admin_notes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  admin_id CHAR(36) NOT NULL,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_admin_notes_user (user_id, created_at),
  CONSTRAINT fk_user_admin_notes_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  actor_type VARCHAR(16) NOT NULL,
  actor_id CHAR(36) NULL,
  action VARCHAR(64) NOT NULL,
  module VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id VARCHAR(64) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  reason VARCHAR(500) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  request_id VARCHAR(64) NULL,
  result VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  KEY idx_audit_module (module, created_at),
  KEY idx_audit_entity (entity_type, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_admin_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_arp_role FOREIGN KEY (role_id) REFERENCES admin_roles(id),
  CONSTRAINT fk_arp_permission FOREIGN KEY (permission_id) REFERENCES admin_permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id CHAR(36) NOT NULL,
  role_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_user_id, role_id),
  CONSTRAINT fk_aur_admin FOREIGN KEY (admin_user_id) REFERENCES admin_users(id),
  CONSTRAINT fk_aur_role FOREIGN KEY (role_id) REFERENCES admin_roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_roles (id, code, name) VALUES
  ('r0000001-0000-4000-8000-000000000001', 'SUPER_ADMIN', 'Super admin'),
  ('r0000001-0000-4000-8000-000000000002', 'ADMIN', 'Admin'),
  ('r0000001-0000-4000-8000-000000000003', 'OPERATIONS_MANAGER', 'Operations manager'),
  ('r0000001-0000-4000-8000-000000000004', 'SUPPORT', 'Support'),
  ('r0000001-0000-4000-8000-000000000005', 'DELIVERY_MANAGER', 'Delivery manager'),
  ('r0000001-0000-4000-8000-000000000006', 'CATALOG_MANAGER', 'Catalog manager'),
  ('r0000001-0000-4000-8000-000000000007', 'FINANCE_MANAGER', 'Finance manager');

INSERT INTO admin_permissions (id, code, name) VALUES
  ('p0000001-0000-4000-8000-000000000001', 'users.view', 'View users'),
  ('p0000001-0000-4000-8000-000000000002', 'users.edit', 'Edit users'),
  ('p0000001-0000-4000-8000-000000000003', 'users.deactivate', 'Deactivate users'),
  ('p0000001-0000-4000-8000-000000000004', 'users.suspend', 'Suspend users'),
  ('p0000001-0000-4000-8000-000000000005', 'users.ban', 'Ban users'),
  ('p0000001-0000-4000-8000-000000000006', 'users.unban', 'Unban users'),
  ('p0000001-0000-4000-8000-000000000007', 'sessions.view', 'View sessions'),
  ('p0000001-0000-4000-8000-000000000008', 'sessions.revoke', 'Revoke sessions'),
  ('p0000001-0000-4000-8000-000000000009', 'orders.view', 'View orders'),
  ('p0000001-0000-4000-8000-000000000010', 'orders.edit', 'Edit orders'),
  ('p0000001-0000-4000-8000-000000000011', 'orders.cancel', 'Cancel orders'),
  ('p0000001-0000-4000-8000-000000000012', 'orders.reassign', 'Reassign orders'),
  ('p0000001-0000-4000-8000-000000000013', 'payments.view', 'View payments'),
  ('p0000001-0000-4000-8000-000000000014', 'payments.refund', 'Refund payments'),
  ('p0000001-0000-4000-8000-000000000015', 'payments.reconcile', 'Reconcile payments'),
  ('p0000001-0000-4000-8000-000000000016', 'products.view', 'View products'),
  ('p0000001-0000-4000-8000-000000000017', 'products.edit', 'Edit products'),
  ('p0000001-0000-4000-8000-000000000018', 'products.delete', 'Delete products'),
  ('p0000001-0000-4000-8000-000000000019', 'coupons.view', 'View coupons'),
  ('p0000001-0000-4000-8000-000000000020', 'coupons.manage', 'Manage coupons'),
  ('p0000001-0000-4000-8000-000000000021', 'notifications.send', 'Send notifications'),
  ('p0000001-0000-4000-8000-000000000022', 'app_config.view', 'View app config'),
  ('p0000001-0000-4000-8000-000000000023', 'app_config.manage', 'Manage app config'),
  ('p0000001-0000-4000-8000-000000000024', 'feature_flags.view', 'View feature flags'),
  ('p0000001-0000-4000-8000-000000000025', 'feature_flags.manage', 'Manage feature flags'),
  ('p0000001-0000-4000-8000-000000000026', 'version_control.view', 'View versions'),
  ('p0000001-0000-4000-8000-000000000027', 'version_control.manage', 'Manage versions'),
  ('p0000001-0000-4000-8000-000000000028', 'maintenance.manage', 'Manage maintenance'),
  ('p0000001-0000-4000-8000-000000000029', 'audit_logs.view', 'View audit logs'),
  ('p0000001-0000-4000-8000-000000000030', 'roles.view', 'View roles'),
  ('p0000001-0000-4000-8000-000000000031', 'roles.manage', 'Manage roles');

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000001', id FROM admin_permissions;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000002', id FROM admin_permissions
WHERE code <> 'roles.manage';

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000003', id FROM admin_permissions
WHERE code IN (
  'users.view', 'orders.view', 'orders.edit', 'orders.cancel', 'orders.reassign',
  'payments.view', 'notifications.send', 'app_config.view', 'audit_logs.view'
);

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000004', id FROM admin_permissions
WHERE code IN (
  'users.view', 'sessions.view', 'orders.view', 'payments.view', 'audit_logs.view'
);

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000005', id FROM admin_permissions
WHERE code IN ('orders.view', 'orders.reassign', 'users.view', 'sessions.view');

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000006', id FROM admin_permissions
WHERE code IN ('products.view', 'products.edit', 'products.delete', 'app_config.view');

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000007', id FROM admin_permissions
WHERE code IN (
  'payments.view', 'payments.refund', 'payments.reconcile', 'orders.view', 'audit_logs.view', 'coupons.view'
);

INSERT INTO admin_user_roles (admin_user_id, role_id)
SELECT id, 'r0000001-0000-4000-8000-000000000001'
FROM admin_users
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS app_releases (
  id CHAR(36) NOT NULL PRIMARY KEY,
  platform ENUM('ANDROID', 'IOS') NOT NULL,
  version VARCHAR(32) NOT NULL,
  build_number INT NOT NULL,
  min_version VARCHAR(32) NOT NULL,
  min_build INT NOT NULL,
  store_url VARCHAR(512) NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  force_update TINYINT(1) NOT NULL DEFAULT 0,
  enforce_at TIMESTAMP NULL,
  release_notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_app_releases_platform (platform, is_active, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feature_flags (
  id CHAR(36) NOT NULL PRIMARY KEY,
  flag_key VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  platform ENUM('ALL', 'ANDROID', 'IOS') NOT NULL DEFAULT 'ALL',
  min_version VARCHAR(32) NULL,
  max_version VARCHAR(32) NULL,
  rollout_percentage TINYINT UNSIGNED NOT NULL DEFAULT 100,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  environment VARCHAR(32) NOT NULL DEFAULT 'ALL',
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_feature_flags_key (flag_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  value_text VARCHAR(2000) NOT NULL,
  value_type ENUM('string', 'int', 'bool') NOT NULL DEFAULT 'string',
  updated_by CHAR(36) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, value_text, value_type) VALUES
  ('user_idle_timeout_minutes', '43200', 'int'),
  ('user_absolute_timeout_minutes', '43200', 'int'),
  ('user_refresh_ttl_days', '30', 'int'),
  ('admin_idle_timeout_minutes', '480', 'int'),
  ('admin_absolute_timeout_minutes', '1440', 'int'),
  ('force_logout_on_security_change', 'true', 'bool'),
  ('max_failed_attempts', '5', 'int'),
  ('failed_attempt_window_minutes', '15', 'int'),
  ('lock_duration_minutes', '15', 'int'),
  ('max_repeated_lockouts', '3', 'int'),
  ('otp_request_limit', '8', 'int'),
  ('otp_verify_attempt_limit', '5', 'int'),
  ('optional_update_reminder_hours', '24', 'int'),
  ('maintenance_allow_user_ids', '', 'string');

CREATE TABLE IF NOT EXISTS system_controls (
  code VARCHAR(64) NOT NULL PRIMARY KEY,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  reason VARCHAR(500) NULL,
  changed_by CHAR(36) NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO system_controls (code, is_enabled) VALUES
  ('new_orders', 1),
  ('cod', 1),
  ('online_payments', 1),
  ('coupons', 1),
  ('registration', 1),
  ('login', 1),
  ('checkout', 1),
  ('delivery_booking', 1),
  ('notifications', 1);

CREATE TABLE IF NOT EXISTS maintenance_settings (
  id CHAR(8) NOT NULL PRIMARY KEY,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  title VARCHAR(160) NOT NULL DEFAULT 'We will be back soon',
  message VARCHAR(1000) NOT NULL DEFAULT 'DayFax is temporarily unavailable while we improve the service.',
  expected_end_at TIMESTAMP NULL,
  allow_admin TINYINT(1) NOT NULL DEFAULT 1,
  image_url VARCHAR(512) NULL,
  updated_by CHAR(36) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO maintenance_settings (id, is_enabled) VALUES ('global', 0);

CREATE TABLE IF NOT EXISTS announcements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  image_url VARCHAR(512) NULL,
  severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
  dismissible TINYINT(1) NOT NULL DEFAULT 1,
  platform ENUM('ALL', 'ANDROID', 'IOS') NOT NULL DEFAULT 'ALL',
  min_version VARCHAR(32) NULL,
  max_version VARCHAR(32) NULL,
  starts_at TIMESTAMP NULL,
  ends_at TIMESTAMP NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_announcements_active (is_active, starts_at, ends_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
