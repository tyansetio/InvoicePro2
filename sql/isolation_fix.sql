-- Add store_id to import_export_logs
ALTER TABLE import_export_logs ADD COLUMN store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE;

-- Update existing logs to default to store 1 (adjust if needed)
UPDATE import_export_logs SET store_id = 1 WHERE store_id IS NULL;

-- Make store_id NOT NULL after backfilling
ALTER TABLE import_export_logs ALTER COLUMN store_id SET NOT NULL;

-- Add index for search performance
CREATE INDEX IF NOT EXISTS import_export_logs_store_id_idx ON import_export_logs(store_id);
