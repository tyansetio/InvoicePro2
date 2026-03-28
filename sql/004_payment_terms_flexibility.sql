-- Refactor Payment Terms to allow arbitrary names and days (Removing Enum restrictions)

-- 1. Alter invoices table to change payment_terms from enum to varchar
ALTER TABLE invoices ALTER COLUMN payment_terms TYPE VARCHAR(10);
-- Set a default value if needed (already handled by Drizzle but good for DB level)
ALTER TABLE invoices ALTER COLUMN payment_terms SET DEFAULT 'custom';

-- 2. Alter payment_terms_config table to change code from enum to varchar
ALTER TABLE payment_terms_config ALTER COLUMN code TYPE VARCHAR(10);

-- 3. Drop the payment_terms enum type
DROP TYPE IF EXISTS payment_terms;
