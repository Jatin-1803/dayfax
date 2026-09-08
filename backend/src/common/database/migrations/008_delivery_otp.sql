-- Delivery confirmation OTP (Zepto-style handover PIN).
-- Shown only to the order owner; verified when partner marks COMPLETED.
ALTER TABLE orders
  ADD COLUMN delivery_otp CHAR(4) NULL AFTER notes,
  ADD COLUMN delivery_otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER delivery_otp;
