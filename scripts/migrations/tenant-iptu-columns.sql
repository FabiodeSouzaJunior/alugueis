-- Migration: Add IPTU columns to tenants table
-- These columns allow tracking IPTU (property tax) values and installment options per tenant

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS iptu_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS iptu_add_to_rent BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS iptu_installments INT DEFAULT 12;
