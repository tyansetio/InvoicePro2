CREATE SCHEMA "public";
CREATE SCHEMA "drizzle";
CREATE TYPE "cash_account_type" AS ENUM('cash', 'bank_company', 'bank_personal', 'other');
CREATE TYPE "delivery_status" AS ENUM('pending', 'delivered', 'cancelled');
CREATE TYPE "delivery_type" AS ENUM('self_pickup', 'delivery', 'combination');
CREATE TYPE "goods_receipt_status" AS ENUM('draft', 'confirmed', 'partial_paid', 'paid', 'cancelled');
CREATE TYPE "invoice_delivery_status" AS ENUM('undelivered', 'partial_delivered', 'delivered');
CREATE TYPE "invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void');
CREATE TYPE "paper_size" AS ENUM('a4', 'prs', 'halfsize');
CREATE TYPE "payment_status" AS ENUM('unpaid', 'partial_paid', 'paid', 'overdue');
CREATE TYPE "payment_terms" AS ENUM('cod', 'net_7', 'net_14', 'net_30', 'custom');
CREATE TYPE "product_type" AS ENUM('standard', 'bundle');
CREATE TYPE "purchase_order_status" AS ENUM('draft', 'sent', 'pending', 'received', 'partial', 'cancelled');
CREATE TYPE "quotation_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired');
CREATE TYPE "return_doc_status" AS ENUM('pending', 'completed', 'cancelled');
CREATE TYPE "return_status" AS ENUM('none', 'pending', 'returned');
CREATE TYPE "return_type" AS ENUM('credit_note', 'refund');
CREATE TYPE "stock_adjustment_type" AS ENUM('increase', 'decrease');
CREATE TYPE "transaction_type" AS ENUM('income', 'expense');
CREATE TYPE "user_role" AS ENUM('owner', 'staff');
CREATE TABLE "account_transfers" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"from_account_id" integer NOT NULL,
	"to_account_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY,
	"store_id" integer,
	"user_id" integer,
	"user_name" text,
	"user_role" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" integer,
	"entity_label" text,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "cash_accounts" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"account_type" cash_account_type DEFAULT 'cash' NOT NULL,
	"initial_balance" numeric(15, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "categories_store_id_idx" ON "categories" ("store_id");
CREATE TABLE "client_deposits" (
	"id" serial PRIMARY KEY,
	"client_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"balance" numeric(15, 2) NOT NULL,
	"invoice_id" integer,
	"invoice_payment_id" integer,
	"description" text,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(100),
	"phone" varchar(50),
	"address" text,
	"tax_number" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"client_number" varchar(50) NOT NULL CONSTRAINT "clients_client_number_unique" UNIQUE,
	"address_link" varchar(500)
);
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY,
	"company_name" varchar(200) DEFAULT 'Mitra Indo Aluminium' NOT NULL,
	"logo_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "credit_note_usages" (
	"id" serial PRIMARY KEY,
	"return_id" integer NOT NULL,
	"invoice_payment_id" integer,
	"amount" numeric(15, 2) NOT NULL,
	"usage_type" varchar(20) DEFAULT 'payment' NOT NULL,
	"notes" text,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "delivery_note_items" (
	"id" serial PRIMARY KEY,
	"delivery_note_id" integer NOT NULL,
	"invoice_item_id" integer NOT NULL,
	"delivered_quantity" numeric(15, 2) NOT NULL,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"delivery_type" text DEFAULT 'delivered' NOT NULL
);
CREATE TABLE "delivery_notes" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"invoice_id" integer NOT NULL,
	"delivery_number" varchar(50) NOT NULL CONSTRAINT "delivery_notes_delivery_number_key" UNIQUE,
	"delivery_date" date NOT NULL,
	"status" delivery_status DEFAULT 'pending' NOT NULL,
	"vehicle_info" varchar(100),
	"driver_name" varchar(100),
	"recipient_name" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"delivery_type" text DEFAULT 'delivered' NOT NULL,
	"profit" numeric,
	"total_cost" numeric
);
CREATE TABLE "goods_receipt_items" (
	"id" serial PRIMARY KEY,
	"goods_receipt_id" integer NOT NULL,
	"purchase_order_id" integer,
	"product_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"unit_cost" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"subtotal" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"return_quantity" numeric(15, 2) DEFAULT '0',
	"return_reason" text,
	"return_status" return_status DEFAULT 'none' NOT NULL,
	"returned_quantity" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"purchase_order_item_id" integer,
	"base_cost" numeric(15, 2),
	"base_quantity" numeric(15, 2)
);
CREATE TABLE "goods_receipt_payments" (
	"id" serial PRIMARY KEY,
	"goods_receipt_id" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"reference" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cash_account_id" integer
);
CREATE TABLE "goods_receipts" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"receipt_number" varchar(50) NOT NULL CONSTRAINT "goods_receipts_receipt_number_key" UNIQUE,
	"supplier_doc_number" varchar(100),
	"supplier_id" integer,
	"supplier_name" varchar(100) NOT NULL,
	"supplier_email" varchar(100),
	"supplier_phone" varchar(50),
	"supplier_address" text,
	"receipt_date" date NOT NULL,
	"due_date" date,
	"status" goods_receipt_status DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"amount_paid" numeric(15, 2) DEFAULT '0',
	"has_returns" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "import_export_logs" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"record_count" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_details" text,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "inflow_categories" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "invoice_item_batches" (
	"id" serial PRIMARY KEY,
	"invoice_item_id" integer NOT NULL,
	"batch_id" integer NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"capital_cost" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "invoice_items" (
	"id" serial PRIMARY KEY,
	"invoice_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"subtotal" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"profit" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"product_unit_id" integer,
	"base_quantity" numeric(15, 2)
);
CREATE TABLE "invoice_payments" (
	"id" serial PRIMARY KEY,
	"invoice_id" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"credit_note_id" integer
);
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"invoice_number" varchar(50) NOT NULL CONSTRAINT "invoices_invoice_number_unique" UNIQUE,
	"client_id" integer,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" invoice_status DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"shipping" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"total_profit" numeric(15, 2) DEFAULT '0',
	"terms_and_conditions" text,
	"paper_size" paper_size DEFAULT 'a4',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"payment_terms" payment_terms DEFAULT 'net_30' NOT NULL,
	"use_faktur_pajak" boolean DEFAULT false NOT NULL,
	"delivery_type" delivery_type DEFAULT 'delivery' NOT NULL,
	"delivery_address" text,
	"delivery_address_link" text,
	"is_voided" boolean DEFAULT false NOT NULL,
	"created_by_name" varchar(100)
);
CREATE TABLE "outflow_categories" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "payment_terms_config" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"days" integer NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"code" payment_terms DEFAULT 'custom' NOT NULL
);
CREATE TABLE "payment_types" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cash_account_id" integer,
	"deduction_percentage" numeric(5, 2)
);
CREATE TABLE "print_settings" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL CONSTRAINT "print_settings_store_id_key" UNIQUE,
	"show_tax" boolean DEFAULT true NOT NULL,
	"show_discount" boolean DEFAULT true NOT NULL,
	"show_po_number" boolean DEFAULT true NOT NULL,
	"default_notes" text DEFAULT 'Items checked and verified upon delivery. Items cannot be returned.',
	"accent_color" varchar(20) DEFAULT '#000000',
	"paper_size" paper_size DEFAULT 'prs' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"quotation_notes" text,
	"invoice_notes" text,
	"delivery_note_notes" text
);
CREATE TABLE "product_batches" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"batch_number" varchar(50) NOT NULL,
	"purchase_date" date NOT NULL,
	"expiry_date" date,
	"capital_cost" numeric(15, 2) NOT NULL,
	"initial_quantity" numeric(15, 2) NOT NULL,
	"remaining_quantity" numeric(15, 2) NOT NULL,
	"supplier_name" varchar(100),
	"supplier_invoice" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"reserved_quantity" numeric(15, 2) DEFAULT '0' NOT NULL
);
CREATE TABLE "product_bundle_components" (
	"id" serial PRIMARY KEY,
	"bundle_product_id" integer NOT NULL UNIQUE,
	"component_product_id" integer NOT NULL UNIQUE,
	"quantity" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_bundle_components_bundle_product_id_component_produ_key" UNIQUE("bundle_product_id","component_product_id")
);
CREATE TABLE "product_units" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL UNIQUE,
	"unit_code" varchar(20) NOT NULL UNIQUE,
	"unit_label" varchar(50) NOT NULL,
	"conversion_factor" numeric(15, 4) NOT NULL,
	"price" numeric(15, 2),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_units_product_id_unit_code_key" UNIQUE("product_id","unit_code")
);
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
	"name" varchar(100) NOT NULL,
	"sku" varchar(50) NOT NULL,
	"description" text,
	"category_id" integer REFERENCES "categories"("id"),
	"unit" varchar(20) DEFAULT 'piece' NOT NULL,
	"current_selling_price" numeric(15, 2),
	"min_stock" integer DEFAULT 0,
	"weight" numeric(10, 2),
	"dimensions" varchar(100),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cost_price" numeric(15, 2),
	"lowest_price" numeric(15, 2),
	"product_type" product_type DEFAULT 'standard' NOT NULL,
    CONSTRAINT "products_sku_store_unique" UNIQUE("sku", "store_id")
);
CREATE INDEX "products_store_id_idx" ON "products" ("store_id");
CREATE TABLE "purchase_order_items" (
	"id" serial PRIMARY KEY,
	"purchase_order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"received_quantity" numeric(15, 2) DEFAULT '0',
	"unit_cost" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"subtotal" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"product_unit_id" integer,
	"base_quantity" numeric(15, 2),
	"base_cost" numeric(15, 2)
);
CREATE TABLE "purchase_order_payments" (
	"id" serial PRIMARY KEY,
	"purchase_order_id" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cash_account_id" integer
);
CREATE TABLE "purchase_orders" (
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
CREATE TABLE "quotation_items" (
	"id" serial PRIMARY KEY,
	"quotation_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"unit_price" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"subtotal" numeric(15, 2) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"product_unit_id" integer,
	"base_quantity" numeric(15, 2)
);
CREATE TABLE "quotations" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"quotation_number" varchar(50) NOT NULL CONSTRAINT "quotations_quotation_number_unique" UNIQUE,
	"client_id" integer,
	"issue_date" date NOT NULL,
	"expiry_date" date,
	"status" quotation_status DEFAULT 'draft' NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(15, 2) DEFAULT '0',
	"discount" numeric(15, 2) DEFAULT '0',
	"shipping" numeric(15, 2) DEFAULT '0',
	"total_amount" numeric(15, 2) NOT NULL,
	"converted_to_invoice_id" integer,
	"terms_and_conditions" text,
	"paper_size" paper_size DEFAULT 'a4',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"rejection_reason" text,
	"use_faktur_pajak" boolean DEFAULT false NOT NULL,
	"created_by_name" varchar(100),
	"delivery_address" text,
	"delivery_address_link" text
);
CREATE TABLE "return_items" (
	"id" serial PRIMARY KEY,
	"return_id" integer NOT NULL,
	"invoice_item_id" integer NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"subtotal" numeric(15, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "returns" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"return_number" varchar(50) NOT NULL CONSTRAINT "returns_return_number_key" UNIQUE,
	"invoice_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"return_date" date NOT NULL,
	"return_type" return_type NOT NULL,
	"status" return_doc_status DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"used_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_name" varchar(100)
);
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_batch_id" integer,
	"type" stock_adjustment_type NOT NULL,
	"quantity" numeric(15, 2) NOT NULL,
	"reason" text NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY,
	"name" varchar(100) NOT NULL,
	"tagline" varchar(200),
	"address" text,
	"phone" varchar(50),
	"email" varchar(100),
    "tax_number" varchar(50),
    "default_tax_rate" numeric(5, 2) DEFAULT '11',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"invoice_payment_category_id" integer,
	"goods_receipt_payment_category_id" integer,
	"npwp" varchar(50),
	"bank_name" varchar(100),
	"bank_account_number" varchar(50),
	"bank_account_name" varchar(100),
	"logo_url" text,
    "quotation_notes" text,
    "invoice_notes" text,
    "delivery_note_notes" text,
    "default_notes" text,
	"default_payment_type_id" integer,
	"default_payment_term_id" integer
);
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"supplier_number" varchar(50) NOT NULL CONSTRAINT "suppliers_supplier_number_key" UNIQUE,
	"name" varchar(100) NOT NULL,
	"email" varchar(100),
	"phone" varchar(50),
	"address" text,
	"tax_number" varchar(50),
	"contact_person" varchar(100),
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY,
	"store_id" integer NOT NULL,
	"type" transaction_type NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(50),
	"invoice_id" integer,
	"reference_number" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"account_id" integer,
	"goods_receipt_id" integer,
	"return_id" integer,
	"invoice_payment_id" integer,
	"goods_receipt_payment_id" integer,
	"purchase_order_payment_id" integer
);
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"username" varchar(100) NOT NULL CONSTRAINT "users_username_unique" UNIQUE,
	"password" varchar(100) NOT NULL,
	"full_name" varchar(100) NOT NULL,
	"email" varchar(100),
	"role" varchar(50) DEFAULT 'staff' NOT NULL,
	"store_id" integer,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"phone" varchar(50),
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE TABLE "drizzle"."__drizzle_migrations" (
	"id" serial PRIMARY KEY,
	"hash" text NOT NULL,
	"created_at" bigint
);
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "cash_accounts"("id") ON DELETE CASCADE;
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "cash_accounts"("id") ON DELETE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "client_deposits" ADD CONSTRAINT "client_deposits_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE;
ALTER TABLE "client_deposits" ADD CONSTRAINT "client_deposits_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id");
ALTER TABLE "client_deposits" ADD CONSTRAINT "client_deposits_invoice_payment_id_fkey" FOREIGN KEY ("invoice_payment_id") REFERENCES "invoice_payments"("id");
ALTER TABLE "client_deposits" ADD CONSTRAINT "client_deposits_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "credit_note_usages" ADD CONSTRAINT "credit_note_usages_invoice_payment_id_fkey" FOREIGN KEY ("invoice_payment_id") REFERENCES "invoice_payments"("id") ON DELETE CASCADE;
ALTER TABLE "credit_note_usages" ADD CONSTRAINT "credit_note_usages_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE;
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE CASCADE;
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE CASCADE;
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
ALTER TABLE "delivery_notes" ADD CONSTRAINT "delivery_notes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id");
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id");
ALTER TABLE "goods_receipt_payments" ADD CONSTRAINT "goods_receipt_payments_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE SET NULL;
ALTER TABLE "goods_receipt_payments" ADD CONSTRAINT "goods_receipt_payments_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");
ALTER TABLE "import_export_logs" ADD CONSTRAINT "import_export_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
ALTER TABLE "inflow_categories" ADD CONSTRAINT "inflow_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id");
ALTER TABLE "invoice_item_batches" ADD CONSTRAINT "invoice_item_batches_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id");
ALTER TABLE "invoice_item_batches" ADD CONSTRAINT "invoice_item_batches_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id");
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_product_unit_id_fkey" FOREIGN KEY ("product_unit_id") REFERENCES "product_units"("id");
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "returns"("id") ON DELETE SET NULL;
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "outflow_categories" ADD CONSTRAINT "outflow_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id");
ALTER TABLE "payment_terms_config" ADD CONSTRAINT "payment_terms_config_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "payment_types" ADD CONSTRAINT "payment_types_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id");
ALTER TABLE "payment_types" ADD CONSTRAINT "payment_types_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "print_settings" ADD CONSTRAINT "print_settings_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "product_bundle_components" ADD CONSTRAINT "product_bundle_components_bundle_product_id_fkey" FOREIGN KEY ("bundle_product_id") REFERENCES "products"("id") ON DELETE CASCADE;
ALTER TABLE "product_bundle_components" ADD CONSTRAINT "product_bundle_components_component_product_id_fkey" FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE CASCADE;
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "categories"("id");
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_unit_id_fkey" FOREIGN KEY ("product_unit_id") REFERENCES "product_units"("id");
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;
ALTER TABLE "purchase_order_payments" ADD CONSTRAINT "purchase_order_payments_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE SET NULL;
ALTER TABLE "purchase_order_payments" ADD CONSTRAINT "purchase_order_payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id");
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id");
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_product_unit_id_fkey" FOREIGN KEY ("product_unit_id") REFERENCES "product_units"("id");
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_to_invoice_id_invoices_id_fk" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "invoices"("id");
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE CASCADE;
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id");
ALTER TABLE "returns" ADD CONSTRAINT "returns_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;
ALTER TABLE "returns" ADD CONSTRAINT "returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_batch_id_fkey" FOREIGN KEY ("product_batch_id") REFERENCES "product_batches"("id") ON DELETE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "cash_accounts"("id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL;
CREATE INDEX "account_transfers_date_idx" ON "account_transfers" ("date");
CREATE INDEX "account_transfers_from_account_id_idx" ON "account_transfers" ("from_account_id");
CREATE UNIQUE INDEX "account_transfers_pkey" ON "account_transfers" ("id");
CREATE INDEX "account_transfers_store_id_idx" ON "account_transfers" ("store_id");
CREATE INDEX "account_transfers_to_account_id_idx" ON "account_transfers" ("to_account_id");
CREATE INDEX "activity_logs_action_idx" ON "activity_logs" ("action");
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs" ("created_at");
CREATE INDEX "activity_logs_entity_idx" ON "activity_logs" ("entity");
CREATE UNIQUE INDEX "activity_logs_pkey" ON "activity_logs" ("id");
CREATE INDEX "activity_logs_store_id_idx" ON "activity_logs" ("store_id");
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs" ("user_id");
CREATE UNIQUE INDEX "cash_accounts_pkey" ON "cash_accounts" ("id");
CREATE INDEX "cash_accounts_store_id_idx" ON "cash_accounts" ("store_id");
CREATE UNIQUE INDEX "categories_pkey" ON "categories" ("id");
CREATE INDEX "client_deposits_client_id_idx" ON "client_deposits" ("client_id");
CREATE UNIQUE INDEX "client_deposits_pkey" ON "client_deposits" ("id");
CREATE INDEX "client_deposits_store_id_idx" ON "client_deposits" ("store_id");
CREATE UNIQUE INDEX "clients_client_number_unique" ON "clients" ("client_number");
CREATE INDEX "clients_email_idx" ON "clients" ("email");
CREATE UNIQUE INDEX "clients_pkey" ON "clients" ("id");
CREATE INDEX "clients_store_id_idx" ON "clients" ("store_id");
CREATE UNIQUE INDEX "company_settings_pkey" ON "company_settings" ("id");
CREATE INDEX "credit_note_usages_invoice_payment_id_idx" ON "credit_note_usages" ("invoice_payment_id");
CREATE UNIQUE INDEX "credit_note_usages_pkey" ON "credit_note_usages" ("id");
CREATE INDEX "credit_note_usages_return_id_idx" ON "credit_note_usages" ("return_id");
CREATE INDEX "delivery_note_items_delivery_note_id_idx" ON "delivery_note_items" ("delivery_note_id");
CREATE INDEX "delivery_note_items_invoice_item_id_idx" ON "delivery_note_items" ("invoice_item_id");
CREATE UNIQUE INDEX "delivery_note_items_pkey" ON "delivery_note_items" ("id");
CREATE INDEX "delivery_notes_delivery_date_idx" ON "delivery_notes" ("delivery_date");
CREATE UNIQUE INDEX "delivery_notes_delivery_number_key" ON "delivery_notes" ("delivery_number");
CREATE INDEX "delivery_notes_invoice_id_idx" ON "delivery_notes" ("invoice_id");
CREATE UNIQUE INDEX "delivery_notes_pkey" ON "delivery_notes" ("id");
CREATE INDEX "delivery_notes_status_idx" ON "delivery_notes" ("status");
CREATE INDEX "delivery_notes_store_id_idx" ON "delivery_notes" ("store_id");
CREATE INDEX "goods_receipt_items_goods_receipt_id_idx" ON "goods_receipt_items" ("goods_receipt_id");
CREATE UNIQUE INDEX "goods_receipt_items_pkey" ON "goods_receipt_items" ("id");
CREATE INDEX "goods_receipt_items_product_id_idx" ON "goods_receipt_items" ("product_id");
CREATE INDEX "goods_receipt_items_purchase_order_id_idx" ON "goods_receipt_items" ("purchase_order_id");
CREATE INDEX "goods_receipt_items_return_status_idx" ON "goods_receipt_items" ("return_status");
CREATE INDEX "goods_receipt_payments_goods_receipt_id_idx" ON "goods_receipt_payments" ("goods_receipt_id");
CREATE INDEX "goods_receipt_payments_payment_date_idx" ON "goods_receipt_payments" ("payment_date");
CREATE UNIQUE INDEX "goods_receipt_payments_pkey" ON "goods_receipt_payments" ("id");
CREATE INDEX "goods_receipts_has_returns_idx" ON "goods_receipts" ("has_returns");
CREATE UNIQUE INDEX "goods_receipts_pkey" ON "goods_receipts" ("id");
CREATE INDEX "goods_receipts_receipt_date_idx" ON "goods_receipts" ("receipt_date");
CREATE UNIQUE INDEX "goods_receipts_receipt_number_key" ON "goods_receipts" ("receipt_number");
CREATE INDEX "goods_receipts_status_idx" ON "goods_receipts" ("status");
CREATE INDEX "goods_receipts_store_id_idx" ON "goods_receipts" ("store_id");
CREATE INDEX "goods_receipts_supplier_id_idx" ON "goods_receipts" ("supplier_id");
CREATE UNIQUE INDEX "import_export_logs_pkey" ON "import_export_logs" ("id");
CREATE UNIQUE INDEX "inflow_categories_pkey" ON "inflow_categories" ("id");
CREATE INDEX "invoice_item_batches_batch_id_idx" ON "invoice_item_batches" ("batch_id");
CREATE INDEX "invoice_item_batches_invoice_item_id_idx" ON "invoice_item_batches" ("invoice_item_id");
CREATE UNIQUE INDEX "invoice_item_batches_pkey" ON "invoice_item_batches" ("id");
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items" ("invoice_id");
CREATE UNIQUE INDEX "invoice_items_pkey" ON "invoice_items" ("id");
CREATE INDEX "invoice_items_product_id_idx" ON "invoice_items" ("product_id");
CREATE INDEX "invoice_items_product_unit_id_idx" ON "invoice_items" ("product_unit_id");
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments" ("invoice_id");
CREATE INDEX "invoice_payments_payment_date_idx" ON "invoice_payments" ("payment_date");
CREATE UNIQUE INDEX "invoice_payments_pkey" ON "invoice_payments" ("id");
CREATE INDEX "invoices_client_id_idx" ON "invoices" ("client_id");
CREATE UNIQUE INDEX "invoices_invoice_number_unique" ON "invoices" ("invoice_number");
CREATE INDEX "invoices_issue_date_idx" ON "invoices" ("issue_date");
CREATE UNIQUE INDEX "invoices_pkey" ON "invoices" ("id");
CREATE INDEX "invoices_status_idx" ON "invoices" ("status");
CREATE INDEX "invoices_store_id_idx" ON "invoices" ("store_id");
CREATE UNIQUE INDEX "outflow_categories_pkey" ON "outflow_categories" ("id");
CREATE UNIQUE INDEX "payment_terms_config_pkey" ON "payment_terms_config" ("id");
CREATE INDEX "payment_terms_config_store_id_idx" ON "payment_terms_config" ("store_id");
CREATE UNIQUE INDEX "payment_types_pkey" ON "payment_types" ("id");
CREATE INDEX "payment_types_store_id_idx" ON "payment_types" ("store_id");
CREATE UNIQUE INDEX "print_settings_pkey" ON "print_settings" ("id");
CREATE UNIQUE INDEX "print_settings_store_id_key" ON "print_settings" ("store_id");
CREATE INDEX "product_batches_batch_number_idx" ON "product_batches" ("batch_number");
CREATE UNIQUE INDEX "product_batches_pkey" ON "product_batches" ("id");
CREATE INDEX "product_batches_product_id_idx" ON "product_batches" ("product_id");
CREATE INDEX "product_batches_store_id_idx" ON "product_batches" ("store_id");
CREATE INDEX "bundle_components_bundle_id_idx" ON "product_bundle_components" ("bundle_product_id");
CREATE INDEX "bundle_components_component_id_idx" ON "product_bundle_components" ("component_product_id");
CREATE UNIQUE INDEX "product_bundle_components_bundle_product_id_component_produ_key" ON "product_bundle_components" ("bundle_product_id","component_product_id");
CREATE UNIQUE INDEX "product_bundle_components_pkey" ON "product_bundle_components" ("id");
CREATE UNIQUE INDEX "product_units_pkey" ON "product_units" ("id");
CREATE INDEX "product_units_product_id_idx" ON "product_units" ("product_id");
CREATE UNIQUE INDEX "product_units_product_id_unit_code_key" ON "product_units" ("product_id","unit_code");
CREATE INDEX "products_category_id_idx" ON "products" ("category_id");
CREATE INDEX "products_name_idx" ON "products" ("name");
CREATE UNIQUE INDEX "products_pkey" ON "products" ("id");
CREATE INDEX "products_sku_idx" ON "products" ("sku");
CREATE UNIQUE INDEX "products_sku_unique_idx" ON "products" ("sku");
CREATE UNIQUE INDEX "purchase_order_items_pkey" ON "purchase_order_items" ("id");
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items" ("product_id");
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items" ("purchase_order_id");
CREATE INDEX "purchase_order_payments_payment_date_idx" ON "purchase_order_payments" ("payment_date");
CREATE UNIQUE INDEX "purchase_order_payments_pkey" ON "purchase_order_payments" ("id");
CREATE INDEX "purchase_order_payments_purchase_order_id_idx" ON "purchase_order_payments" ("purchase_order_id");
CREATE INDEX "purchase_orders_order_date_idx" ON "purchase_orders" ("order_date");
CREATE UNIQUE INDEX "purchase_orders_pkey" ON "purchase_orders" ("id");
CREATE UNIQUE INDEX "purchase_orders_purchase_order_number_key" ON "purchase_orders" ("purchase_order_number");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" ("status");
CREATE INDEX "purchase_orders_store_id_idx" ON "purchase_orders" ("store_id");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders" ("supplier_id");
CREATE INDEX "purchase_orders_supplier_name_idx" ON "purchase_orders" ("supplier_name");
CREATE UNIQUE INDEX "quotation_items_pkey" ON "quotation_items" ("id");
CREATE INDEX "quotation_items_product_id_idx" ON "quotation_items" ("product_id");
CREATE INDEX "quotation_items_product_unit_id_idx" ON "quotation_items" ("product_unit_id");
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items" ("quotation_id");
CREATE INDEX "quotations_client_id_idx" ON "quotations" ("client_id");
CREATE INDEX "quotations_issue_date_idx" ON "quotations" ("issue_date");
CREATE UNIQUE INDEX "quotations_pkey" ON "quotations" ("id");
CREATE UNIQUE INDEX "quotations_quotation_number_unique" ON "quotations" ("quotation_number");
CREATE INDEX "quotations_status_idx" ON "quotations" ("status");
CREATE INDEX "quotations_store_id_idx" ON "quotations" ("store_id");
CREATE INDEX "return_items_invoice_item_id_idx" ON "return_items" ("invoice_item_id");
CREATE UNIQUE INDEX "return_items_pkey" ON "return_items" ("id");
CREATE INDEX "return_items_return_id_idx" ON "return_items" ("return_id");
CREATE INDEX "returns_client_id_idx" ON "returns" ("client_id");
CREATE INDEX "returns_invoice_id_idx" ON "returns" ("invoice_id");
CREATE UNIQUE INDEX "returns_pkey" ON "returns" ("id");
CREATE UNIQUE INDEX "returns_return_number_key" ON "returns" ("return_number");
CREATE INDEX "returns_return_type_idx" ON "returns" ("return_type");
CREATE INDEX "returns_status_idx" ON "returns" ("status");
CREATE INDEX "returns_store_id_idx" ON "returns" ("store_id");
CREATE UNIQUE INDEX "roles_pkey" ON "roles" ("id");
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
CREATE UNIQUE INDEX "session_pkey" ON "session" ("sid");
CREATE UNIQUE INDEX "settings_pkey" ON "settings" ("id");
CREATE UNIQUE INDEX "settings_store_key_idx" ON "settings" ("store_id","key");
CREATE INDEX "stock_adjustments_date_idx" ON "stock_adjustments" ("date");
CREATE UNIQUE INDEX "stock_adjustments_pkey" ON "stock_adjustments" ("id");
CREATE INDEX "stock_adjustments_product_batch_id_idx" ON "stock_adjustments" ("product_batch_id");
CREATE INDEX "stock_adjustments_product_id_idx" ON "stock_adjustments" ("product_id");
CREATE INDEX "stock_adjustments_store_id_idx" ON "stock_adjustments" ("store_id");
CREATE UNIQUE INDEX "stores_pkey" ON "stores" ("id");
CREATE INDEX "suppliers_email_idx" ON "suppliers" ("email");
CREATE UNIQUE INDEX "suppliers_pkey" ON "suppliers" ("id");
CREATE INDEX "suppliers_store_id_idx" ON "suppliers" ("store_id");
CREATE UNIQUE INDEX "suppliers_supplier_number_idx" ON "suppliers" ("supplier_number");
CREATE UNIQUE INDEX "suppliers_supplier_number_key" ON "suppliers" ("supplier_number");
CREATE INDEX "transactions_account_id_idx" ON "transactions" ("account_id");
CREATE INDEX "transactions_date_idx" ON "transactions" ("date");
CREATE INDEX "transactions_invoice_id_idx" ON "transactions" ("invoice_id");
CREATE UNIQUE INDEX "transactions_pkey" ON "transactions" ("id");
CREATE INDEX "transactions_store_id_idx" ON "transactions" ("store_id");
CREATE INDEX "transactions_type_idx" ON "transactions" ("type");
CREATE UNIQUE INDEX "users_pkey" ON "users" ("id");
CREATE UNIQUE INDEX "users_username_unique" ON "users" ("username");
CREATE UNIQUE INDEX "__drizzle_migrations_pkey" ON "drizzle"."__drizzle_migrations" ("id");