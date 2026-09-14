-- Snapshot local-shop (FOOD store) policy on the order so later store-type
-- changes do not rewrite cancel, COD, or return rules.

ALTER TABLE orders
  ADD COLUMN is_local_shop TINYINT(1) NOT NULL DEFAULT 0 AFTER notes;

ALTER TABLE order_items
  ADD COLUMN is_local_shop TINYINT(1) NOT NULL DEFAULT 0 AFTER line_total_paise;

UPDATE orders o
INNER JOIN stores s ON s.id = o.store_id
SET o.is_local_shop = 1
WHERE s.store_type = 'FOOD';

UPDATE order_items oi
INNER JOIN orders o ON o.id = oi.order_id
SET oi.is_local_shop = 1
WHERE o.is_local_shop = 1;
