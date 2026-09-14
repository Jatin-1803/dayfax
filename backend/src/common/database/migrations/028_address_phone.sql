ALTER TABLE addresses
  ADD COLUMN phone_country_code VARCHAR(8) NULL AFTER full_name,
  ADD COLUMN phone VARCHAR(20) NULL AFTER phone_country_code;

-- Backfill existing addresses from the account phone when available.
UPDATE addresses a
INNER JOIN users u ON u.id = a.user_id
SET a.phone_country_code = COALESCE(u.phone_country_code, '+91'),
    a.phone = u.phone
WHERE a.phone IS NULL
  AND u.phone IS NOT NULL
  AND TRIM(u.phone) <> '';
