-- Extend stores with contact, address, GPS, avatar, and popular flag for local shops.

ALTER TABLE stores
  ADD COLUMN image_url VARCHAR(512) NULL AFTER store_type,
  ADD COLUMN description VARCHAR(500) NULL AFTER image_url,
  ADD COLUMN phone_country_code VARCHAR(8) NULL AFTER description,
  ADD COLUMN phone VARCHAR(20) NULL AFTER phone_country_code,
  ADD COLUMN address_line1 VARCHAR(255) NULL AFTER phone,
  ADD COLUMN address_line2 VARCHAR(255) NULL AFTER address_line1,
  ADD COLUMN landmark VARCHAR(255) NULL AFTER address_line2,
  ADD COLUMN city VARCHAR(120) NULL AFTER landmark,
  ADD COLUMN pincode VARCHAR(12) NULL AFTER city,
  ADD COLUMN latitude DECIMAL(10,7) NULL AFTER pincode,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
  ADD COLUMN is_popular TINYINT(1) NOT NULL DEFAULT 0 AFTER longitude;

ALTER TABLE stores
  ADD KEY idx_stores_popular_active (is_popular, is_active);
