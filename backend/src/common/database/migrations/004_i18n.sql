-- Multilingual: UI string bundles (en/hi) + catalog Hindi columns

CREATE TABLE IF NOT EXISTS ui_translations (
  string_key VARCHAR(160) NOT NULL PRIMARY KEY,
  en_value TEXT NOT NULL,
  hi_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ui_translations_meta (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_ui_translations_meta_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ui_translations_meta (id, version)
SELECT 1, 1
WHERE NOT EXISTS (SELECT 1 FROM ui_translations_meta WHERE id = 1);

ALTER TABLE categories
  ADD COLUMN name_hi VARCHAR(120) NULL AFTER name;

ALTER TABLE products
  ADD COLUMN name_hi VARCHAR(180) NULL AFTER name,
  ADD COLUMN description_hi TEXT NULL AFTER description;

ALTER TABLE products DROP INDEX ft_products_search;
ALTER TABLE products
  ADD FULLTEXT KEY ft_products_search (name, name_hi, description, description_hi, brand);
