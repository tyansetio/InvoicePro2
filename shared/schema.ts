import { pgTable, serial, varchar, text, timestamp, numeric, integer, pgEnum, boolean, date, foreignKey, uniqueIndex, index, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'void']);
// Payment status for invoices (calculated automatically)
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partial_paid', 'paid', 'overdue']);
// Invoice delivery status (calculated automatically based on delivery notes)
export const invoiceDeliveryStatusEnum = pgEnum('invoice_delivery_status', ['undelivered', 'partial_delivered', 'delivered']);
export const quotationStatusEnum = pgEnum('quotation_status', ['draft', 'sent', 'accepted', 'rejected', 'expired']);
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', ['draft', 'pending', 'partial', 'received', 'cancelled']);
export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense']);
export const paperSizeEnum = pgEnum('paper_size', ['a4', 'prs', 'halfsize']);
export const productTypeEnum = pgEnum('product_type', ['standard', 'bundle']);
export const cashAccountTypeEnum = pgEnum('cash_account_type', ['cash', 'bank_company', 'bank_personal', 'other']);
export const goodsReceiptStatusEnum = pgEnum('goods_receipt_status', ['draft', 'confirmed', 'partial_paid', 'paid', 'cancelled']);
export const returnStatusEnum = pgEnum('return_status', ['none', 'pending', 'returned']);
export const deliveryTypeEnum = pgEnum('delivery_type', ['self_pickup', 'delivery', 'combination']);

// Role enum for users (kept for backwards compatibility, but role column is now varchar)
export const userRoleEnum = pgEnum('user_role', ['owner', 'staff']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 100 }).notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }),
  role: varchar("role", { length: 50 }).default("staff").notNull(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'set null' }),
  permissions: text("permissions").array().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Stores table
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  tagline: varchar("tagline", { length: 200 }),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 100 }),
  taxNumber: varchar("tax_number", { length: 50 }),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 }).default("11"),
  npwp: varchar("npwp", { length: 50 }),
  bankName: varchar("bank_name", { length: 100 }),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }),
  bankAccountName: varchar("bank_account_name", { length: 100 }),
  logoUrl: text("logo_url"),
  quotationNotes: text("quotation_notes"),
  invoiceNotes: text("invoice_notes"),
  deliveryNoteNotes: text("delivery_note_notes"),
  defaultNotes: text("default_notes"),
  isActive: boolean("is_active").default(true).notNull(),
  invoicePaymentCategoryId: integer("invoice_payment_category_id"),
  goodsReceiptPaymentCategoryId: integer("goods_receipt_payment_category_id"),
  defaultPaymentTypeId: integer("default_payment_type_id"),
  defaultPaymentTermId: integer("default_payment_term_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Custom Roles table for role-based access control
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  permissions: text("permissions").array().default([]).notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Cash Accounts table (for multi-account cash management)
export const cashAccounts = pgTable("cash_accounts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  accountType: cashAccountTypeEnum("account_type").default("cash").notNull(),
  initialBalance: numeric("initial_balance", { precision: 15, scale: 2 }).default("0").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("cash_accounts_store_id_idx").on(table.storeId)
  };
});

// Account Transfers table (for transfers between cash accounts)
export const accountTransfers = pgTable("account_transfers", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  fromAccountId: integer("from_account_id").references(() => cashAccounts.id, { onDelete: 'cascade' }).notNull(),
  toAccountId: integer("to_account_id").references(() => cashAccounts.id, { onDelete: 'cascade' }).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("account_transfers_store_id_idx").on(table.storeId),
    fromAccountIdIdx: index("account_transfers_from_account_id_idx").on(table.fromAccountId),
    toAccountIdIdx: index("account_transfers_to_account_id_idx").on(table.toAccountId),
    dateIdx: index("account_transfers_date_idx").on(table.date)
  };
});

// Clients/customers table
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  clientNumber: varchar("client_number", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  addressLink: varchar("address_link", { length: 500 }),
  taxNumber: varchar("tax_number", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("clients_store_id_idx").on(table.storeId),
    emailIdx: index("clients_email_idx").on(table.email),
    clientNumberIdx: uniqueIndex("clients_client_number_idx").on(table.clientNumber)
  };
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  supplierNumber: varchar("supplier_number", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  taxNumber: varchar("tax_number", { length: 50 }),
  contactPerson: varchar("contact_person", { length: 100 }),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("suppliers_store_id_idx").on(table.storeId),
    emailIdx: index("suppliers_email_idx").on(table.email),
    supplierNumberIdx: uniqueIndex("suppliers_supplier_number_idx").on(table.supplierNumber)
  };
});

// Categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("categories_store_id_idx").on(table.storeId)
  };
});

export const inflowCategories = pgTable("inflow_categories", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const outflowCategories = pgTable("outflow_categories", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  sku: varchar("sku", { length: 50 }).notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => categories.id),
  productType: productTypeEnum("product_type").default("standard").notNull(), // standard or bundle
  unit: varchar("unit", { length: 20 }).default("piece").notNull(), // Base unit: piece, meter, kg, etc.
  currentSellingPrice: numeric("current_selling_price", { precision: 15, scale: 2 }),
  costPrice: numeric("cost_price", { precision: 15, scale: 2 }),
  lowestPrice: numeric("lowest_price", { precision: 15, scale: 2 }),
  minStock: integer("min_stock").default(0),
  weight: numeric("weight", { precision: 10, scale: 2 }),
  dimensions: varchar("dimensions", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    skuStoreIdx: uniqueIndex("products_sku_store_unique_idx").on(table.sku, table.storeId),
    storeIdIdx: index("products_store_id_idx").on(table.storeId),
    categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    nameIdx: index("products_name_idx").on(table.name),
    productTypeIdx: index("products_product_type_idx").on(table.productType)
  };
});

// Product bundle components table - defines which products make up a bundle
export const productBundleComponents = pgTable("product_bundle_components", {
  id: serial("id").primaryKey(),
  bundleProductId: integer("bundle_product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  componentProductId: integer("component_product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(), // How many of this component per bundle
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    bundleProductIdIdx: index("bundle_components_bundle_id_idx").on(table.bundleProductId),
    componentProductIdIdx: index("bundle_components_component_id_idx").on(table.componentProductId),
    uniqueComponent: uniqueIndex("bundle_components_unique_idx").on(table.bundleProductId, table.componentProductId)
  };
});

// Product units table - defines multiple units for a product (multi-unit conversion)
export const productUnits = pgTable("product_units", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  unitCode: varchar("unit_code", { length: 20 }).notNull(), // e.g., "pcs", "box", "pack"
  unitLabel: varchar("unit_label", { length: 50 }).notNull(), // Display name: "Piece", "Box", "Pack"
  conversionFactor: numeric("conversion_factor", { precision: 15, scale: 4 }).notNull(), // How many base units in this unit (e.g., 1000 for box = 1000 pcs)
  price: numeric("price", { precision: 15, scale: 2 }), // Selling price for this unit
  isDefault: boolean("is_default").default(false).notNull(), // Is this the default selling unit?
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    productIdIdx: index("product_units_product_id_idx").on(table.productId),
    uniqueUnit: uniqueIndex("product_units_unique_idx").on(table.productId, table.unitCode)
  };
});

// Product batches table
export const productBatches = pgTable("product_batches", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  batchNumber: varchar("batch_number", { length: 50 }).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  expiryDate: date("expiry_date"),
  capitalCost: numeric("capital_cost", { precision: 15, scale: 2 }).notNull(), // Per unit capital cost
  initialQuantity: numeric("initial_quantity", { precision: 15, scale: 2 }).notNull(),
  remainingQuantity: numeric("remaining_quantity", { precision: 15, scale: 2 }).notNull(),
  reservedQuantity: numeric("reserved_quantity", { precision: 15, scale: 2 }).default("0").notNull(), // Quantity reserved for paid invoices awaiting delivery
  supplierName: varchar("supplier_name", { length: 100 }),
  supplierInvoice: varchar("supplier_invoice", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    productIdIdx: index("product_batches_product_id_idx").on(table.productId),
    storeIdIdx: index("product_batches_store_id_idx").on(table.storeId),
    batchNumberIdx: index("product_batches_batch_number_idx").on(table.batchNumber)
  };
});

// Payment terms enum (REMOVED: replaced by varchar for flexibility)
// export const paymentTermsEnum = pgEnum("payment_terms", ["cod", "net_7", "net_14", "net_30", "custom"]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  clientId: integer("client_id").references(() => clients.id),
  paymentTerms: varchar("payment_terms", { length: 50 }).default("net_30").notNull(),
  issueDate: date("issue_date").notNull(),
  dueDate: date("due_date").notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  isVoided: boolean("is_voided").default(false).notNull(),
  useFakturPajak: boolean("use_faktur_pajak").default(false).notNull(),
  deliveryType: deliveryTypeEnum("delivery_type").default("delivery").notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  shipping: numeric("shipping", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  totalProfit: numeric("total_profit", { precision: 15, scale: 2 }).default("0"),
  termsAndConditions: text("terms_and_conditions"),
  paperSize: paperSizeEnum("paper_size").default("a4"),
  notes: text("notes"),
  deliveryAddress: text("delivery_address"),
  deliveryAddressLink: text("delivery_address_link"),
  createdByName: varchar("created_by_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("invoices_store_id_idx").on(table.storeId),
    clientIdIdx: index("invoices_client_id_idx").on(table.clientId),
    statusIdx: index("invoices_status_idx").on(table.status),
    issueDateIdx: index("invoices_issue_date_idx").on(table.issueDate)
  };
});

// Invoice items table
export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  productUnitId: integer("product_unit_id").references(() => productUnits.id), // For multi-unit products
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(), // Quantity in selected unit
  baseQuantity: numeric("base_quantity", { precision: 15, scale: 2 }), // Quantity converted to base unit (for stock deduction)
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  profit: numeric("profit", { precision: 15, scale: 2 }).default("0"), // Calculated profit for this item
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    invoiceIdIdx: index("invoice_items_invoice_id_idx").on(table.invoiceId),
    productIdIdx: index("invoice_items_product_id_idx").on(table.productId),
    productUnitIdIdx: index("invoice_items_product_unit_id_idx").on(table.productUnitId)
  };
});

// Invoice item batches (tracks which batches were used for an invoice item)
export const invoiceItemBatches = pgTable("invoice_item_batches", {
  id: serial("id").primaryKey(),
  invoiceItemId: integer("invoice_item_id").references(() => invoiceItems.id, { onDelete: 'cascade' }).notNull(),
  batchId: integer("batch_id").references(() => productBatches.id).notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(),
  capitalCost: numeric("capital_cost", { precision: 15, scale: 2 }).notNull(), // Historical capital cost at time of sale
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    invoiceItemIdIdx: index("invoice_item_batches_invoice_item_id_idx").on(table.invoiceItemId),
    batchIdIdx: index("invoice_item_batches_batch_id_idx").on(table.batchId)
  };
});

// Invoice payments table
export const invoicePayments = pgTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentType: varchar("payment_type", { length: 50 }).notNull(), // Cash, Check, Card, Bank Transfer, Credit Note, etc.
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  creditNoteId: integer("credit_note_id").references(() => returns.id, { onDelete: 'set null' }), // Link to credit note if payment type is Credit Note
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    invoiceIdIdx: index("invoice_payments_invoice_id_idx").on(table.invoiceId),
    paymentDateIdx: index("invoice_payments_payment_date_idx").on(table.paymentDate),
    creditNoteIdIdx: index("invoice_payments_credit_note_id_idx").on(table.creditNoteId)
  };
});

// Delivery status enum
export const deliveryStatusEnum = pgEnum('delivery_status', ['pending', 'delivered', 'cancelled']);

// Delivery Notes table (Surat Jalan)
export const deliveryNotes = pgTable("delivery_notes", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  deliveryNumber: varchar("delivery_number", { length: 50 }).notNull().unique(),
  deliveryDate: date("delivery_date").notNull(),
  deliveryType: text("delivery_type").default('delivered').notNull(), // 'delivered' or 'self_pickup'
  status: deliveryStatusEnum("status").default("pending").notNull(),
  vehicleInfo: varchar("vehicle_info", { length: 100 }),
  driverName: varchar("driver_name", { length: 100 }),
  recipientName: varchar("recipient_name", { length: 100 }),
  notes: text("notes"),
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }), // FIFO cost calculated on delivery
  profit: numeric("profit", { precision: 15, scale: 2 }), // Revenue - FIFO cost
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("delivery_notes_store_id_idx").on(table.storeId),
    invoiceIdIdx: index("delivery_notes_invoice_id_idx").on(table.invoiceId),
    deliveryDateIdx: index("delivery_notes_delivery_date_idx").on(table.deliveryDate),
    statusIdx: index("delivery_notes_status_idx").on(table.status)
  };
});

// Delivery Note Items table
export const deliveryNoteItems = pgTable("delivery_note_items", {
  id: serial("id").primaryKey(),
  deliveryNoteId: integer("delivery_note_id").references(() => deliveryNotes.id, { onDelete: 'cascade' }).notNull(),
  invoiceItemId: integer("invoice_item_id").references(() => invoiceItems.id, { onDelete: 'cascade' }).notNull(),
  deliveredQuantity: numeric("delivered_quantity", { precision: 15, scale: 2 }).notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    deliveryNoteIdIdx: index("delivery_note_items_delivery_note_id_idx").on(table.deliveryNoteId),
    invoiceItemIdIdx: index("delivery_note_items_invoice_item_id_idx").on(table.invoiceItemId)
  };
});

// Quotations table
export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  quotationNumber: varchar("quotation_number", { length: 50 }).notNull().unique(),
  clientId: integer("client_id").references(() => clients.id),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date"),
  status: quotationStatusEnum("status").default("draft").notNull(),
  useFakturPajak: boolean("use_faktur_pajak").default(false).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  shipping: numeric("shipping", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  convertedToInvoiceId: integer("converted_to_invoice_id").references(() => invoices.id),
  termsAndConditions: text("terms_and_conditions"),
  paperSize: paperSizeEnum("paper_size").default("a4"),
  notes: text("notes"),
  deliveryAddress: text("delivery_address"),
  deliveryAddressLink: text("delivery_address_link"),
  rejectionReason: text("rejection_reason"),
  createdByName: varchar("created_by_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("quotations_store_id_idx").on(table.storeId),
    clientIdIdx: index("quotations_client_id_idx").on(table.clientId),
    statusIdx: index("quotations_status_idx").on(table.status),
    issueDateIdx: index("quotations_issue_date_idx").on(table.issueDate)
  };
});

// Quotation items table
export const quotationItems = pgTable("quotation_items", {
  id: serial("id").primaryKey(),
  quotationId: integer("quotation_id").references(() => quotations.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  productUnitId: integer("product_unit_id").references(() => productUnits.id), // For multi-unit products
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(), // Quantity in selected unit
  baseQuantity: numeric("base_quantity", { precision: 15, scale: 2 }), // Quantity converted to base unit
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    quotationIdIdx: index("quotation_items_quotation_id_idx").on(table.quotationId),
    productIdIdx: index("quotation_items_product_id_idx").on(table.productId),
    productUnitIdIdx: index("quotation_items_product_unit_id_idx").on(table.productUnitId)
  };
});

// Transactions table
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  accountId: integer("account_id").references(() => cashAccounts.id),
  type: transactionTypeEnum("type").notNull(),
  date: date("date").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  invoicePaymentId: integer("invoice_payment_id"),
  goodsReceiptId: integer("goods_receipt_id"),
  goodsReceiptPaymentId: integer("goods_receipt_payment_id"),
  purchaseOrderPaymentId: integer("purchase_order_payment_id"),
  returnId: integer("return_id"),
  referenceNumber: varchar("reference_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("transactions_store_id_idx").on(table.storeId),
    accountIdIdx: index("transactions_account_id_idx").on(table.accountId),
    typeIdx: index("transactions_type_idx").on(table.type),
    dateIdx: index("transactions_date_idx").on(table.date),
    invoiceIdIdx: index("transactions_invoice_id_idx").on(table.invoiceId),
    invoicePaymentIdIdx: index("transactions_invoice_payment_id_idx").on(table.invoicePaymentId),
    goodsReceiptPaymentIdIdx: index("transactions_goods_receipt_payment_id_idx").on(table.goodsReceiptPaymentId),
    purchaseOrderPaymentIdIdx: index("transactions_purchase_order_payment_id_idx").on(table.purchaseOrderPaymentId)
  };
});

// Stock Adjustment type enum
export const stockAdjustmentTypeEnum = pgEnum('stock_adjustment_type', ['increase', 'decrease']);

// Stock Adjustments table - for manual stock corrections
export const stockAdjustments = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  productBatchId: integer("product_batch_id").references(() => productBatches.id, { onDelete: 'cascade' }),
  type: stockAdjustmentTypeEnum("type").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("stock_adjustments_store_id_idx").on(table.storeId),
    productIdIdx: index("stock_adjustments_product_id_idx").on(table.productId),
    productBatchIdIdx: index("stock_adjustments_product_batch_id_idx").on(table.productBatchId),
    dateIdx: index("stock_adjustments_date_idx").on(table.date)
  };
});

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  purchaseOrderNumber: varchar("purchase_order_number", { length: 50 }).notNull().unique(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierName: varchar("supplier_name", { length: 100 }).notNull(),
  supplierEmail: varchar("supplier_email", { length: 100 }),
  supplierPhone: varchar("supplier_phone", { length: 50 }),
  supplierAddress: text("supplier_address"),
  orderDate: date("order_date").notNull(),
  expectedDeliveryDate: date("expected_delivery_date"),
  deliveredDate: date("delivered_date"),
  status: purchaseOrderStatusEnum("status").default("draft").notNull(),
  useFakturPajak: boolean("use_faktur_pajak").default(false).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  shipping: numeric("shipping", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  isPrepaid: boolean("is_prepaid").default(false).notNull(),
  createdByName: varchar("created_by_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("purchase_orders_store_id_idx").on(table.storeId),
    supplierIdIdx: index("purchase_orders_supplier_id_idx").on(table.supplierId),
    statusIdx: index("purchase_orders_status_idx").on(table.status),
    orderDateIdx: index("purchase_orders_order_date_idx").on(table.orderDate),
    supplierNameIdx: index("purchase_orders_supplier_name_idx").on(table.supplierName)
  };
});

// Purchase Order Payments table (for prepaid POs)
export const purchaseOrderPayments = pgTable("purchase_order_payments", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id, { onDelete: 'cascade' }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentType: varchar("payment_type", { length: 50 }).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  cashAccountId: integer("cash_account_id").references(() => cashAccounts.id, { onDelete: 'set null' }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    purchaseOrderIdIdx: index("purchase_order_payments_purchase_order_id_idx").on(table.purchaseOrderId),
    paymentDateIdx: index("purchase_order_payments_payment_date_idx").on(table.paymentDate),
    cashAccountIdIdx: index("purchase_order_payments_cash_account_id_idx").on(table.cashAccountId)
  };
});

// Purchase Order Items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id, { onDelete: 'cascade' }).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  productUnitId: integer("product_unit_id").references(() => productUnits.id), // For multi-unit products
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(), // Quantity in selected unit
  baseQuantity: numeric("base_quantity", { precision: 15, scale: 2 }), // Quantity converted to base unit
  receivedQuantity: numeric("received_quantity", { precision: 15, scale: 2 }).default("0"), // Received in base unit
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(), // Cost per selected unit
  baseCost: numeric("base_cost", { precision: 15, scale: 2 }), // Cost per base unit (auto-calculated)
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    purchaseOrderIdIdx: index("purchase_order_items_purchase_order_id_idx").on(table.purchaseOrderId),
    productIdIdx: index("purchase_order_items_product_id_idx").on(table.productId)
  };
});

// Goods Receipt table (incoming inventory invoice/delivery note from suppliers)
export const goodsReceipts = pgTable("goods_receipts", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  receiptNumber: varchar("receipt_number", { length: 50 }).notNull().unique(),
  supplierDocNumber: varchar("supplier_doc_number", { length: 100 }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  supplierName: varchar("supplier_name", { length: 100 }).notNull(),
  supplierEmail: varchar("supplier_email", { length: 100 }),
  supplierPhone: varchar("supplier_phone", { length: 50 }),
  supplierAddress: text("supplier_address"),
  receiptDate: date("receipt_date").notNull(),
  dueDate: date("due_date"),
  status: goodsReceiptStatusEnum("status").default("draft").notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default("0"),
  hasReturns: boolean("has_returns").default(false).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("goods_receipts_store_id_idx").on(table.storeId),
    supplierIdIdx: index("goods_receipts_supplier_id_idx").on(table.supplierId),
    statusIdx: index("goods_receipts_status_idx").on(table.status),
    receiptDateIdx: index("goods_receipts_receipt_date_idx").on(table.receiptDate),
    hasReturnsIdx: index("goods_receipts_has_returns_idx").on(table.hasReturns)
  };
});

// Goods Receipt Items table
export const goodsReceiptItems = pgTable("goods_receipt_items", {
  id: serial("id").primaryKey(),
  goodsReceiptId: integer("goods_receipt_id").references(() => goodsReceipts.id, { onDelete: 'cascade' }).notNull(),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  purchaseOrderItemId: integer("purchase_order_item_id").references(() => purchaseOrderItems.id),
  productId: integer("product_id").references(() => products.id).notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 15, scale: 2 }).notNull(),
  baseCost: numeric("base_cost", { precision: 15, scale: 2 }),
  baseQuantity: numeric("base_quantity", { precision: 15, scale: 2 }),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: numeric("tax_amount", { precision: 15, scale: 2 }).default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  returnQuantity: numeric("return_quantity", { precision: 15, scale: 2 }).default("0"),
  returnReason: text("return_reason"),
  returnStatus: returnStatusEnum("return_status").default("none").notNull(),
  returnedQuantity: numeric("returned_quantity", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    goodsReceiptIdIdx: index("goods_receipt_items_goods_receipt_id_idx").on(table.goodsReceiptId),
    purchaseOrderIdIdx: index("goods_receipt_items_purchase_order_id_idx").on(table.purchaseOrderId),
    productIdIdx: index("goods_receipt_items_product_id_idx").on(table.productId),
    returnStatusIdx: index("goods_receipt_items_return_status_idx").on(table.returnStatus)
  };
});

// Goods Receipt Payments table
export const goodsReceiptPayments = pgTable("goods_receipt_payments", {
  id: serial("id").primaryKey(),
  goodsReceiptId: integer("goods_receipt_id").references(() => goodsReceipts.id, { onDelete: 'cascade' }).notNull(),
  paymentDate: date("payment_date").notNull(),
  paymentType: varchar("payment_type", { length: 50 }).notNull(),
  cashAccountId: integer("cash_account_id").references(() => cashAccounts.id, { onDelete: 'set null' }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  reference: varchar("reference", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    goodsReceiptIdIdx: index("goods_receipt_payments_goods_receipt_id_idx").on(table.goodsReceiptId),
    paymentDateIdx: index("goods_receipt_payments_payment_date_idx").on(table.paymentDate),
    cashAccountIdIdx: index("goods_receipt_payments_cash_account_id_idx").on(table.cashAccountId)
  };
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  key: varchar("key", { length: 100 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeKeyIdx: uniqueIndex("settings_store_key_idx").on(table.storeId, table.key)
  };
});

// Print Settings table - only print-specific preferences
export const printSettings = pgTable("print_settings", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull().unique(),
  showTax: boolean("show_tax").default(true).notNull(),
  showDiscount: boolean("show_discount").default(true).notNull(),
  showPONumber: boolean("show_po_number").default(true).notNull(),
  defaultNotes: text("default_notes").default("Items checked and verified upon delivery. Items cannot be returned."),
  quotationNotes: text("quotation_notes"),
  invoiceNotes: text("invoice_notes"),
  deliveryNoteNotes: text("delivery_note_notes"),
  accentColor: varchar("accent_color", { length: 20 }).default("#000000"),
  paperSize: paperSizeEnum("paper_size").default("prs").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Payment Types table
export const paymentTypes = pgTable("payment_types", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  cashAccountId: integer("cash_account_id"),
  deductionPercentage: decimal("deduction_percentage", { precision: 5, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("payment_types_store_id_idx").on(table.storeId)
  };
});

// Payment Terms table (settings for configurable payment terms)
export const paymentTermsConfig = pgTable("payment_terms_config", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  days: integer("days").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("payment_terms_config_store_id_idx").on(table.storeId)
  };
});

// Import/Export Logs
export const importExportLogs = pgTable("import_export_logs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // import or export
  entityType: varchar("entity_type", { length: 50 }).notNull(), // products, clients, etc.
  filename: varchar("filename", { length: 255 }).notNull(),
  recordCount: integer("record_count").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // completed, failed, partial
  errorDetails: text("error_details"),
  completedAt: timestamp("completed_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("import_export_logs_store_id_idx").on(table.storeId),
    userIdIdx: index("import_export_logs_user_id_idx").on(table.userId)
  };
});

// Returns/Credit Notes enums and tables
export const returnTypeEnum = pgEnum('return_type', ['credit_note', 'refund']);
export const returnDocStatusEnum = pgEnum('return_doc_status', ['pending', 'completed', 'cancelled']);

// Returns table (Retur)
export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  returnNumber: varchar("return_number", { length: 50 }).notNull().unique(),
  invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  clientId: integer("client_id").references(() => clients.id).notNull(),
  returnDate: date("return_date").notNull(),
  returnType: returnTypeEnum("return_type").notNull(),
  status: returnDocStatusEnum("status").default("pending").notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  usedAmount: numeric("used_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  notes: text("notes"),
  createdByName: varchar("created_by_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("returns_store_id_idx").on(table.storeId),
    invoiceIdIdx: index("returns_invoice_id_idx").on(table.invoiceId),
    clientIdIdx: index("returns_client_id_idx").on(table.clientId),
    returnTypeIdx: index("returns_return_type_idx").on(table.returnType),
    statusIdx: index("returns_status_idx").on(table.status)
  };
});

// Return Items table
export const returnItems = pgTable("return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").references(() => returns.id, { onDelete: 'cascade' }).notNull(),
  invoiceItemId: integer("invoice_item_id").references(() => invoiceItems.id, { onDelete: 'cascade' }).notNull(),
  quantity: numeric("quantity", { precision: 15, scale: 2 }).notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    returnIdIdx: index("return_items_return_id_idx").on(table.returnId),
    invoiceItemIdIdx: index("return_items_invoice_item_id_idx").on(table.invoiceItemId)
  };
});

// Credit Note Usages table (tracking how credit notes are spent)
export const creditNoteUsages = pgTable("credit_note_usages", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").references(() => returns.id, { onDelete: 'cascade' }).notNull(),
  invoicePaymentId: integer("invoice_payment_id").references(() => invoicePayments.id, { onDelete: 'cascade' }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  usageType: varchar("usage_type", { length: 20 }).default("payment").notNull(), // payment, refund
  notes: text("notes"),
  usedAt: timestamp("used_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    returnIdIdx: index("credit_note_usages_return_id_idx").on(table.returnId),
    invoicePaymentIdIdx: index("credit_note_usages_invoice_payment_id_idx").on(table.invoicePaymentId)
  };
});

// Client Deposits table (tracking overpayment deposits for future use)
export const clientDeposits = pgTable("client_deposits", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'deposit' or 'usage'
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull(),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  invoicePaymentId: integer("invoice_payment_id").references(() => invoicePayments.id),
  description: text("description"),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    clientIdIdx: index("client_deposits_client_id_idx").on(table.clientId),
    storeIdIdx: index("client_deposits_store_id_idx").on(table.storeId)
  };
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").references(() => stores.id, { onDelete: 'cascade' }),
  userId: integer("user_id"),
  userName: text("user_name"),
  userRole: text("user_role"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  entityLabel: text("entity_label"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    storeIdIdx: index("activity_logs_store_id_idx").on(table.storeId),
    userIdIdx: index("activity_logs_user_id_idx").on(table.userId),
    actionIdx: index("activity_logs_action_idx").on(table.action),
    entityIdx: index("activity_logs_entity_idx").on(table.entity),
    createdAtIdx: index("activity_logs_created_at_idx").on(table.createdAt)
  };
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Define available permissions for role-based access control
export const AVAILABLE_PERMISSIONS = [
  'products.view',
  'products.create',
  'products.edit',
  'products.delete',
  'products.stock_adjust',
  'products.import',
  'invoices.view',
  'invoices.create',
  'invoices.edit',
  'invoices.print',
  'invoices.payment',
  'quotations.view',
  'quotations.create',
  'quotations.edit',
  'quotations.delete',
  'quotations.print',
  'purchase_orders.view',
  'purchase_orders.create',
  'purchase_orders.edit',
  'purchase_orders.delete',
  'purchase_orders.print',
  'goods_receipts.view',
  'goods_receipts.create',
  'goods_receipts.edit',
  'goods_receipts.delete',
  'goods_receipts.payment',
  'delivery_notes.view',
  'delivery_notes.create',
  'delivery_notes.edit',
  'delivery_notes.delete',
  'delivery_notes.print',
  'delivery_notes.update_status',
  'returns.view',
  'returns.create',
  'returns.edit',
  'returns.delete',
  'returns.print',
  'transactions.view',
  'transactions.create',
  'transactions.edit',
  'transactions.delete',
  'transactions.export',
  'clients.view',
  'clients.create',
  'clients.edit',
  'clients.delete',
  'suppliers.view',
  'suppliers.create',
  'suppliers.edit',
  'suppliers.delete',
  'reports.view',
  'settings.view',
  'settings.edit',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
] as const;

export type Permission = typeof AVAILABLE_PERMISSIONS[number];

// Define the insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });

// Define safe update schemas for user endpoints
export const updateUserProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email().max(100).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
});

export const updateStoreIdentitySchema = z.object({
  name: z.string().max(100).optional(),
  tagline: z.string().max(200).optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(100).optional().or(z.literal("")),
  taxNumber: z.string().max(50).optional(),
  defaultTaxRate: z.string().optional(),
  logoUrl: z.string().max(500).optional(),
  quotationNotes: z.string().optional(),
  invoiceNotes: z.string().optional(),
  deliveryNoteNotes: z.string().optional(),
  defaultNotes: z.string().optional(),
});

export const updateUserPaymentSchema = z.object({
  // Payment-related fields can be added here as needed
  // For now, this is a placeholder schema
});
export const insertStoreSchema = createInsertSchema(stores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSchema = createInsertSchema(clients).omit({ 
  id: true, 
  clientNumber: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  storeId: z.number().optional()
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ 
  id: true, 
  supplierNumber: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  storeId: z.number().optional()
});
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  storeId: z.number().optional()
});
export const insertInflowCategorySchema = createInsertSchema(inflowCategories).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  storeId: z.number().optional()
});
export const insertOutflowCategorySchema = createInsertSchema(outflowCategories).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  storeId: z.number().optional()
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductBundleComponentSchema = createInsertSchema(productBundleComponents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductUnitSchema = createInsertSchema(productUnits).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductBatchSchema = createInsertSchema(productBatches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, invoiceNumber: true, createdAt: true, updatedAt: true });
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInvoiceItemBatchSchema = createInsertSchema(invoiceItemBatches).omit({ id: true, createdAt: true });
export const insertQuotationSchema = createInsertSchema(quotations).omit({ id: true, quotationNumber: true, createdAt: true, updatedAt: true });
export const insertQuotationItemSchema = createInsertSchema(quotationItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCashAccountSchema = createInsertSchema(cashAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAccountTransferSchema = createInsertSchema(accountTransfers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStockAdjustmentSchema = createInsertSchema(stockAdjustments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, purchaseOrderNumber: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseOrderPaymentSchema = createInsertSchema(purchaseOrderPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPrintSettingsSchema = createInsertSchema(printSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertImportExportLogSchema = createInsertSchema(importExportLogs).omit({ id: true, createdAt: true });
export const insertPaymentTypeSchema = createInsertSchema(paymentTypes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentTermSchema = createInsertSchema(paymentTermsConfig).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
}).extend({
  code: z.string().optional()
});
export const insertDeliveryNoteSchema = createInsertSchema(deliveryNotes).omit({ id: true, deliveryNumber: true, createdAt: true, updatedAt: true });
export const insertDeliveryNoteItemSchema = createInsertSchema(deliveryNoteItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertReturnSchema = createInsertSchema(returns).omit({ id: true, returnNumber: true, createdAt: true, updatedAt: true });
export const insertReturnItemSchema = createInsertSchema(returnItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditNoteUsageSchema = createInsertSchema(creditNoteUsages).omit({ id: true, createdAt: true });
export const insertGoodsReceiptSchema = createInsertSchema(goodsReceipts).omit({ id: true, receiptNumber: true, createdAt: true, updatedAt: true });
export const insertGoodsReceiptItemSchema = createInsertSchema(goodsReceiptItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGoodsReceiptPaymentSchema = createInsertSchema(goodsReceiptPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientDepositSchema = createInsertSchema(clientDeposits).omit({ id: true, createdAt: true });

// Define types for TypeScript
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type CashAccount = typeof cashAccounts.$inferSelect;
export type InsertCashAccount = z.infer<typeof insertCashAccountSchema>;

export type AccountTransfer = typeof accountTransfers.$inferSelect;
export type InsertAccountTransfer = z.infer<typeof insertAccountTransferSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type InflowCategory = typeof inflowCategories.$inferSelect;
export type InsertInflowCategory = z.infer<typeof insertInflowCategorySchema>;

export type OutflowCategory = typeof outflowCategories.$inferSelect;
export type InsertOutflowCategory = z.infer<typeof insertOutflowCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type ProductBundleComponent = typeof productBundleComponents.$inferSelect;
export type InsertProductBundleComponent = z.infer<typeof insertProductBundleComponentSchema>;

export type ProductUnit = typeof productUnits.$inferSelect;
export type InsertProductUnit = z.infer<typeof insertProductUnitSchema>;

export type ProductBatch = typeof productBatches.$inferSelect;
export type InsertProductBatch = z.infer<typeof insertProductBatchSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;

export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;

export type InvoiceItemBatch = typeof invoiceItemBatches.$inferSelect;
export type InsertInvoiceItemBatch = z.infer<typeof insertInvoiceItemBatchSchema>;

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type StockAdjustment = typeof stockAdjustments.$inferSelect;
export type InsertStockAdjustment = z.infer<typeof insertStockAdjustmentSchema>;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;

export type PurchaseOrderPayment = typeof purchaseOrderPayments.$inferSelect;
export type InsertPurchaseOrderPayment = z.infer<typeof insertPurchaseOrderPaymentSchema>;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

export type PrintSettings = typeof printSettings.$inferSelect;
export type InsertPrintSettings = z.infer<typeof insertPrintSettingsSchema>;

export type PaymentType = typeof paymentTypes.$inferSelect;
export type InsertPaymentType = z.infer<typeof insertPaymentTypeSchema>;

export type PaymentTerm = typeof paymentTermsConfig.$inferSelect;
export type InsertPaymentTerm = z.infer<typeof insertPaymentTermSchema>;

export type DeliveryNote = typeof deliveryNotes.$inferSelect;
export type InsertDeliveryNote = z.infer<typeof insertDeliveryNoteSchema>;

export type DeliveryNoteItem = typeof deliveryNoteItems.$inferSelect;
export type InsertDeliveryNoteItem = z.infer<typeof insertDeliveryNoteItemSchema>;

export type Return = typeof returns.$inferSelect;
export type InsertReturn = z.infer<typeof insertReturnSchema>;

export type ReturnItem = typeof returnItems.$inferSelect;
export type InsertReturnItem = z.infer<typeof insertReturnItemSchema>;

export type CreditNoteUsage = typeof creditNoteUsages.$inferSelect;
export type InsertCreditNoteUsage = z.infer<typeof insertCreditNoteUsageSchema>;

export type ImportExportLog = typeof importExportLogs.$inferSelect;
export type InsertImportExportLog = z.infer<typeof insertImportExportLogSchema>;

export type GoodsReceipt = typeof goodsReceipts.$inferSelect;
export type InsertGoodsReceipt = z.infer<typeof insertGoodsReceiptSchema>;

export type GoodsReceiptItem = typeof goodsReceiptItems.$inferSelect;
export type InsertGoodsReceiptItem = z.infer<typeof insertGoodsReceiptItemSchema>;

export type GoodsReceiptPayment = typeof goodsReceiptPayments.$inferSelect;
export type InsertGoodsReceiptPayment = z.infer<typeof insertGoodsReceiptPaymentSchema>;

export type ClientDeposit = typeof clientDeposits.$inferSelect;
export type InsertClientDeposit = z.infer<typeof insertClientDepositSchema>;

// Custom relation types
export type ProductWithBatches = Product & { batches: ProductBatch[] };
export type ProductWithDetails = Product & { 
  batches: ProductBatch[]; 
  bundleComponents?: (ProductBundleComponent & { componentProduct: Product })[]; 
  units?: ProductUnit[];
};
export type InvoiceWithItems = Invoice & { items: InvoiceItem[], client: Client };
export type QuotationWithItems = Quotation & { items: QuotationItem[], client: Client };
export type PurchaseOrderWithItems = PurchaseOrder & { items: PurchaseOrderItem[] };
export type InvoiceItemWithProduct = InvoiceItem & { product: Product; productUnit?: ProductUnit };
export type QuotationItemWithProduct = QuotationItem & { product: Product; productUnit?: ProductUnit };
export type PurchaseOrderItemWithProduct = PurchaseOrderItem & { product: Product };
export type DeliveryNoteWithItems = DeliveryNote & { items: (DeliveryNoteItem & { invoiceItem: InvoiceItem })[] };
export type DeliveryNoteItemWithDetails = DeliveryNoteItem & { invoiceItem: InvoiceItem & { product: Product } };
export type GoodsReceiptWithItems = GoodsReceipt & { items: GoodsReceiptItem[], payments: GoodsReceiptPayment[] };
export type GoodsReceiptItemWithProduct = GoodsReceiptItem & { product: Product, purchaseOrder?: PurchaseOrder };

// Auth schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Define relations for easier querying
import { relations } from "drizzle-orm";

export const storesRelations = relations(stores, ({ many }) => ({
  clients: many(clients),
  products: many(productBatches),
  invoices: many(invoices),
  quotations: many(quotations),
  purchaseOrders: many(purchaseOrders),
  cashAccounts: many(cashAccounts),
  accountTransfers: many(accountTransfers)
}));

export const cashAccountsRelations = relations(cashAccounts, ({ one, many }) => ({
  store: one(stores, { fields: [cashAccounts.storeId], references: [stores.id] }),
  transactions: many(transactions),
  transfersFrom: many(accountTransfers, { relationName: 'fromAccount' }),
  transfersTo: many(accountTransfers, { relationName: 'toAccount' })
}));

export const accountTransfersRelations = relations(accountTransfers, ({ one }) => ({
  store: one(stores, { fields: [accountTransfers.storeId], references: [stores.id] }),
  fromAccount: one(cashAccounts, { fields: [accountTransfers.fromAccountId], references: [cashAccounts.id], relationName: 'fromAccount' }),
  toAccount: one(cashAccounts, { fields: [accountTransfers.toAccountId], references: [cashAccounts.id], relationName: 'toAccount' })
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  store: one(stores, { fields: [transactions.storeId], references: [stores.id] }),
  account: one(cashAccounts, { fields: [transactions.accountId], references: [cashAccounts.id] }),
  invoice: one(invoices, { fields: [transactions.invoiceId], references: [invoices.id] })
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  store: one(stores, { fields: [clients.storeId], references: [stores.id] }),
  invoices: many(invoices),
  quotations: many(quotations),
  deposits: many(clientDeposits)
}));

export const clientDepositsRelations = relations(clientDeposits, ({ one }) => ({
  client: one(clients, { fields: [clientDeposits.clientId], references: [clients.id] }),
  store: one(stores, { fields: [clientDeposits.storeId], references: [stores.id] }),
  invoice: one(invoices, { fields: [clientDeposits.invoiceId], references: [invoices.id] })
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  batches: many(productBatches),
  bundleComponents: many(productBundleComponents),
  units: many(productUnits),
  invoiceItems: many(invoiceItems),
  quotationItems: many(quotationItems)
}));

export const productBundleComponentsRelations = relations(productBundleComponents, ({ one }) => ({
  bundleProduct: one(products, { fields: [productBundleComponents.bundleProductId], references: [products.id] }),
  componentProduct: one(products, { fields: [productBundleComponents.componentProductId], references: [products.id] })
}));

export const productUnitsRelations = relations(productUnits, ({ one }) => ({
  product: one(products, { fields: [productUnits.productId], references: [products.id] })
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  store: one(stores, { fields: [invoices.storeId], references: [stores.id] }),
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  items: many(invoiceItems),
  payments: many(invoicePayments),
  transactions: many(transactions),
  deliveryNotes: many(deliveryNotes)
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one, many }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
  product: one(products, { fields: [invoiceItems.productId], references: [products.id] }),
  batches: many(invoiceItemBatches),
  deliveryNoteItems: many(deliveryNoteItems)
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(invoices, { fields: [invoicePayments.invoiceId], references: [invoices.id] })
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  store: one(stores, { fields: [purchaseOrders.storeId], references: [stores.id] }),
  supplier: one(suppliers, { fields: [purchaseOrders.supplierId], references: [suppliers.id] }),
  items: many(purchaseOrderItems),
  payments: many(purchaseOrderPayments)
}));

export const purchaseOrderPaymentsRelations = relations(purchaseOrderPayments, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderPayments.purchaseOrderId], references: [purchaseOrders.id] })
}));

export const deliveryNotesRelations = relations(deliveryNotes, ({ one, many }) => ({
  store: one(stores, { fields: [deliveryNotes.storeId], references: [stores.id] }),
  invoice: one(invoices, { fields: [deliveryNotes.invoiceId], references: [invoices.id] }),
  items: many(deliveryNoteItems)
}));

export const deliveryNoteItemsRelations = relations(deliveryNoteItems, ({ one }) => ({
  deliveryNote: one(deliveryNotes, { fields: [deliveryNoteItems.deliveryNoteId], references: [deliveryNotes.id] }),
  invoiceItem: one(invoiceItems, { fields: [deliveryNoteItems.invoiceItemId], references: [invoiceItems.id] })
}));

export const goodsReceiptsRelations = relations(goodsReceipts, ({ one, many }) => ({
  store: one(stores, { fields: [goodsReceipts.storeId], references: [stores.id] }),
  supplier: one(suppliers, { fields: [goodsReceipts.supplierId], references: [suppliers.id] }),
  items: many(goodsReceiptItems),
  payments: many(goodsReceiptPayments)
}));

export const goodsReceiptItemsRelations = relations(goodsReceiptItems, ({ one }) => ({
  goodsReceipt: one(goodsReceipts, { fields: [goodsReceiptItems.goodsReceiptId], references: [goodsReceipts.id] }),
  purchaseOrder: one(purchaseOrders, { fields: [goodsReceiptItems.purchaseOrderId], references: [purchaseOrders.id] }),
  product: one(products, { fields: [goodsReceiptItems.productId], references: [products.id] })
}));

export const goodsReceiptPaymentsRelations = relations(goodsReceiptPayments, ({ one }) => ({
  goodsReceipt: one(goodsReceipts, { fields: [goodsReceiptPayments.goodsReceiptId], references: [goodsReceipts.id] })
}));

export const returnsRelations = relations(returns, ({ one, many }) => ({
  store: one(stores, { fields: [returns.storeId], references: [stores.id] }),
  invoice: one(invoices, { fields: [returns.invoiceId], references: [invoices.id] }),
  client: one(clients, { fields: [returns.clientId], references: [clients.id] }),
  items: many(returnItems),
  usages: many(creditNoteUsages)
}));

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  return: one(returns, { fields: [returnItems.returnId], references: [returns.id] }),
  invoiceItem: one(invoiceItems, { fields: [returnItems.invoiceItemId], references: [invoiceItems.id] })
}));

export const creditNoteUsagesRelations = relations(creditNoteUsages, ({ one }) => ({
  return: one(returns, { fields: [creditNoteUsages.returnId], references: [returns.id] }),
  invoicePayment: one(invoicePayments, { fields: [creditNoteUsages.invoicePaymentId], references: [invoicePayments.id] })
}));

// Company Settings table (global settings - single row)
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 200 }).default("Mitra Indo Aluminium").notNull(),
  logoUrl: varchar("logo_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;