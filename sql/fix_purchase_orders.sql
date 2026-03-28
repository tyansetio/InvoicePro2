-- Fix: Add missing enum values for purchase_order_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'draft' AND enumtypid = 'purchase_order_status'::regtype) THEN
    ALTER TYPE purchase_order_status ADD VALUE 'draft' BEFORE 'pending';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sent' AND enumtypid = 'purchase_order_status'::regtype) THEN
    ALTER TYPE purchase_order_status ADD VALUE 'sent' AFTER 'draft';
  END IF;
END $$;

-- Fix: Create the missing purchase_orders table
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"purchase_order_number" varchar(50) NOT NULL CONSTRAINT "purchase_orders_purchase_order_number_key" UNIQUE,
	"supplier_name" varchar(100) NOT NULL,
	"supplier_email" varchar(100),
	"supplier_phone" varchar(50),
	"supplier_address" text,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"delivered_date" date,
	"status" purchase_order_status DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"shipping" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"supplier_id" integer,
	"use_faktur_pajak" boolean DEFAULT false NOT NULL,
	"is_prepaid" boolean DEFAULT false NOT NULL,
	"created_by_name" varchar(100)
);

-- Add foreign key constraints
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");

-- Add indexes
CREATE INDEX IF NOT EXISTS "purchase_orders_store_id_idx" ON "purchase_orders" ("store_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_id_idx" ON "purchase_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders" ("status");
CREATE INDEX IF NOT EXISTS "purchase_orders_order_date_idx" ON "purchase_orders" ("order_date");

-- Fix FK constraints that reference purchase_orders
ALTER TABLE "purchase_order_items" DROP CONSTRAINT IF EXISTS "purchase_order_items_purchase_order_id_fkey";
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;

ALTER TABLE "purchase_order_payments" DROP CONSTRAINT IF EXISTS "purchase_order_payments_purchase_order_id_fkey";
ALTER TABLE "purchase_order_payments" ADD CONSTRAINT "purchase_order_payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;
