-- Per-store flag: when enabled, COD is not available for that store's items.
-- Local-shop (FOOD) cancel/return policy stays independent of this column.

ALTER TABLE stores
  ADD COLUMN online_payment_only TINYINT(1) NOT NULL DEFAULT 0
  AFTER is_popular;

-- Preserve today's behavior (FOOD shops blocked COD) until admins change it.
UPDATE stores
SET online_payment_only = 1
WHERE store_type = 'FOOD' AND deleted_at IS NULL;
