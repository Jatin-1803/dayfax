-- Link the two orders created from one mixed cart (local shop + in-house).
ALTER TABLE orders
  ADD COLUMN checkout_group_id CHAR(36) NULL AFTER is_local_shop,
  ADD KEY idx_orders_checkout_group (checkout_group_id);
