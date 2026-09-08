ALTER TABLE addresses
  ADD COLUMN full_name VARCHAR(120) NULL
    AFTER label;
