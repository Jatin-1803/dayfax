-- Search synonyms (global concept groups) + per-product aliases + query analytics.

CREATE TABLE IF NOT EXISTS search_synonym_groups (
  id CHAR(36) NOT NULL PRIMARY KEY,
  canonical_term VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_search_synonym_groups_canonical (canonical_term),
  KEY idx_search_synonym_groups_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS search_synonym_terms (
  id CHAR(36) NOT NULL PRIMARY KEY,
  group_id CHAR(36) NOT NULL,
  term VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_search_synonym_terms_term (term),
  KEY idx_search_synonym_terms_group (group_id),
  CONSTRAINT fk_search_synonym_terms_group
    FOREIGN KEY (group_id) REFERENCES search_synonym_groups(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_search_aliases (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_id CHAR(36) NOT NULL,
  alias VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_product_search_alias (product_id, alias),
  KEY idx_product_search_aliases_alias (alias),
  CONSTRAINT fk_product_search_aliases_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS search_query_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  q VARCHAR(100) NOT NULL,
  normalized_q VARCHAR(100) NOT NULL,
  store_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  result_count INT NOT NULL DEFAULT 0,
  matched_via ENUM('direct', 'synonym', 'meili', 'fallback') NOT NULL DEFAULT 'direct',
  canonical_term VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_search_query_logs_created (created_at),
  KEY idx_search_query_logs_zero (result_count, created_at),
  KEY idx_search_query_logs_normalized (normalized_q, result_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
