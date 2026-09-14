-- Product cost price (CP) + historical snapshot on order items + analytics indexes/permissions.
-- Money stays INTEGER paise (project convention). NULL = unknown (legacy rows only).

ALTER TABLE product_variants
  ADD COLUMN cost_price_paise INT NULL AFTER price_paise;

ALTER TABLE order_items
  ADD COLUMN unit_cost_paise INT NULL AFTER unit_price_paise;

-- Analytics date/status scans
ALTER TABLE orders
  ADD KEY idx_orders_placed_status (placed_at, status);

ALTER TABLE return_requests
  ADD KEY idx_return_requests_order_status (order_id, status);

INSERT INTO admin_permissions (id, code, name) VALUES
  ('p0000001-0000-4000-8000-000000000032', 'analytics.view', 'View business analytics'),
  ('p0000001-0000-4000-8000-000000000033', 'analytics.export', 'Export business analytics');

-- SUPER_ADMIN already gets all permissions via seed pattern; grant to ADMIN + FINANCE_MANAGER.
INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000001', id FROM admin_permissions
WHERE code IN ('analytics.view', 'analytics.export')
  AND NOT EXISTS (
    SELECT 1 FROM admin_role_permissions arp
    WHERE arp.role_id = 'r0000001-0000-4000-8000-000000000001'
      AND arp.permission_id = admin_permissions.id
  );

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000002', id FROM admin_permissions
WHERE code IN ('analytics.view', 'analytics.export')
  AND NOT EXISTS (
    SELECT 1 FROM admin_role_permissions arp
    WHERE arp.role_id = 'r0000001-0000-4000-8000-000000000002'
      AND arp.permission_id = admin_permissions.id
  );

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'r0000001-0000-4000-8000-000000000007', id FROM admin_permissions
WHERE code IN ('analytics.view', 'analytics.export')
  AND NOT EXISTS (
    SELECT 1 FROM admin_role_permissions arp
    WHERE arp.role_id = 'r0000001-0000-4000-8000-000000000007'
      AND arp.permission_id = admin_permissions.id
  );
