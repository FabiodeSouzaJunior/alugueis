-- Migration: Add payment day to tenants table
-- Keeps previous behavior compatible by defaulting existing and new tenants to day 10

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_day INT DEFAULT 10;

UPDATE tenants
   SET payment_day = 10
 WHERE payment_day IS NULL
    OR payment_day < 1
    OR payment_day > 31;
