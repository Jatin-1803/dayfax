-- Scheduled promotional banners shown at the top of the customer Home screen.

CREATE TABLE IF NOT EXISTS home_banners (
  id CHAR(36) NOT NULL,
  title VARCHAR(120) NOT NULL,
  title_hi VARCHAR(120) NULL,
  image_url VARCHAR(512) NOT NULL,
  link_path VARCHAR(255) NULL,
  priority INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_home_banners_active_window (is_active, start_at, end_at, priority),
  KEY idx_home_banners_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO home_banners (
  id,
  title,
  title_hi,
  image_url,
  link_path,
  priority,
  is_active,
  start_at,
  end_at
)
SELECT
  'b7e4c2a1-6f3d-4a8e-9c1b-2d5e7f8a9012',
  'Groceries at your door',
  'आपके दरवाज़े पर किराना',
  '/media/catalog/banners/default-home.webp',
  '/categories',
  10,
  1,
  UTC_TIMESTAMP(),
  DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 YEAR)
WHERE NOT EXISTS (
  SELECT 1 FROM home_banners WHERE id = 'b7e4c2a1-6f3d-4a8e-9c1b-2d5e7f8a9012'
);
