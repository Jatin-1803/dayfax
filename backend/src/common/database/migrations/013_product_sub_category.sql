-- Sheet subcategory is catalog content, not a category row.
-- Hindi twin follows the same bilingual catalog rule as name_hi.

ALTER TABLE products
  ADD COLUMN sub_category VARCHAR(120) NULL AFTER category_id,
  ADD COLUMN sub_category_hi VARCHAR(120) NULL AFTER sub_category;
