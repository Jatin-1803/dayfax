-- Mixed carts: each line remembers its store so local-shop and regular items can sit together.
-- Stock is taken from the line store. Payment totals are unchanged.

ALTER TABLE cart_items
  ADD COLUMN store_id CHAR(36) NULL AFTER cart_id;

UPDATE cart_items ci
INNER JOIN carts c ON c.id = ci.cart_id
SET ci.store_id = c.store_id
WHERE ci.store_id IS NULL;

ALTER TABLE cart_items
  MODIFY store_id CHAR(36) NOT NULL,
  DROP INDEX uq_cart_items,
  ADD UNIQUE KEY uq_cart_items (cart_id, variant_id, store_id),
  ADD KEY idx_cart_items_store (store_id),
  ADD CONSTRAINT fk_cart_items_store FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE order_items
  ADD COLUMN store_id CHAR(36) NULL AFTER order_id;

UPDATE order_items oi
INNER JOIN orders o ON o.id = oi.order_id
SET oi.store_id = o.store_id
WHERE oi.store_id IS NULL;

ALTER TABLE order_items
  MODIFY store_id CHAR(36) NOT NULL,
  ADD KEY idx_order_items_store (store_id),
  ADD CONSTRAINT fk_order_items_store FOREIGN KEY (store_id) REFERENCES stores(id);
