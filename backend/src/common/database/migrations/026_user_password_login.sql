-- Customer password login + admin OTP toggle

ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER avatar_url;

INSERT INTO system_controls (code, is_enabled)
VALUES ('login_otp', 1)
ON DUPLICATE KEY UPDATE code = code;
