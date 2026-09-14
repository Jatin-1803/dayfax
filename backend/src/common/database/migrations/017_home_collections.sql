-- Admin-scheduled festival / seasonal product rails shown above Popular Local Shops.

CREATE TABLE IF NOT EXISTS home_collections (
  id CHAR(36) NOT NULL,
  headline VARCHAR(120) NOT NULL,
  headline_hi VARCHAR(120) NULL,
  priority INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_home_collections_active_window (is_active, start_at, end_at, priority),
  KEY idx_home_collections_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS home_collection_items (
  id CHAR(36) NOT NULL,
  collection_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_home_collection_product (collection_id, product_id),
  KEY idx_home_collection_items_order (collection_id, sort_order),
  KEY idx_home_collection_items_product (product_id),
  CONSTRAINT fk_home_collection_items_collection
    FOREIGN KEY (collection_id) REFERENCES home_collections(id),
  CONSTRAINT fk_home_collection_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
