-- Admin-manageable similar-product pins.
-- When rows exist for a product, they are returned first (by sort_order).
-- Remaining slots are filled by the automatic category/brand similarity algorithm.

CREATE TABLE IF NOT EXISTS product_similar_overrides (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  similar_product_id CHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_similar (product_id, similar_product_id),
  KEY idx_product_similar_product (product_id, is_active, sort_order),
  KEY idx_product_similar_target (similar_product_id),
  CONSTRAINT fk_product_similar_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_product_similar_target FOREIGN KEY (similar_product_id) REFERENCES products(id),
  CONSTRAINT chk_product_similar_not_self CHECK (product_id <> similar_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
