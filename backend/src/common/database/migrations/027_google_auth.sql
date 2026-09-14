-- Google Sign-In: optional phone, google subject + unique email

ALTER TABLE users
  MODIFY COLUMN phone_country_code VARCHAR(8) NULL,
  MODIFY COLUMN phone VARCHAR(20) NULL,
  ADD COLUMN google_sub VARCHAR(64) NULL AFTER email,
  ADD UNIQUE KEY uq_users_google_sub (google_sub),
  ADD UNIQUE KEY uq_users_email (email);
