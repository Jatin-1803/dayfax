-- Distance-based delivery pricing: free-above threshold + fee slabs per zone.

ALTER TABLE delivery_zones
  ADD COLUMN free_delivery_above_paise INT NULL
    AFTER min_order_paise;

CREATE TABLE IF NOT EXISTS delivery_fee_slabs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  delivery_zone_id CHAR(36) NOT NULL,
  from_km DECIMAL(8,2) NOT NULL DEFAULT 0,
  to_km DECIMAL(8,2) NULL,
  fee_paise INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  KEY idx_slabs_zone (delivery_zone_id, deleted_at),
  CONSTRAINT fk_slabs_zone FOREIGN KEY (delivery_zone_id) REFERENCES delivery_zones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
