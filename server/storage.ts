import { eq, and, or, desc, gte, gt, lt, lte, sql, isNull, inArray, count, not } from "drizzle-orm";
import { db, withTransaction } from "./db";
import {
  users, clients, suppliers, products, productBatches, productBundleComponents, productUnits,
  invoices, invoiceItems, invoiceItemBatches, invoicePayments, quotations, quotationItems, 
  transactions, stores, settings, categories, inflowCategories, outflowCategories, importExportLogs, purchaseOrders, purchaseOrderItems, 
  purchaseOrderPayments, printSettings, paymentTypes, paymentTermsConfig, deliveryNotes, deliveryNoteItems,
  cashAccounts, accountTransfers, goodsReceipts, goodsReceiptItems, goodsReceiptPayments,
  returns, returnItems, creditNoteUsages, stockAdjustments, roles, companySettings, clientDeposits,
  activityLogs,

  type User, type InsertUser, type Store, type InsertStore, type Role, type InsertRole,
  type Client, type InsertClient, type Supplier, type InsertSupplier,
  type Product, type InsertProduct,
  type ProductBundleComponent, type InsertProductBundleComponent,
  type ProductUnit, type InsertProductUnit,
  type ProductBatch, type InsertProductBatch, type Invoice, type InsertInvoice,
  type InvoiceItem, type InsertInvoiceItem, type InvoiceItemBatch, type InsertInvoiceItemBatch,
  type InvoicePayment, type InsertInvoicePayment,
  type DeliveryNote, type InsertDeliveryNote, type DeliveryNoteItem, type InsertDeliveryNoteItem,
  type Quotation, type InsertQuotation, type QuotationItem, type InsertQuotationItem,
  type PurchaseOrder, type InsertPurchaseOrder, type PurchaseOrderItem, type InsertPurchaseOrderItem,
  type PurchaseOrderPayment, type InsertPurchaseOrderPayment,
  type Transaction, type InsertTransaction, type Category, type InsertCategory,
  type InflowCategory, type InsertInflowCategory, type OutflowCategory, type InsertOutflowCategory,
  type Setting, type InsertSetting, type ImportExportLog, type InsertImportExportLog,
  type PrintSettings, type InsertPrintSettings,
  type PaymentType, type InsertPaymentType, type PaymentTerm, type InsertPaymentTerm,
  type CashAccount, type InsertCashAccount, type AccountTransfer, type InsertAccountTransfer,
  type GoodsReceipt, type InsertGoodsReceipt, type GoodsReceiptItem, type InsertGoodsReceiptItem,
  type GoodsReceiptPayment, type InsertGoodsReceiptPayment,
  type Return, type InsertReturn, type ReturnItem, type InsertReturnItem,
  type CreditNoteUsage, type InsertCreditNoteUsage,
  type StockAdjustment, type InsertStockAdjustment,
  type CompanySettings, type InsertCompanySettings,
  type ClientDeposit, type InsertClientDeposit,
  type ActivityLog, type InsertActivityLog
} from "../shared/schema";

import session from "express-session";
import connectPg from "connect-pg-simple";

// Define the IStorage interface for all database operations
export interface IStorage {
  // Session store for Express
  sessionStore: session.Store;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByStore(storeId: number): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Store methods
  getStore(id: number): Promise<Store | undefined>;
  getStores(): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, store: Partial<InsertStore>): Promise<Store>;
  deleteStore(id: number): Promise<void>;

  // Role methods
  getRole(id: number): Promise<Role | undefined>;
  getRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, role: Partial<InsertRole>): Promise<Role>;
  deleteRole(id: number): Promise<void>;

  // Company Settings methods
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings>;

  // Client methods
  getClient(id: number): Promise<Client | undefined>;
  getClients(storeId: number): Promise<(Client & { lastPurchase: string | null })[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: number): Promise<void>;
  getClientStats(clientId: number): Promise<ClientStats>;
  getClientMonthlyPurchases(clientId: number): Promise<ClientMonthlyPurchase[]>;

  // Supplier methods
  getSupplier(id: number): Promise<Supplier | undefined>;
  getSuppliers(storeId: number): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: number): Promise<void>;

  // Category methods
  getCategory(id: number): Promise<Category | undefined>;
  getCategories(storeId: number): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string, storeId: number): Promise<Product | undefined>;
  getProducts(storeId: number): Promise<Product[]>;
  getProductsWithLowStock(storeId: number): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  deleteProducts(ids: number[]): Promise<void>;

  // Product dashboard methods
  getProductStats(productId: number): Promise<ProductStats>;
  getProductSalesHistory(productId: number, page?: number, limit?: number): Promise<{ data: ProductSalesHistory[]; total: number }>;
  getProductPurchaseHistory(productId: number, page?: number, limit?: number): Promise<{ data: ProductPurchaseHistory[]; total: number }>;
  getProductSalesTrend(productId: number, groupBy: 'daily' | 'monthly'): Promise<ProductSalesTrend[]>;
  getBundleComponentSales(bundleProductId: number): Promise<BundleComponentSales[]>;

  // Product reservation methods
  getProductReservedQuantity(productId: number, storeId: number): Promise<number>;
  getProductReservations(productId: number, storeId: number): Promise<Array<{
    invoiceId: number;
    invoiceNumber: string;
    clientId: number | null;
    clientName: string;
    reservedQuantity: number;
    totalInvoiceQty: number;
    deliveredQty: number;
  }>>;
  getProductAvailableQuantity(productId: number, storeId: number): Promise<{ stock: number; reserved: number; available: number }>;

  // Product batch methods
  getProductBatch(id: number): Promise<ProductBatch | undefined>;
  getProductBatches(productId: number, storeId: number): Promise<ProductBatch[]>;
  createProductBatch(batch: InsertProductBatch): Promise<ProductBatch>;
  updateProductBatch(id: number, batch: Partial<InsertProductBatch>): Promise<ProductBatch>;
  deleteProductBatch(id: number): Promise<void>;

  // Product bundle component methods
  getBundleComponents(bundleProductId: number): Promise<(ProductBundleComponent & { componentProduct: Product })[]>;
  setBundleComponents(bundleProductId: number, components: { componentProductId: number; quantity: number | string }[]): Promise<ProductBundleComponent[]>;
  getBundleStock(bundleProductId: number, storeId: number): Promise<number>;

  // Product unit methods
  getProductUnits(productId: number): Promise<ProductUnit[]>;
  getProductUnit(id: number): Promise<ProductUnit | undefined>;
  setProductUnits(productId: number, units: InsertProductUnit[]): Promise<ProductUnit[]>;
  deleteProductUnit(id: number): Promise<void>;

  // Invoice methods
  getInvoice(id: number): Promise<Invoice | undefined>;
  getInvoiceWithItems(id: number): Promise<{ invoice: Invoice, items: (InvoiceItem & { productCode?: string; productSku?: string; unitLabel?: string })[], client?: Client } | undefined>;
  getInvoices(storeId: number): Promise<(Invoice & { clientName: string | null })[]>;
  getInvoicesWithStatus(storeId: number): Promise<(Invoice & { 
    clientName: string | null; 
    paymentStatus: 'unpaid' | 'partial_paid' | 'paid' | 'overpaid' | 'overdue';
    deliveryStatus: 'undelivered' | 'partial_delivered' | 'delivered';
  })[]>;
  getInvoicesByClient(clientId: number): Promise<Invoice[]>;
  getRecentInvoices(storeId: number, limit: number): Promise<Invoice[]>;
  getOpenInvoices(storeId: number): Promise<Invoice[]>;
  getReturnableInvoices(storeId: number): Promise<(Invoice & { clientName: string | null; lastPaymentDate: Date | null })[]>;
  getDeliveredQuantitiesForInvoice(invoiceId: number): Promise<{ invoiceItemId: number; deliveredQty: number }[]>;
  createInvoice(invoice: InsertInvoice, items: Array<InsertInvoiceItem & { productId: number, quantity: number | string }>): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  updateInvoiceWithItems(id: number, invoiceData: Partial<InsertInvoice>, items: Array<InsertInvoiceItem & { id?: number; productId: number; quantity: number | string }>): Promise<Invoice>;
  updateInvoiceStatus(id: number, status: string): Promise<Invoice>;
  voidInvoice(id: number): Promise<Invoice>;
  deleteInvoice(id: number): Promise<void>;
  calculatePaymentStatus(invoiceId: number, totalAmount: string, dueDate: string): Promise<'unpaid' | 'partial_paid' | 'paid' | 'overpaid' | 'overdue'>;
  calculateDeliveryStatus(invoiceId: number): Promise<'undelivered' | 'partial_delivered' | 'delivered'>;

  // Invoice payment methods
  getInvoicePayment(paymentId: number): Promise<InvoicePayment | undefined>;
  getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]>;
  createInvoicePayment(payment: InsertInvoicePayment): Promise<InvoicePayment>;
  updateInvoicePayment(id: number, payment: Partial<InsertInvoicePayment>): Promise<InvoicePayment>;
  deleteInvoicePayment(id: number): Promise<void>;
  
  // Stock reservation methods (for paid invoices awaiting delivery)
  reserveStockForInvoice(invoiceId: number): Promise<void>;
  releaseStockReservationForInvoice(invoiceId: number): Promise<void>;
  
  // Self pickup stock deduction (when self_pickup invoice is paid)
  deductStockForSelfPickup(invoiceId: number): Promise<void>;
  returnStockFromSelfPickup(invoiceId: number, tx?: any): Promise<void>;

  // Purchase order payment methods (for prepaid POs)
  getPurchaseOrderPayment(paymentId: number): Promise<PurchaseOrderPayment | undefined>;
  getPurchaseOrderPayments(purchaseOrderId: number): Promise<PurchaseOrderPayment[]>;
  getPurchaseOrderPaidAmount(purchaseOrderId: number): Promise<number>;
  createPurchaseOrderPayment(payment: InsertPurchaseOrderPayment): Promise<PurchaseOrderPayment>;
  updatePurchaseOrderPayment(id: number, payment: Partial<InsertPurchaseOrderPayment>): Promise<PurchaseOrderPayment>;
  deletePurchaseOrderPayment(id: number): Promise<void>;

  // Delivery note methods
  getDeliveryNote(id: number): Promise<DeliveryNote | undefined>;
  getDeliveryNoteWithItems(id: number): Promise<{ deliveryNote: DeliveryNote, items: (DeliveryNoteItem & { invoiceItem: InvoiceItem & { product: Product; unitLabel?: string } })[] } | undefined>;
  getDeliveryNotesByInvoice(invoiceId: number): Promise<DeliveryNote[]>;
  getDeliveryNotes(storeId: number): Promise<DeliveryNote[]>;
  getDeliveryNotesWithDetails(storeId: number, status?: string): Promise<(DeliveryNote & { invoice: Invoice & { client: Client | null }, itemCount: number })[]>;
  getInvoiceDeliveryStatus(invoiceId: number): Promise<{ orderedItems: { invoiceItemId: number; description: string; quantity: number; delivered: number; remaining: number }[]; fullyDelivered: boolean }>;
  createDeliveryNote(deliveryNote: InsertDeliveryNote, items: InsertDeliveryNoteItem[]): Promise<DeliveryNote>;
  updateDeliveryNote(id: number, deliveryNote: Partial<InsertDeliveryNote>): Promise<DeliveryNote>;
  deleteDeliveryNote(id: number): Promise<void>;
  getNextDeliveryNoteNumber(deliveryDate?: Date, invoiceId?: number, dnItemCount?: number): Promise<string>;
  allocateStockOnDelivery(deliveryNoteId: number): Promise<void>;
  reverseDeliveryNoteStock(deliveryNoteId: number): Promise<void>;
  restorePendingDeliveryNoteStock(deliveryNoteId: number, tx?: any): Promise<void>;
  revertDeliveryNoteToPending(deliveryNoteId: number): Promise<DeliveryNote>;
  updateDeliveryNoteItems(deliveryNoteId: number, items: { invoiceItemId: number; deliveredQuantity: number }[]): Promise<void>;

  // Quotation methods
  getQuotation(id: number): Promise<Quotation | undefined>;
  getQuotationWithItems(id: number): Promise<{ quotation: Quotation, items: (QuotationItem & { productSku?: string; productCode?: string; unitLabel?: string })[], client?: Client } | undefined>;
  getQuotations(storeId: number): Promise<(Quotation & { clientName: string | null })[]>;
  createQuotation(quotation: InsertQuotation, items: InsertQuotationItem[]): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>, items?: InsertQuotationItem[]): Promise<Quotation>;
  patchQuotation(id: number, data: { status?: string; rejectionReason?: string }): Promise<Quotation>;
  convertQuotationToInvoice(id: number): Promise<Invoice>;
  deleteQuotation(id: number): Promise<void>;

  // Purchase Order methods
  getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderWithItems(id: number): Promise<{ purchaseOrder: PurchaseOrder, items: PurchaseOrderItem[] } | undefined>;
  getPurchaseOrders(storeId: number): Promise<PurchaseOrder[]>;
  getPurchaseOrdersWithItems(storeId: number): Promise<(PurchaseOrder & { items: { productId: number; description: string; quantity: string; unitCost: string }[] })[]>;
  getPendingPOQuantityByProduct(storeId: number): Promise<Map<number, number>>;
  getReceivedQuantitiesForPO(purchaseOrderId: number): Promise<Map<number, string>>;
  createPurchaseOrder(purchaseOrder: InsertPurchaseOrder, items: Array<InsertPurchaseOrderItem & { productId: number, quantity: number | string }>): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: number, purchaseOrder: Partial<InsertPurchaseOrder>, items: Array<InsertPurchaseOrderItem & { id?: number, productId: number, quantity: number | string }>): Promise<PurchaseOrder>;
  updatePurchaseOrderStatus(id: number, status: string, deliveredDate?: Date): Promise<PurchaseOrder>;
  receivePurchaseOrderItems(purchaseOrderId: number, items: Array<{ itemId: number, quantityReceived: number }>): Promise<PurchaseOrder>;
  updatePOReceivedFromGR(purchaseOrderId: number, items: Array<{ purchaseOrderItemId: number, quantityReceived: number }>): Promise<void>;
  deletePurchaseOrder(id: number): Promise<void>;
  getProductPendingPOs(productId: number, storeId: number): Promise<Array<{
    purchaseOrderId: number;
    purchaseOrderNumber: string;
    supplierName: string;
    orderDate: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
  }>>;
  getPendingPOItemsList(storeId: number): Promise<Array<{
    purchaseOrderId: number;
    purchaseOrderNumber: string;
    supplierName: string;
    orderDate: string;
    productId: number;
    productName: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
  }>>;

  // Preview number generation methods
  getNextInvoiceNumber(issueDate?: Date): Promise<string>;
  getNextQuotationNumber(): Promise<string>;
  getNextPurchaseOrderNumber(orderDate?: Date): Promise<string>;
  getNextClientNumber(): Promise<string>;
  getNextSupplierNumber(): Promise<string>;

  // Transaction methods
  getTransaction(id: number): Promise<Transaction | undefined>;
  getTransactions(storeId: number): Promise<Transaction[]>;
  getTransactionsByType(storeId: number, type: string): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;
  deleteTransactionByInvoicePaymentId(invoicePaymentId: number): Promise<void>;
  deleteTransactionByGoodsReceiptPaymentId(goodsReceiptPaymentId: number): Promise<void>;
  deleteTransactionByPurchaseOrderPaymentId(purchaseOrderPaymentId: number): Promise<void>;

  // Stock adjustment methods
  getStockAdjustment(id: number): Promise<StockAdjustment | undefined>;
  getStockAdjustments(storeId: number): Promise<StockAdjustment[]>;
  getStockAdjustmentsByProduct(productId: number, storeId: number): Promise<StockAdjustment[]>;
  createStockAdjustment(adjustment: InsertStockAdjustment): Promise<StockAdjustment>;
  deleteStockAdjustment(id: number): Promise<void>;

  // Settings methods
  getSetting(storeId: number, key: string): Promise<Setting | undefined>;
  getSettings(storeId: number): Promise<Setting[]>;
  setSetting(setting: InsertSetting): Promise<Setting>;
  deleteSetting(id: number): Promise<void>;

  // Print Settings methods
  getPrintSettings(storeId: number): Promise<PrintSettings | undefined>;
  createPrintSettings(settings: InsertPrintSettings): Promise<PrintSettings>;
  updatePrintSettings(storeId: number, settings: Partial<InsertPrintSettings>): Promise<PrintSettings>;

  // Payment Types methods
  getPaymentTypes(storeId: number): Promise<PaymentType[]>;
  getPaymentType(id: number): Promise<PaymentType | undefined>;
  getPaymentTypeByName(storeId: number, name: string): Promise<PaymentType | undefined>;
  createPaymentType(paymentType: InsertPaymentType): Promise<PaymentType>;
  updatePaymentType(id: number, paymentType: Partial<InsertPaymentType>): Promise<PaymentType>;
  deletePaymentType(id: number): Promise<void>;

  // Payment Terms methods
  getPaymentTerms(storeId: number): Promise<PaymentTerm[]>;
  getPaymentTerm(id: number): Promise<PaymentTerm | undefined>;
  createPaymentTerm(paymentTerm: InsertPaymentTerm): Promise<PaymentTerm>;
  updatePaymentTerm(id: number, paymentTerm: Partial<InsertPaymentTerm>): Promise<PaymentTerm>;
  deletePaymentTerm(id: number): Promise<void>;

  // Inflow Categories methods
  getInflowCategories(storeId: number): Promise<InflowCategory[]>;
  getInflowCategory(id: number): Promise<InflowCategory | undefined>;
  createInflowCategory(category: InsertInflowCategory): Promise<InflowCategory>;
  updateInflowCategory(id: number, category: Partial<InsertInflowCategory>): Promise<InflowCategory>;
  deleteInflowCategory(id: number): Promise<void>;

  // Outflow Categories methods
  getOutflowCategories(storeId: number): Promise<OutflowCategory[]>;
  getOutflowCategory(id: number): Promise<OutflowCategory | undefined>;
  createOutflowCategory(category: InsertOutflowCategory): Promise<OutflowCategory>;
  updateOutflowCategory(id: number, category: Partial<InsertOutflowCategory>): Promise<OutflowCategory>;
  deleteOutflowCategory(id: number): Promise<void>;

  // Cash Account methods
  getCashAccounts(storeId: number): Promise<CashAccount[]>;
  getCashAccount(id: number): Promise<CashAccount | undefined>;
  getCashAccountWithBalance(id: number): Promise<CashAccountWithBalance | undefined>;
  getCashAccountsWithBalance(storeId: number): Promise<CashAccountWithBalance[]>;
  createCashAccount(account: InsertCashAccount): Promise<CashAccount>;
  updateCashAccount(id: number, account: Partial<InsertCashAccount>): Promise<CashAccount>;
  deleteCashAccount(id: number): Promise<void>;

  // Account Transfer methods
  getAccountTransfers(storeId: number): Promise<AccountTransfer[]>;
  getAccountTransfer(id: number): Promise<AccountTransfer | undefined>;
  createAccountTransfer(transfer: InsertAccountTransfer): Promise<AccountTransfer>;
  updateAccountTransfer(id: number, transfer: Partial<InsertAccountTransfer>): Promise<AccountTransfer>;
  deleteAccountTransfer(id: number): Promise<void>;

  // Import/Export methods
  createImportExportLog(log: InsertImportExportLog): Promise<ImportExportLog>;
  getImportExportLogs(storeId: number): Promise<ImportExportLog[]>;

  // Goods Receipt methods
  getGoodsReceipt(id: number): Promise<GoodsReceipt | undefined>;
  getGoodsReceiptWithItems(id: number): Promise<{ goodsReceipt: GoodsReceipt, items: GoodsReceiptItem[], payments: GoodsReceiptPayment[] } | undefined>;
  getGoodsReceipts(storeId: number): Promise<GoodsReceipt[]>;
  getGoodsReceiptsWithPendingReturns(storeId: number): Promise<GoodsReceipt[]>;
  createGoodsReceipt(goodsReceipt: InsertGoodsReceipt, items: Array<InsertGoodsReceiptItem & { productId: number }>): Promise<GoodsReceipt>;
  updateGoodsReceipt(id: number, goodsReceipt: Partial<InsertGoodsReceipt>, items?: Array<InsertGoodsReceiptItem & { id?: number, productId: number }>): Promise<GoodsReceipt>;
  updateGoodsReceiptStatus(id: number, status: string): Promise<GoodsReceipt>;
  deleteGoodsReceipt(id: number): Promise<void>;
  getNextGoodsReceiptNumber(storeId: number, receiptDate?: Date): Promise<string>;

  // Goods Receipt Item methods
  updateGoodsReceiptItem(id: number, item: Partial<InsertGoodsReceiptItem>): Promise<GoodsReceiptItem>;

  // Goods Receipt Payment methods
  getGoodsReceiptPayment(paymentId: number): Promise<GoodsReceiptPayment | undefined>;
  getGoodsReceiptPayments(goodsReceiptId: number): Promise<GoodsReceiptPayment[]>;
  createGoodsReceiptPayment(payment: InsertGoodsReceiptPayment): Promise<GoodsReceiptPayment>;
  updateGoodsReceiptPayment(id: number, payment: Partial<InsertGoodsReceiptPayment>): Promise<GoodsReceiptPayment>;
  deleteGoodsReceiptPayment(id: number): Promise<void>;

  // Returns/Credit Note methods
  getReturn(id: number): Promise<Return | undefined>;
  getReturnWithItems(id: number): Promise<{ return: Return, items: (ReturnItem & { invoiceItem: InvoiceItem & { product: Product } })[], usages: CreditNoteUsage[], invoice: Invoice, client: Client } | undefined>;
  getReturns(storeId: number): Promise<Return[]>;
  getReturnsWithDetails(storeId: number): Promise<(Return & { invoice: Invoice, client: Client })[]>;
  getClientCreditNotes(clientId: number): Promise<(Return & { remainingBalance: number })[]>;
  createReturn(returnData: InsertReturn, items: InsertReturnItem[]): Promise<Return>;
  updateReturn(id: number, returnData: Partial<InsertReturn>, items?: InsertReturnItem[]): Promise<Return>;
  updateReturnStatus(id: number, status: string): Promise<Return>;
  deleteReturn(id: number): Promise<void>;
  getNextReturnNumber(returnDate?: Date): Promise<string>;

  // Credit Note Usage methods
  getCreditNoteUsages(returnId: number): Promise<CreditNoteUsage[]>;
  createCreditNoteUsage(usage: InsertCreditNoteUsage): Promise<CreditNoteUsage>;
  applyCreditNoteToPayment(returnId: number, invoicePaymentId: number, amount: number): Promise<CreditNoteUsage>;
  convertCreditNoteToRefund(returnId: number, amount: number): Promise<CreditNoteUsage>;

  // Client Deposit methods
  getClientDeposits(clientId: number): Promise<ClientDeposit[]>;
  getClientDepositBalance(clientId: number): Promise<number>;
  createClientDeposit(deposit: InsertClientDeposit): Promise<ClientDeposit>;

  // Activity log methods
  createActivityLog(data: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(filters?: { storeId?: number; userId?: number; action?: string; entity?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }): Promise<{ logs: ActivityLog[]; total: number }>;

  deleteClientDepositByPaymentId(invoicePaymentId: number): Promise<void>;

  // Dashboard metrics
  getDashboardStats(storeId: number): Promise<DashboardStats>;
  getTopClients(storeId: number, limit: number): Promise<ClientWithSalesStats[]>;
  getInvoiceStatusSummary(storeId: number): Promise<InvoiceStatusSummary>;
  getProductSalesByCategory(storeId: number): Promise<CategorySalesData[]>;
  getRevenueData(storeId: number, start: Date, end: Date): Promise<RevenueData>;
  getProductPerformance(storeId: number, limit: number): Promise<ProductPerformanceStats[]>;
  getInventoryValueStats(storeId: number): Promise<InventoryValueStats>;
  getBatchProfitabilityAnalysis(storeId: number, productId?: number): Promise<BatchProfitabilityData[]>;
  getDeliveryProfitSummary(storeId: number, startDate?: Date, endDate?: Date): Promise<DeliveryProfitSummary>;
  getProfitOverview(storeId: number, startDate?: Date, endDate?: Date): Promise<ProfitOverview>;
  getFinancialReport(storeId: number, dateRange: string): Promise<any>;
  getCashFlowReport(storeId: number, dateRange: string): Promise<any>;
}

export type DeliveryProfitSummary = {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  deliveryCount: number;
  byPeriod: {
    period: string;
    revenue: number;
    cost: number;
    profit: number;
  }[];
};

export type ProfitOverview = {
  realizedProfit: number;
  realizedRevenue: number;
  realizedCost: number;
  projectedProfit: number;
  projectedRevenue: number;
  projectedCost: number;
  totalExpectedProfit: number;
  averageMargin: number;
  deliveredCount: number;
  pendingCount: number;
};

// Types for dashboard metrics
export type DashboardStats = {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  openInvoices: {
    count: number;
    value: number;
  };
  totalClients: number;
  productsCount: number;
  lowStockCount: number;
  salesCount: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
};

export type ClientWithSalesStats = {
  id: number;
  name: string;
  email: string;
  invoiceCount: number;
  totalSpent: number;
  averageSpend: number;
  lastPurchaseDate: Date | null;
};

export type CashAccountWithBalance = CashAccount & {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
};

export type InvoiceStatusSummary = {
  paid: number;
  pending: number;
  overdue: number;
  total: number;
};

export type CategorySalesData = {
  categoryId: number | null;
  categoryName: string;
  totalRevenue: number;
  totalQuantity: number;
  productCount: number;
};

export type RevenueData = {
  dates: string[];
  revenue: number[];
  expenses: number[];
  profit: number[];
};

export type ProductPerformanceStats = {
  id: number;
  name: string;
  sku: string;
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
};

export type InventoryValueStats = {
  totalItems: number;
  totalValue: number;
  batchesCount: number;
  averageCost: number;
  valueByCategory: Array<{ category: string; value: number }>;
};

export type BatchProfitabilityData = {
  productId: number;
  productName: string;
  batchNumber: string;
  capitalCost: number;
  avgSellingPrice: number;
  profitMargin: number;
  soldQuantity: number;
  totalProfit: number;
  purchaseDate: Date;
};

// Product dashboard types
export type ProductStats = {
  totalSales: number;
  totalRevenue: string;
  totalPurchases: number;
  totalCost: string;
  currentStock: number;
  averageSellingPrice: string;
  averageCost: string;
  profitMargin: string;
  averageMonthlySales: number;
};

// Client dashboard types
export type ClientStats = {
  totalPurchases: number;
  unpaidInvoicesCount: number;
  lastPurchaseDate: string | null;
};

export type ClientMonthlyPurchase = {
  month: string;
  totalAmount: number;
  invoiceCount: number;
};

export type ProductSalesHistory = {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  clientName: string;
  quantity: number;
  unitPrice: string;
  total: string;
  date: string;
  status: 'paid' | 'pending' | 'overdue';
};

export type ProductPurchaseHistory = {
  id: number;
  goodsReceiptId: number;
  receiptNumber: string;
  supplierName: string;
  quantity: number;
  unitCost: string;
  total: string;
  date: string;
  status: string;
};

export type ProductSalesTrend = {
  period: string;
  totalQuantity: number;
  totalRevenue: number;
  count: number;
};

export type BundleComponentSales = {
  componentProductId: number;
  componentName: string;
  componentSku: string;
  qtyPerBundle: number;
  bundleSalesQty: number;
  individualSalesQty: number;
  bundleRevenue: number;
  individualRevenue: number;
};

// Helper function to generate unique numbers with retry logic for concurrency
async function generateNextNumber(prefix: string, yearMonth: string, table: any, column: any, tx: any, storeId?: number): Promise<string> {
  // Find the highest number for this year-month using the transaction
  const yearMonthPrefix = `${prefix}-${yearMonth}-`;
  
  const conditions = [sql`${column} LIKE ${yearMonthPrefix + '%'}`];
  if (storeId !== undefined) {
    conditions.push(eq(table.storeId, storeId));
  }

  const result = await tx
    .select({ number: column })
    .from(table)
    .where(and(...conditions))
    .orderBy(sql`${column} DESC`)
    .limit(1);

  let nextNumber = 1;
  if (result.length > 0 && result[0].number) {
    const lastNumber = result[0].number;
    const parts = lastNumber.split('-');
    if (parts.length >= 3 && parts[2]) {
      const numericPart = parseInt(parts[2], 10);
      if (!isNaN(numericPart)) {
        nextNumber = numericPart + 1;
      }
    }
  }

  return `${prefix}-${yearMonth}-${nextNumber.toString().padStart(4, '0')}`;
}

// Helper function for simple sequential numbering (like C-00001)
async function generateSimpleSequentialNumber(prefix: string, table: any, column: any, tx: any): Promise<string> {
  // Find the highest number with this prefix
  const prefixPattern = `${prefix}-%`;
  const result = await tx
    .select({ number: column })
    .from(table)
    .where(sql`${column} LIKE ${prefixPattern}`)
    .orderBy(sql`${column} DESC`)
    .limit(1);

  let nextNumber = 1;
  if (result.length > 0 && result[0].number) {
    const lastNumber = result[0].number;
    const parts = lastNumber.split('-');
    if (parts.length >= 2 && parts[1]) {
      const numericPart = parseInt(parts[1], 10);
      if (!isNaN(numericPart)) {
        nextNumber = numericPart + 1;
      }
    }
  }

  return `${prefix}-${nextNumber.toString().padStart(5, '0')}`;
}

// Helper function to safely create records with unique number generation and retry logic
async function createWithUniqueNumber<T>(
  table: any,
  column: any,
  prefix: string,
  data: any,
  dateField?: string,
  maxRetries: number = 5
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(async (tx) => {
        // Get year and month from date field or current date
        const date = dateField && data[dateField] ? 
          new Date(data[dateField]) : 
          new Date();
        const year = date.getFullYear().toString().slice(-2); // Get last 2 digits of year
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Get month with leading zero
        const yearMonth = year + month;

        const uniqueNumber = await generateNextNumber(prefix, yearMonth, table, column, tx);

        const [newRecord] = await tx
          .insert(table)
          .values({
            ...data,
            [column.name]: uniqueNumber
          })
          .returning();

        return newRecord;
      });
    } catch (error: any) {
      // Check if this is a unique constraint violation
      if (error?.code === '23505' && error?.detail?.includes(column.name)) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to create record with unique ${prefix} number after ${maxRetries} attempts due to concurrency conflicts`);
        }
        // Wait with exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        continue;
      }
      // For other errors, don't retry
      throw error;
    }
  }

  throw new Error(`Failed to create record with unique ${prefix} number`);
}

// Helper function for simple sequential numbering with retry logic  
async function createWithSimpleSequentialNumber<T>(
  table: any,
  column: any,
  columnKey: string,
  prefix: string,
  data: any,
  maxRetries: number = 5
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(async (tx) => {
        const uniqueNumber = await generateSimpleSequentialNumber(prefix, table, column, tx);

        const [newRecord] = await tx
          .insert(table)
          .values({
            ...data,
            [columnKey]: uniqueNumber
          })
          .returning();

        return newRecord;
      });
    } catch (error: any) {
      // Check if this is a unique constraint violation
      if (error?.code === '23505' && error?.detail?.includes(column.name)) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to create record with unique ${prefix} number after ${maxRetries} attempts due to concurrency conflicts`);
        }
        // Wait with exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
        continue;
      }
      // For other errors, don't retry
      throw error;
    }
  }

  throw new Error(`Failed to create record with unique ${prefix} number`);
}

export class DatabaseStorage implements IStorage {
  // Session store for PostgreSQL
  sessionStore: session.Store;

  constructor() {
    const PostgresStore = connectPg(session);
    this.sessionStore = new PostgresStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.fullName);
  }

  async getUsersByStore(storeId: number): Promise<User[]> {
    return db.select().from(users).where(eq(users.storeId, storeId)).orderBy(users.fullName);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Store methods
  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store;
  }

  async getStores(): Promise<Store[]> {
    return db.select().from(stores).orderBy(stores.name);
  }

  async createStore(store: InsertStore): Promise<Store> {
    const [newStore] = await db.insert(stores).values(store).returning();
    return newStore;
  }

  async updateStore(id: number, storeData: Partial<InsertStore>): Promise<Store> {
    const [updatedStore] = await db
      .update(stores)
      .set({ ...storeData, updatedAt: new Date() })
      .where(eq(stores.id, id))
      .returning();
    return updatedStore;
  }

  async deleteStore(id: number): Promise<void> {
    await db.delete(stores).where(eq(stores.id, id));
  }

  // Role methods
  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return role;
  }

  async getRoles(): Promise<Role[]> {
    return db.select().from(roles).orderBy(roles.name);
  }

  async createRole(role: InsertRole): Promise<Role> {
    const [newRole] = await db.insert(roles).values(role).returning();
    return newRole;
  }

  async updateRole(id: number, roleData: Partial<InsertRole>): Promise<Role> {
    const [updatedRole] = await db
      .update(roles)
      .set({ ...roleData, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return updatedRole;
  }

  async deleteRole(id: number): Promise<void> {
    await db.delete(roles).where(eq(roles.id, id));
  }

  // Company Settings methods
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [result] = await db.select().from(companySettings).limit(1);
    return result;
  }

  async updateCompanySettings(settingsData: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values(settingsData as InsertCompanySettings)
        .returning();
      return created;
    }
  }

  // Client methods
  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    return client;
  }

  async getClients(storeId: number): Promise<(Client & { lastPurchase: string | null })[]> {
    const clientsData = await db.select().from(clients).where(eq(clients.storeId, storeId)).orderBy(clients.name);
    
    const lastPurchases = await db
      .select({
        clientId: invoices.clientId,
        lastPurchase: sql<string>`TO_CHAR(MAX(${invoices.issueDate}), 'YYYY-MM-DD')`.as('lastPurchase')
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.storeId, storeId),
          not(eq(invoices.status, 'void'))
        )
      )
      .groupBy(invoices.clientId);
    
    const lastPurchaseMap = new Map(lastPurchases.map(lp => [lp.clientId, lp.lastPurchase]));
    
    return clientsData.map(client => ({
      ...client,
      lastPurchase: lastPurchaseMap.get(client.id) || null
    }));
  }

  async createClient(client: InsertClient): Promise<Client> {
    return createWithSimpleSequentialNumber<Client>(clients, clients.clientNumber, "clientNumber", "C", client);
  }

  async updateClient(id: number, clientData: Partial<InsertClient>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...clientData, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getClientStats(clientId: number): Promise<ClientStats> {
    const results = await db
      .select({
        totalPurchases: count(invoices.id),
        unpaidInvoicesCount: sql<number>`COUNT(CASE WHEN ${invoices.status} != 'paid' THEN 1 END)::int`,
        lastPurchaseDate: sql<string>`MAX(${invoices.issueDate})::text`,
      })
      .from(invoices)
      .where(eq(invoices.clientId, clientId));

    const result = results[0];

    return {
      totalPurchases: Number(result?.totalPurchases || 0),
      unpaidInvoicesCount: Number(result?.unpaidInvoicesCount || 0),
      lastPurchaseDate: result?.lastPurchaseDate || null,
    };
  }

  async getClientMonthlyPurchases(clientId: number): Promise<ClientMonthlyPurchase[]> {
    const results = await db.execute(sql`
      SELECT 
        TO_CHAR(${invoices.issueDate}::date, 'Mon YYYY') as month,
        TO_CHAR(${invoices.issueDate}::date, 'YYYY-MM') as sort_key,
        COALESCE(SUM(${invoices.totalAmount}), 0)::text as total_amount,
        COUNT(*)::int as invoice_count
      FROM ${invoices}
      WHERE ${invoices.clientId} = ${clientId}
        AND ${invoices.status} = 'paid'
      GROUP BY TO_CHAR(${invoices.issueDate}::date, 'YYYY-MM'), TO_CHAR(${invoices.issueDate}::date, 'Mon YYYY')
      ORDER BY sort_key
    `);

    const rows = results as Array<{
      month: string;
      sort_key: string;
      total_amount: string;
      invoice_count: number;
    }>;

    return (rows || [])
      .sort((a, b) => (a.sort_key || '').localeCompare(b.sort_key || ''))
      .map(r => ({
        month: r.month,
        totalAmount: parseFloat(r.total_amount) || 0,
        invoiceCount: Number(r.invoice_count || 0),
      }));
  }

  // Supplier methods
  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async getSuppliers(storeId: number): Promise<Supplier[]> {
    return db.select().from(suppliers).where(eq(suppliers.storeId, storeId)).orderBy(suppliers.name);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    return createWithSimpleSequentialNumber<Supplier>(suppliers, suppliers.supplierNumber, "supplierNumber", "S", supplier);
  }

  async updateSupplier(id: number, supplierData: Partial<InsertSupplier>): Promise<Supplier> {
    const [updatedSupplier] = await db
      .update(suppliers)
      .set({ ...supplierData, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return updatedSupplier;
  }

  async deleteSupplier(id: number): Promise<void> {
    await db.delete(suppliers).where(eq(suppliers.id, id));
  }

  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async getCategories(storeId: number): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.storeId, storeId)).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductBySku(sku: string, storeId: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.sku, sku), eq(products.storeId, storeId)));
    return product;
  }

  async getProducts(storeId: number): Promise<Product[]> {
    return db
      .select()
      .from(products)
      .where(eq(products.storeId, storeId))
      .orderBy(products.name);
  }

  async getProductsWithLowStock(storeId: number): Promise<Product[]> {
    const lowStockProducts = await db.execute(sql`
      SELECT p.*, 
             COALESCE(SUM(pb.remaining_quantity), 0) as total_quantity
      FROM ${sql.identifier('products')} p
      LEFT JOIN ${sql.identifier('product_batches')} pb ON p.id = pb.product_id AND pb.store_id = ${storeId}
      WHERE p.store_id = ${storeId} AND p.is_active = true
      GROUP BY p.id
      HAVING COALESCE(SUM(pb.remaining_quantity), 0) <= p.min_stock
      ORDER BY p.name
    `);
    return lowStockProducts as any;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(productData).returning();
    return newProduct;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...productData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async deleteProducts(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(products).where(inArray(products.id, ids));
  }

  // Product dashboard methods
  async getProductStats(productId: number): Promise<ProductStats> {
    // Get current stock from product batches
    const stockResult = await db.execute(sql`
      SELECT COALESCE(SUM(remaining_quantity), 0) as current_stock
      FROM ${productBatches}
      WHERE product_id = ${productId}
    `);
    const currentStock = parseInt(stockResult[0]?.current_stock?.toString() || '0');

    // Get sales statistics from invoice items
    const salesResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CAST(ii.quantity AS DECIMAL)), 0) as total_sales,
        COALESCE(SUM(CAST(ii.total_amount AS DECIMAL)), 0) as total_revenue,
        COALESCE(AVG(CAST(ii.unit_price AS DECIMAL)), 0) as avg_price,
        COUNT(*) as sales_count
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${productId} AND i.status NOT IN ('draft', 'void', 'cancelled')
    `);

    const totalSales = parseInt(salesResult[0]?.total_sales?.toString() || '0');
    const totalRevenue = salesResult[0]?.total_revenue?.toString() || '0';
    const avgPrice = salesResult[0]?.avg_price?.toString() || '0';

    // Calculate average cost from product batches
    const costResult = await db.execute(sql`
      SELECT COALESCE(AVG(CAST(capital_cost AS DECIMAL)), 0) as avg_cost
      FROM ${productBatches}
      WHERE product_id = ${productId}
    `);
    const avgCost = costResult[0]?.avg_cost?.toString() || '0';

    // Calculate profit margin
    const avgPriceNum = parseFloat(avgPrice);
    const avgCostNum = parseFloat(avgCost);
    const profitMargin = avgPriceNum > 0 ? (((avgPriceNum - avgCostNum) / avgPriceNum) * 100).toFixed(2) + '%' : '0%';

    // Calculate average monthly sales
    const monthlyResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT TO_CHAR(i.issue_date, 'YYYY-MM')) as month_count,
        COALESCE(SUM(CAST(ii.quantity AS DECIMAL)), 0) as total_qty
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${productId} AND i.status NOT IN ('draft', 'void', 'cancelled')
        AND i.issue_date IS NOT NULL
    `);
    const monthCount = parseInt(monthlyResult[0]?.month_count?.toString() || '1') || 1;
    const totalQtyForAvg = parseFloat(monthlyResult[0]?.total_qty?.toString() || '0');
    const averageMonthlySales = Math.round(totalQtyForAvg / monthCount);

    return {
      totalSales,
      totalRevenue,
      totalPurchases: 0,
      totalCost: '0',
      currentStock,
      averageSellingPrice: avgPrice,
      averageCost: avgCost,
      profitMargin,
      averageMonthlySales
    };
  }

  async getProductSalesHistory(productId: number, page: number = 1, limit: number = 0): Promise<{ data: ProductSalesHistory[]; total: number }> {
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${productId} AND i.status NOT IN ('draft', 'void', 'cancelled')
    `);
    const total = parseInt((countResult[0] as any)?.total?.toString() || '0');

    let query = sql`
      SELECT 
        ii.id,
        i.id as invoice_id,
        i.invoice_number,
        c.name as client_name,
        CAST(ii.quantity AS DECIMAL) as quantity,
        ii.unit_price,
        ii.total_amount,
        i.issue_date as date,
        i.status
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      LEFT JOIN ${clients} c ON i.client_id = c.id
      WHERE ii.product_id = ${productId} AND i.status NOT IN ('draft', 'void', 'cancelled')
      ORDER BY i.issue_date DESC
    `;

    if (limit > 0) {
      const offset = (page - 1) * limit;
      query = sql`
        SELECT 
          ii.id,
          i.id as invoice_id,
          i.invoice_number,
          c.name as client_name,
          CAST(ii.quantity AS DECIMAL) as quantity,
          ii.unit_price,
          ii.total_amount,
          i.issue_date as date,
          i.status
        FROM ${invoiceItems} ii
        JOIN ${invoices} i ON ii.invoice_id = i.id
        LEFT JOIN ${clients} c ON i.client_id = c.id
        WHERE ii.product_id = ${productId} AND i.status != 'draft'
        ORDER BY i.issue_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const salesHistory = await db.execute(query);

    const data = salesHistory.map((row: any) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      clientName: row.client_name || 'Unknown Client',
      quantity: parseInt(row.quantity?.toString() || '0'),
      unitPrice: row.unit_price || '0',
      total: row.total_amount || '0',
      date: row.date ? new Date(row.date).toISOString().split('T')[0] : '',
      status: row.status || 'pending'
    }));

    return { data, total };
  }

  async getProductPurchaseHistory(productId: number, page: number = 1, limit: number = 0): Promise<{ data: ProductPurchaseHistory[]; total: number }> {
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM ${goodsReceiptItems} gri
      JOIN ${goodsReceipts} gr ON gri.goods_receipt_id = gr.id
      WHERE gri.product_id = ${productId}
    `);
    const total = parseInt((countResult[0] as any)?.total?.toString() || '0');

    let queryBuilder = db
      .select({
        id: goodsReceiptItems.id,
        goodsReceiptId: goodsReceipts.id,
        receiptNumber: goodsReceipts.receiptNumber,
        supplierName: goodsReceipts.supplierName,
        quantity: goodsReceiptItems.quantity,
        unitCost: goodsReceiptItems.unitCost,
        totalAmount: goodsReceiptItems.totalAmount,
        receiptDate: goodsReceipts.receiptDate,
        status: goodsReceipts.status,
      })
      .from(goodsReceiptItems)
      .innerJoin(goodsReceipts, eq(goodsReceiptItems.goodsReceiptId, goodsReceipts.id))
      .where(eq(goodsReceiptItems.productId, productId))
      .orderBy(desc(goodsReceipts.receiptDate));

    let result;
    if (limit > 0) {
      const offset = (page - 1) * limit;
      result = await queryBuilder.limit(limit).offset(offset);
    } else {
      result = await queryBuilder;
    }

    const data = result.map(row => ({
      id: row.id,
      goodsReceiptId: row.goodsReceiptId,
      receiptNumber: row.receiptNumber,
      supplierName: row.supplierName,
      quantity: parseFloat(row.quantity),
      unitCost: row.unitCost,
      total: row.totalAmount,
      date: row.receiptDate,
      status: row.status,
    }));

    return { data, total };
  }

  async getProductSalesTrend(productId: number, groupBy: 'daily' | 'monthly'): Promise<ProductSalesTrend[]> {
    const dateFormat = groupBy === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM';
    
    const result = await db.execute(sql`
      SELECT 
        TO_CHAR(i.issue_date, ${dateFormat}) as period,
        COALESCE(SUM(CAST(ii.quantity AS DECIMAL)), 0) as total_quantity,
        COALESCE(SUM(CAST(ii.total_amount AS DECIMAL)), 0) as total_revenue,
        COUNT(*) as count
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${productId} AND i.status != 'draft'
        AND i.issue_date IS NOT NULL
      GROUP BY TO_CHAR(i.issue_date, ${dateFormat})
      ORDER BY period ASC
    `);

    return (result as any[]).map((row: any) => ({
      period: row.period,
      totalQuantity: parseFloat(row.total_quantity?.toString() || '0'),
      totalRevenue: parseFloat(row.total_revenue?.toString() || '0'),
      count: parseInt(row.count?.toString() || '0'),
    }));
  }

  async getBundleComponentSales(bundleProductId: number): Promise<BundleComponentSales[]> {
    const components = await db
      .select({
        componentProductId: productBundleComponents.componentProductId,
        quantity: productBundleComponents.quantity,
        componentName: products.name,
        componentSku: products.sku,
      })
      .from(productBundleComponents)
      .innerJoin(products, eq(productBundleComponents.componentProductId, products.id))
      .where(eq(productBundleComponents.bundleProductId, bundleProductId));

    if (components.length === 0) return [];

    const bundleSalesResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CAST(ii.quantity AS DECIMAL)), 0) as bundle_qty,
        COALESCE(SUM(CAST(ii.total_amount AS DECIMAL)), 0) as bundle_revenue
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${bundleProductId} AND i.status != 'draft'
    `);
    const totalBundleQty = parseFloat(bundleSalesResult[0]?.bundle_qty?.toString() || '0');
    const totalBundleRevenue = parseFloat(bundleSalesResult[0]?.bundle_revenue?.toString() || '0');

    const results: BundleComponentSales[] = [];
    for (const comp of components) {
      const individualResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CAST(ii.quantity AS DECIMAL)), 0) as individual_qty,
          COALESCE(SUM(CAST(ii.total_amount AS DECIMAL)), 0) as individual_revenue
        FROM ${invoiceItems} ii
        JOIN ${invoices} i ON ii.invoice_id = i.id
        WHERE ii.product_id = ${comp.componentProductId} AND i.status != 'draft'
      `);
      const qtyPerBundle = parseFloat(comp.quantity);
      results.push({
        componentProductId: comp.componentProductId,
        componentName: comp.componentName,
        componentSku: comp.componentSku || '',
        qtyPerBundle,
        bundleSalesQty: totalBundleQty * qtyPerBundle,
        individualSalesQty: parseFloat(individualResult[0]?.individual_qty?.toString() || '0'),
        bundleRevenue: totalBundleRevenue,
        individualRevenue: parseFloat(individualResult[0]?.individual_revenue?.toString() || '0'),
      });
    }
    return results;
  }

  // Get reserved quantity for a product (from invoices with payment but not fully delivered)
  async getProductReservedQuantity(productId: number, storeId: number): Promise<number> {
    // Reserved = invoice items from invoices that have payments, minus already delivered quantities
    // Only count delivery note items where the delivery note is NOT cancelled
    const result = await db.execute(sql`
      SELECT 
        COALESCE(SUM(
          CAST(ii.quantity AS DECIMAL) - COALESCE(
            (SELECT SUM(CAST(dni.delivered_quantity AS DECIMAL)) 
             FROM ${deliveryNoteItems} dni 
             JOIN ${deliveryNotes} dn ON dn.id = dni.delivery_note_id
             WHERE dni.invoice_item_id = ii.id AND dn.status != 'cancelled'), 0
          )
        ), 0) as reserved_qty
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${productId}
        AND i.store_id = ${storeId}
        AND i.status != 'draft'
        AND i.status != 'void'
        AND EXISTS (SELECT 1 FROM ${invoicePayments} ip WHERE ip.invoice_id = i.id)
        AND CAST(ii.quantity AS DECIMAL) > COALESCE(
          (SELECT SUM(CAST(dni.delivered_quantity AS DECIMAL)) 
           FROM ${deliveryNoteItems} dni 
           JOIN ${deliveryNotes} dn ON dn.id = dni.delivery_note_id
           WHERE dni.invoice_item_id = ii.id AND dn.status != 'cancelled'), 0
        )
    `);
    return parseFloat(result[0]?.reserved_qty?.toString() || '0');
  }

  // Get all reserved items for a product with invoice and client details
  async getProductReservations(productId: number, storeId: number): Promise<Array<{
    invoiceId: number;
    invoiceNumber: string;
    clientId: number | null;
    clientName: string;
    reservedQuantity: number;
    totalInvoiceQty: number;
    deliveredQty: number;
  }>> {
    const result = await db.execute(sql`
      SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.client_id,
        COALESCE(c.name, 'Walk-in Customer') as client_name,
        CAST(ii.quantity AS DECIMAL) as total_qty,
        COALESCE(
          (SELECT SUM(CAST(dni.delivered_quantity AS DECIMAL)) 
           FROM ${deliveryNoteItems} dni 
           JOIN ${deliveryNotes} dn ON dn.id = dni.delivery_note_id
           WHERE dni.invoice_item_id = ii.id AND dn.status != 'cancelled'), 0
        ) as delivered_qty
      FROM ${invoiceItems} ii
      JOIN ${invoices} i ON ii.invoice_id = i.id
      LEFT JOIN ${clients} c ON i.client_id = c.id
      WHERE ii.product_id = ${productId}
        AND i.store_id = ${storeId}
        AND i.status != 'draft'
        AND i.status != 'void'
        AND EXISTS (SELECT 1 FROM ${invoicePayments} ip WHERE ip.invoice_id = i.id)
        AND CAST(ii.quantity AS DECIMAL) > COALESCE(
          (SELECT SUM(CAST(dni.delivered_quantity AS DECIMAL)) 
           FROM ${deliveryNoteItems} dni 
           JOIN ${deliveryNotes} dn ON dn.id = dni.delivery_note_id
           WHERE dni.invoice_item_id = ii.id AND dn.status != 'cancelled'), 0
        )
      ORDER BY i.issue_date DESC
    `);
    
    return result.map((row: any) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      clientId: row.client_id,
      clientName: row.client_name,
      reservedQuantity: parseFloat(row.total_qty) - parseFloat(row.delivered_qty),
      totalInvoiceQty: parseFloat(row.total_qty),
      deliveredQty: parseFloat(row.delivered_qty),
    }));
  }

  // Get available quantity for a product (stock - reserved)
  async getProductAvailableQuantity(productId: number, storeId: number): Promise<{ stock: number; reserved: number; available: number }> {
    // Get current stock
    const stockResult = await db.execute(sql`
      SELECT COALESCE(SUM(CAST(remaining_quantity AS DECIMAL)), 0) as stock
      FROM ${productBatches}
      WHERE product_id = ${productId} AND store_id = ${storeId}
    `);
    const stock = parseFloat(stockResult[0]?.stock?.toString() || '0');
    
    // Get reserved quantity
    const reserved = await this.getProductReservedQuantity(productId, storeId);
    
    return {
      stock,
      reserved,
      available: Math.max(0, stock - reserved)
    };
  }

  // Product batch methods
  async getProductBatch(id: number): Promise<ProductBatch | undefined> {
    const [batch] = await db.select().from(productBatches).where(eq(productBatches.id, id));
    return batch;
  }

  async getProductBatches(productId: number, storeId: number): Promise<ProductBatch[]> {
    return db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.productId, productId),
          eq(productBatches.storeId, storeId)
        )
      )
      .orderBy(productBatches.purchaseDate);
  }

  async createProductBatch(batchData: InsertProductBatch): Promise<ProductBatch> {
    const [newBatch] = await db.insert(productBatches).values(batchData).returning();
    return newBatch;
  }

  async updateProductBatch(id: number, batchData: Partial<InsertProductBatch>): Promise<ProductBatch> {
    const [updatedBatch] = await db
      .update(productBatches)
      .set({ ...batchData, updatedAt: new Date() })
      .where(eq(productBatches.id, id))
      .returning();
    return updatedBatch;
  }

  async deleteProductBatch(id: number): Promise<void> {
    await db.delete(productBatches).where(eq(productBatches.id, id));
  }

  // Product bundle component methods
  async getBundleComponents(bundleProductId: number): Promise<(ProductBundleComponent & { componentProduct: Product })[]> {
    const components = await db
      .select()
      .from(productBundleComponents)
      .where(eq(productBundleComponents.bundleProductId, bundleProductId));
    
    // Fetch component products
    const result: (ProductBundleComponent & { componentProduct: Product })[] = [];
    for (const component of components) {
      const [componentProduct] = await db
        .select()
        .from(products)
        .where(eq(products.id, component.componentProductId));
      if (componentProduct) {
        result.push({ ...component, componentProduct });
      }
    }
    return result;
  }

  async setBundleComponents(bundleProductId: number, components: { componentProductId: number; quantity: number | string }[]): Promise<ProductBundleComponent[]> {
    // Delete existing components
    await db.delete(productBundleComponents).where(eq(productBundleComponents.bundleProductId, bundleProductId));
    
    if (components.length === 0) {
      return [];
    }
    
    // Insert new components
    const newComponents = await db
      .insert(productBundleComponents)
      .values(
        components.map(c => ({
          bundleProductId,
          componentProductId: c.componentProductId,
          quantity: String(c.quantity)
        }))
      )
      .returning();
    
    return newComponents;
  }

  async getBundleStock(bundleProductId: number, storeId: number): Promise<number> {
    const components = await db
      .select()
      .from(productBundleComponents)
      .where(eq(productBundleComponents.bundleProductId, bundleProductId));
    
    if (components.length === 0) {
      return 0;
    }
    
    let minBundles = Infinity;
    
    for (const component of components) {
      const batches = await db
        .select({ 
          remainingQuantity: productBatches.remainingQuantity,
          reservedQuantity: productBatches.reservedQuantity
        })
        .from(productBatches)
        .where(
          and(
            eq(productBatches.productId, component.componentProductId),
            eq(productBatches.storeId, storeId)
          )
        );
      
      const totalStock = batches.reduce((sum, b) => sum + parseFloat(b.remainingQuantity || '0'), 0);
      const totalReserved = batches.reduce((sum, b) => sum + parseFloat(b.reservedQuantity?.toString() || '0'), 0);
      const availableStock = Math.max(0, totalStock - totalReserved);
      const requiredQty = parseFloat(component.quantity);
      const possibleBundles = Math.floor(availableStock / requiredQty);
      
      minBundles = Math.min(minBundles, possibleBundles);
    }
    
    return minBundles === Infinity ? 0 : minBundles;
  }

  // Product unit methods
  async getProductUnits(productId: number): Promise<ProductUnit[]> {
    return db
      .select()
      .from(productUnits)
      .where(eq(productUnits.productId, productId))
      .orderBy(productUnits.conversionFactor);
  }

  async getProductUnit(id: number): Promise<ProductUnit | undefined> {
    const [unit] = await db.select().from(productUnits).where(eq(productUnits.id, id));
    return unit;
  }

  async setProductUnits(productId: number, units: InsertProductUnit[]): Promise<ProductUnit[]> {
    // Delete existing units for this product
    await db.delete(productUnits).where(eq(productUnits.productId, productId));
    
    if (units.length === 0) {
      return [];
    }
    
    // Insert new units
    const newUnits = await db
      .insert(productUnits)
      .values(units.map(u => ({ ...u, productId })))
      .returning();
    
    return newUnits;
  }

  async deleteProductUnit(id: number): Promise<void> {
    await db.delete(productUnits).where(eq(productUnits.id, id));
  }

  // Helper method to check and update overdue status automatically
  private async checkAndUpdateOverdueStatus(invoice: Invoice): Promise<Invoice> {
    // Only check for invoices that are not already paid, void, overdue, or draft
    if (invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'overdue' || invoice.status === 'draft') {
      return invoice;
    }
    
    // Skip if no due date is set
    if (!invoice.dueDate) {
      return invoice;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(invoice.dueDate);
    // Skip if invalid date
    if (isNaN(dueDate.getTime())) {
      return invoice;
    }
    dueDate.setHours(0, 0, 0, 0);
    
    // If due date has passed, update to overdue
    if (dueDate < today) {
      const [updatedInvoice] = await db
        .update(invoices)
        .set({ status: 'overdue', updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id))
        .returning();
      return updatedInvoice;
    }
    
    return invoice;
  }

  // Invoice methods
  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;
    return this.checkAndUpdateOverdueStatus(invoice);
  }

  async getInvoiceWithItems(id: number): Promise<{ invoice: Invoice; items: (InvoiceItem & { productCode?: string; productSku?: string; unitLabel?: string })[]; client?: Client } | undefined> {
    let [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));

    if (!invoice) {
      return undefined;
    }

    // Check and update overdue status
    invoice = await this.checkAndUpdateOverdueStatus(invoice);

    // Single query with JOINs to get items with product and unit info
    const enrichedItems = await db
      .select({
        // Invoice item fields
        id: invoiceItems.id,
        invoiceId: invoiceItems.invoiceId,
        productId: invoiceItems.productId,
        productUnitId: invoiceItems.productUnitId,
        description: invoiceItems.description,
        quantity: invoiceItems.quantity,
        baseQuantity: invoiceItems.baseQuantity,
        unitPrice: invoiceItems.unitPrice,
        taxRate: invoiceItems.taxRate,
        taxAmount: invoiceItems.taxAmount,
        discount: invoiceItems.discount,
        subtotal: invoiceItems.subtotal,
        totalAmount: invoiceItems.totalAmount,
        profit: invoiceItems.profit,
        createdAt: invoiceItems.createdAt,
        updatedAt: invoiceItems.updatedAt,
        // Product fields
        productSku: products.sku,
        productBaseUnit: products.unit,
        // Product unit fields (for multi-unit)
        selectedUnitLabel: productUnits.unitLabel,
      })
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .leftJoin(productUnits, eq(invoiceItems.productUnitId, productUnits.id))
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(invoiceItems.id);

    // Transform to add derived fields
    const items = enrichedItems.map(item => ({
      id: item.id,
      invoiceId: item.invoiceId,
      productId: item.productId,
      productUnitId: item.productUnitId,
      description: item.description,
      quantity: item.quantity,
      baseQuantity: item.baseQuantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      discount: item.discount,
      subtotal: item.subtotal,
      totalAmount: item.totalAmount,
      profit: item.profit,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      // Enriched fields
      productCode: item.productSku || undefined,
      productSku: item.productSku || undefined,
      unitLabel: item.selectedUnitLabel || item.productBaseUnit || undefined,
    }));

    let client;
    if (invoice.clientId) {
      [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId));
    }

    return { invoice, items, client };
  }

  async getInvoices(storeId: number): Promise<(Invoice & { clientName: string | null })[]> {
    const results = await db
      .select({
        id: invoices.id,
        storeId: invoices.storeId,
        invoiceNumber: invoices.invoiceNumber,
        clientId: invoices.clientId,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        status: invoices.status,
        isVoided: invoices.isVoided,
        subtotal: invoices.subtotal,
        taxRate: invoices.taxRate,
        taxAmount: invoices.taxAmount,
        discount: invoices.discount,
        shipping: invoices.shipping,
        totalAmount: invoices.totalAmount,
        totalProfit: invoices.totalProfit,
        termsAndConditions: invoices.termsAndConditions,
        paperSize: invoices.paperSize,
        notes: invoices.notes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        clientName: clients.name
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(eq(invoices.storeId, storeId))
      .orderBy(desc(invoices.id));

    // Check and update overdue status for applicable invoices
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const updatedResults = await Promise.all(
      results.map(async (invoice) => {
        // Only check for invoices that are sent or pending (not paid, void, overdue, or draft)
        if (invoice.status === 'sent' || invoice.status === 'pending') {
          // Skip if no due date is set
          if (!invoice.dueDate) {
            return invoice;
          }
          
          const dueDate = new Date(invoice.dueDate);
          // Skip if invalid date
          if (isNaN(dueDate.getTime())) {
            return invoice;
          }
          dueDate.setHours(0, 0, 0, 0);
          
          if (dueDate < today) {
            // Update status to overdue
            await db
              .update(invoices)
              .set({ status: 'overdue', updatedAt: new Date() })
              .where(eq(invoices.id, invoice.id));
            return { ...invoice, status: 'overdue' as const };
          }
        }
        return invoice;
      })
    );

    return updatedResults;
  }

  async getInvoicesByClient(clientId: number): Promise<Invoice[]> {
    const results = await db
      .select()
      .from(invoices)
      .where(eq(invoices.clientId, clientId))
      .orderBy(desc(invoices.issueDate));
    
    return Promise.all(results.map(inv => this.checkAndUpdateOverdueStatus(inv)));
  }

  async getRecentInvoices(storeId: number, limit: number): Promise<Invoice[]> {
    const results = await db
      .select()
      .from(invoices)
      .where(eq(invoices.storeId, storeId))
      .orderBy(desc(invoices.issueDate))
      .limit(limit);
    
    // Apply overdue check
    return Promise.all(results.map(inv => this.checkAndUpdateOverdueStatus(inv)));
  }

  async getOpenInvoices(storeId: number): Promise<Invoice[]> {
    // Include 'pending' in the query since those could become overdue
    const results = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.storeId, storeId),
          inArray(invoices.status, ["draft", "sent", "pending", "overdue"])
        )
      )
      .orderBy(desc(invoices.issueDate));
    
    // Apply overdue check
    return Promise.all(results.map(inv => this.checkAndUpdateOverdueStatus(inv)));
  }

  async getReturnableInvoices(storeId: number): Promise<(Invoice & { clientName: string | null; lastPaymentDate: Date | null })[]> {
    // Read return window from settings, default to 30 days
    const windowSetting = await this.getSetting(storeId, 'return_window_days');
    const windowDays = windowSetting ? parseInt(windowSetting.value) : 30;

    // Get all paid invoices with their last payment date
    const results = await db
      .select({
        invoice: invoices,
        clientName: clients.name,
        lastPaymentDate: sql<Date>`(SELECT MAX(payment_date) FROM invoice_payments WHERE invoice_id = ${invoices.id})`.as('lastPaymentDate')
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(
        and(
          eq(invoices.storeId, storeId),
          eq(invoices.status, 'paid')
        )
      )
      .orderBy(desc(invoices.id));

    // Filter by window — if windowDays = 0, no time restriction
    return results.filter(row => {
      if (windowDays === 0) return true;
      if (!row.lastPaymentDate) return false;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - windowDays);
      return new Date(row.lastPaymentDate) >= cutoff;
    }).map(row => ({
      ...row.invoice,
      clientName: row.clientName,
      lastPaymentDate: row.lastPaymentDate
    }));
  }

  async getDeliveredQuantitiesForInvoice(invoiceId: number): Promise<{ invoiceItemId: number; deliveredQty: number }[]> {
    const rows = await db
      .select({
        invoiceItemId: deliveryNoteItems.invoiceItemId,
        total: sql<string>`SUM(${deliveryNoteItems.deliveredQuantity})`
      })
      .from(deliveryNoteItems)
      .innerJoin(deliveryNotes, eq(deliveryNoteItems.deliveryNoteId, deliveryNotes.id))
      .where(
        and(
          eq(deliveryNotes.invoiceId, invoiceId),
          eq(deliveryNotes.status, 'delivered')
        )
      )
      .groupBy(deliveryNoteItems.invoiceItemId);

    return rows.map(r => ({
      invoiceItemId: r.invoiceItemId,
      deliveredQty: parseFloat(r.total || '0')
    }));
  }

  async createInvoice(invoiceData: InsertInvoice, items: Array<InsertInvoiceItem & { productId: number; quantity: number | string }>): Promise<Invoice> {
    // Use the safe number generation for the base invoice, then process items
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await withTransaction(async (tx) => {
          // Get year and month from issue date or current date
          const issueDate = invoiceData.issueDate ? new Date(invoiceData.issueDate) : new Date();
          const year = issueDate.getFullYear().toString().slice(-2); // Get last 2 digits of year
          const month = (issueDate.getMonth() + 1).toString().padStart(2, '0'); // Get month with leading zero
          const yearMonth = year + month;

          const invoiceNumber = await generateNextNumber("INV", yearMonth, invoices, invoices.invoiceNumber, tx);

          // Create the invoice with auto-generated number
          const [newInvoice] = await tx
            .insert(invoices)
            .values({
              ...invoiceData,
              invoiceNumber
            })
            .returning();

      // Create invoice items (batch allocation and profit calculation moved to Delivery Note)
      for (const item of items) {
        const quantityNeeded = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;

        await tx
          .insert(invoiceItems)
          .values({
            ...item,
            invoiceId: newInvoice.id,
            quantity: quantityNeeded.toString()
          });
      }

      // Calculate invoice totals from items
      let invoiceSubtotal = 0;
      let invoiceTaxAmount = 0;

      for (const item of items) {
        invoiceSubtotal += parseFloat(item.subtotal.toString());
        invoiceTaxAmount += parseFloat(item.taxAmount?.toString() || "0");
      }

      const discount = parseFloat(invoiceData.discount?.toString() || "0");
      const shipping = parseFloat((invoiceData as any).shipping?.toString() || "0");
      const invoiceTotalAmount = invoiceSubtotal + invoiceTaxAmount - discount + shipping;

      // Update the invoice with calculated totals (profit will be calculated when Delivery Note is delivered)
      await tx
        .update(invoices)
        .set({ 
          subtotal: invoiceSubtotal.toString(),
          taxAmount: invoiceTaxAmount.toString(),
          totalAmount: invoiceTotalAmount.toString(),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, newInvoice.id));

      // Return the invoice with the updated totals
      const [updatedInvoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, newInvoice.id));

      return updatedInvoice;
        });
      } catch (error: any) {
        // Check if this is a unique constraint violation
        if (error?.code === '23505' && error?.detail?.includes('invoiceNumber')) {
          if (attempt === maxRetries) {
            throw new Error(`Failed to create invoice with unique number after ${maxRetries} attempts due to concurrency conflicts`);
          }
          // Wait with exponential backoff before retry
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
          continue;
        }
        // For other errors, don't retry
        throw error;
      }
    }

    throw new Error(`Failed to create invoice with unique number`);
  }

  async updateInvoice(id: number, invoiceData: Partial<InsertInvoice>): Promise<Invoice> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ ...invoiceData, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async updateInvoiceWithItems(id: number, invoiceData: Partial<InsertInvoice>, items: Array<InsertInvoiceItem & { id?: number; productId: number; quantity: number | string }>): Promise<Invoice> {
    return withTransaction(async (tx) => {
      // Check if invoice has any delivery notes with non-cancelled status
      const existingDeliveryNotes = await tx
        .select()
        .from(deliveryNotes)
        .where(
          and(
            eq(deliveryNotes.invoiceId, id),
            not(eq(deliveryNotes.status, 'cancelled'))
          )
        );

      if (existingDeliveryNotes.length > 0) {
        throw new Error('Cannot modify invoice items - delivery notes exist. Cancel or delete delivery notes first.');
      }

      // Update invoice metadata
      if (Object.keys(invoiceData).length > 0) {
        await tx
          .update(invoices)
          .set({ ...invoiceData, updatedAt: new Date() })
          .where(eq(invoices.id, id));
      }

      // Delete existing invoice items
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

      // Insert new items
      for (const item of items) {
        const quantityNeeded = typeof item.quantity === 'string' ? parseFloat(item.quantity) : item.quantity;

        await tx
          .insert(invoiceItems)
          .values({
            ...item,
            id: undefined, // Ensure new ID is assigned
            invoiceId: id,
            quantity: quantityNeeded.toString()
          });
      }

      // Recalculate invoice totals
      let invoiceSubtotal = 0;
      let invoiceTaxAmount = 0;

      for (const item of items) {
        invoiceSubtotal += parseFloat(item.subtotal.toString());
        invoiceTaxAmount += parseFloat(item.taxAmount?.toString() || "0");
      }

      const discount = parseFloat(invoiceData.discount?.toString() || "0");
      const shipping = parseFloat((invoiceData as any).shipping?.toString() || "0");
      const invoiceTotalAmount = invoiceSubtotal + invoiceTaxAmount - discount + shipping;

      // Update invoice with recalculated totals
      const [updatedInvoice] = await tx
        .update(invoices)
        .set({ 
          subtotal: invoiceSubtotal.toString(),
          taxAmount: invoiceTaxAmount.toString(),
          totalAmount: invoiceTotalAmount.toString(),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, id))
        .returning();

      return updatedInvoice;
    });
  }

  async updateInvoiceStatus(id: number, status: string): Promise<Invoice> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));

    if (!invoice) {
      throw new Error(`Invoice with ID ${id} not found`);
    }

    // Simple status update (batch allocation moved to Delivery Note)
    return withTransaction(async (tx) => {
      const [updatedInvoice] = await tx
        .update(invoices)
        .set({ 
          status: status as any,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, id))
        .returning();

      return updatedInvoice;
    });
  }

  async voidInvoice(id: number): Promise<Invoice> {
    return withTransaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      if (!invoice) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      // 1. Restore stock if self_pickup
      if (invoice.deliveryType === 'self_pickup') {
        // This handles both stock return and profit data reset
        await this.returnStockFromSelfPickup(id, tx);
      }

      // 2. Restore stock for all delivery notes
      const dns = await tx
        .select()
        .from(deliveryNotes)
        .where(
          and(
            eq(deliveryNotes.invoiceId, id),
            not(eq(deliveryNotes.status, 'cancelled'))
          )
        );

      for (const dn of dns) {
        // This restores stock to batches and resets DN profit data
        await this.restorePendingDeliveryNoteStock(dn.id, tx);
        // Mark DN as cancelled
        await tx
          .update(deliveryNotes)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(deliveryNotes.id, dn.id));
      }

      // 3. Void the invoice
      const [updatedInvoice] = await tx
        .update(invoices)
        .set({ 
          isVoided: true,
          status: 'void' as any,
          updatedAt: new Date()
        })
        .where(eq(invoices.id, id))
        .returning();

      return updatedInvoice;
    });
  }

  async deleteInvoice(id: number): Promise<void> {
    return withTransaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      if (!invoice) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      // If the invoice is paid, we need to release reserved stock
      if (invoice.status === 'paid') {
        // Release reserved quantities from batches
        const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        
        for (const item of items) {
          const quantityToRelease = parseFloat(item.baseQuantity?.toString() || item.quantity.toString());
          
          // Get batches for this product
          const batches = await tx
            .select()
            .from(productBatches)
            .where(
              and(
                eq(productBatches.productId, item.productId),
                eq(productBatches.storeId, invoice.storeId),
                gt(productBatches.reservedQuantity, 0)
              )
            )
            .orderBy(productBatches.purchaseDate);

          let remainingToRelease = quantityToRelease;

          for (const batch of batches) {
            if (remainingToRelease <= 0) break;

            const reserved = parseFloat(batch.reservedQuantity?.toString() || '0');
            const releaseFromBatch = Math.min(remainingToRelease, reserved);

            if (releaseFromBatch > 0) {
              await tx
                .update(productBatches)
                .set({
                  reservedQuantity: (reserved - releaseFromBatch).toString(),
                  updatedAt: new Date()
                })
                .where(eq(productBatches.id, batch.id));

              remainingToRelease -= releaseFromBatch;
            }
          }
        }
      }

      // Delete transaction records for this invoice
      await tx
        .delete(transactions)
        .where(eq(transactions.invoiceId, id));

      // Delete invoice payments
      await tx
        .delete(invoicePayments)
        .where(eq(invoicePayments.invoiceId, id));

      // Delete delivery notes and their items
      const deliveryNoteList = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.invoiceId, id));
      for (const dn of deliveryNoteList) {
        // If delivery was delivered, we need to restore stock
        if (dn.status === 'delivered') {
          // Use the reverse method logic inline
          const dnItems = await tx.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, dn.id));
          
          for (const dnItem of dnItems) {
            const [invItem] = await tx.select().from(invoiceItems).where(eq(invoiceItems.id, dnItem.invoiceItemId));
            if (!invItem) continue;

            const deliveredQty = parseFloat(dnItem.deliveredQuantity.toString());
            let baseDeliveredQty = deliveredQty;
            if (invItem.baseQuantity && invItem.quantity) {
              const ratio = parseFloat(invItem.baseQuantity.toString()) / parseFloat(invItem.quantity.toString());
              baseDeliveredQty = deliveredQty * ratio;
            }

            // Restore to batches (LIFO)
            const batches = await tx
              .select()
              .from(productBatches)
              .where(
                and(
                  eq(productBatches.productId, invItem.productId),
                  eq(productBatches.storeId, invoice.storeId)
                )
              )
              .orderBy(desc(productBatches.purchaseDate));

            let remainingToRestore = baseDeliveredQty;

            for (const batch of batches) {
              if (remainingToRestore <= 0) break;

              const totalQty = parseFloat(batch.initialQuantity.toString());
              const remainingQty = parseFloat(batch.remainingQuantity.toString());
              const canRestore = Math.min(remainingToRestore, totalQty - remainingQty);
              
              if (canRestore > 0) {
                await tx
                  .update(productBatches)
                  .set({
                    remainingQuantity: (remainingQty + canRestore).toString(),
                    updatedAt: new Date()
                  })
                  .where(eq(productBatches.id, batch.id));

                remainingToRestore -= canRestore;
              }
            }
          }
        }
        
        await tx.delete(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, dn.id));
      }
      await tx.delete(deliveryNotes).where(eq(deliveryNotes.invoiceId, id));

      // Delete invoice item batch allocations (legacy table)
      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      for (const item of items) {
        await tx.delete(invoiceItemBatches).where(eq(invoiceItemBatches.invoiceItemId, item.id));
      }

      // Delete invoice items
      await tx
        .delete(invoiceItems)
        .where(eq(invoiceItems.invoiceId, id));

      // Delete the invoice
      await tx
        .delete(invoices)
        .where(eq(invoices.id, id));
    });
  }

  // Invoice payment methods
  async getInvoicePayment(paymentId: number): Promise<InvoicePayment | undefined> {
    const [payment] = await db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.id, paymentId));
    return payment;
  }

  async getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]> {
    const payments = await db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId))
      .orderBy(desc(invoicePayments.paymentDate));
    
    return payments;
  }

  async createInvoicePayment(payment: InsertInvoicePayment): Promise<InvoicePayment> {
    const [newPayment] = await db
      .insert(invoicePayments)
      .values(payment)
      .returning();
    
    return newPayment;
  }

  async updateInvoicePayment(id: number, payment: Partial<InsertInvoicePayment>): Promise<InvoicePayment> {
    const [updatedPayment] = await db
      .update(invoicePayments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(invoicePayments.id, id))
      .returning();
    
    if (!updatedPayment) {
      throw new Error(`Invoice payment with ID ${id} not found`);
    }
    
    return updatedPayment;
  }

  async deleteInvoicePayment(id: number): Promise<void> {
    await db
      .delete(invoicePayments)
      .where(eq(invoicePayments.id, id));
  }

  private async expandBundleItems(tx: any, items: { productId: number; quantity: string; baseQuantity?: string | null }[]): Promise<{ productId: number; quantity: number }[]> {
    const expandedItems: { productId: number; quantity: number }[] = [];
    
    for (const item of items) {
      const itemQty = parseFloat(item.baseQuantity?.toString() || item.quantity.toString());
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId));
      
      if (product && product.productType === 'bundle') {
        const components = await tx
          .select()
          .from(productBundleComponents)
          .where(eq(productBundleComponents.bundleProductId, product.id));
        
        for (const comp of components) {
          const compQty = parseFloat(comp.quantity) * itemQty;
          expandedItems.push({ productId: comp.componentProductId, quantity: compQty });
        }
      } else {
        expandedItems.push({ productId: item.productId, quantity: itemQty });
      }
    }
    
    return expandedItems;
  }

  // Stock reservation methods (for paid invoices awaiting delivery)
  async reserveStockForInvoice(invoiceId: number): Promise<void> {
    return withTransaction(async (tx) => {
      const invoice = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice.length) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const expandedItems = await this.expandBundleItems(tx, items);

      for (const { productId, quantity: quantityToReserve } of expandedItems) {
        const availableBatches = await tx
          .select()
          .from(productBatches)
          .where(
            and(
              eq(productBatches.productId, productId),
              eq(productBatches.storeId, invoice[0].storeId)
            )
          )
          .orderBy(productBatches.purchaseDate);

        let remainingToReserve = quantityToReserve;

        for (const batch of availableBatches) {
          if (remainingToReserve <= 0) break;

          const remaining = parseFloat(batch.remainingQuantity.toString());
          const reserved = parseFloat(batch.reservedQuantity?.toString() || '0');
          const availableToReserve = remaining - reserved;

          if (availableToReserve <= 0) continue;

          const quantityFromBatch = Math.min(remainingToReserve, availableToReserve);

          await tx
            .update(productBatches)
            .set({ 
              reservedQuantity: (reserved + quantityFromBatch).toString(),
              updatedAt: new Date()
            })
            .where(eq(productBatches.id, batch.id));

          remainingToReserve -= quantityFromBatch;
        }
      }
    });
  }

  async releaseStockReservationForInvoice(invoiceId: number): Promise<void> {
    return withTransaction(async (tx) => {
      // Get the invoice with its items
      const invoice = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice.length) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
      const expandedItems = await this.expandBundleItems(tx, items);

      for (const { productId, quantity: quantityToRelease } of expandedItems) {
        const reservedBatches = await tx
          .select()
          .from(productBatches)
          .where(
            and(
              eq(productBatches.productId, productId),
              eq(productBatches.storeId, invoice[0].storeId),
              gt(productBatches.reservedQuantity, 0)
            )
          )
          .orderBy(productBatches.purchaseDate);

        let remainingToRelease = quantityToRelease;

        for (const batch of reservedBatches) {
          if (remainingToRelease <= 0) break;

          const reserved = parseFloat(batch.reservedQuantity?.toString() || '0');
          const releaseFromBatch = Math.min(remainingToRelease, reserved);

          await tx
            .update(productBatches)
            .set({ 
              reservedQuantity: Math.max(0, reserved - releaseFromBatch).toString(),
              updatedAt: new Date()
            })
            .where(eq(productBatches.id, batch.id));

          remainingToRelease -= releaseFromBatch;
        }
      }
    });
  }

  // Self pickup stock deduction (when self_pickup invoice is paid)
  async deductStockForSelfPickup(invoiceId: number): Promise<void> {
    return withTransaction(async (tx) => {
      // Get the invoice
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      if (invoice.deliveryType !== 'self_pickup') {
        throw new Error(`Invoice is not a self_pickup invoice`);
      }

      const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

      let totalCost = 0;
      let totalRevenue = 0;

      for (const item of items) {
        const unitPrice = parseFloat(item.unitPrice.toString());
        const itemQty = parseFloat(item.quantity.toString());
        totalRevenue += itemQty * unitPrice;

        const expandedItems = await this.expandBundleItems(tx, [item]);
        let itemCost = 0;

        for (const { productId, quantity: quantityToDeduct } of expandedItems) {
          const availableBatches = await tx
            .select()
            .from(productBatches)
            .where(
              and(
                eq(productBatches.productId, productId),
                eq(productBatches.storeId, invoice.storeId),
                gt(productBatches.remainingQuantity, 0)
              )
            )
            .orderBy(productBatches.purchaseDate);

          let remainingToDeduct = quantityToDeduct;

          for (const batch of availableBatches) {
            if (remainingToDeduct <= 0) break;

            const remaining = parseFloat(batch.remainingQuantity.toString());
            const reserved = parseFloat(batch.reservedQuantity?.toString() || '0');
            const capitalCost = parseFloat(batch.capitalCost?.toString() || '0');

            const deductFromBatch = Math.min(remainingToDeduct, remaining);
            itemCost += deductFromBatch * capitalCost;

            const newReserved = Math.max(0, reserved - deductFromBatch);
            const newRemaining = remaining - deductFromBatch;

            await tx
              .update(productBatches)
              .set({
                remainingQuantity: newRemaining.toString(),
                reservedQuantity: newReserved.toString(),
                updatedAt: new Date()
              })
              .where(eq(productBatches.id, batch.id));

            remainingToDeduct -= deductFromBatch;
          }
        }

        totalCost += itemCost;

        // Save per-item profit to invoice_items.profit (uses quantity at the invoice unit level)
        const itemRevenue = itemQty * unitPrice;
        const itemProfit = itemRevenue - itemCost;
        await tx
          .update(invoiceItems)
          .set({ profit: itemProfit.toString() })
          .where(eq(invoiceItems.id, item.id));
      }

      // Save total profit to invoices.totalProfit
      const profit = totalRevenue - totalCost;
      await tx
        .update(invoices)
        .set({
          totalProfit: profit.toString(),
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId));
    });
  }

  async returnStockFromSelfPickup(invoiceId: number, tx?: any): Promise<void> {
    const action = async (transaction: any) => {
      // Get the invoice
      const [invoice] = await transaction.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        throw new Error(`Invoice with ID ${invoiceId} not found`);
      }

      const items = await transaction.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

      // For each item, return stock by creating adjustment batches (similar to returns)
      for (const item of items) {
        const quantityToReturn = parseFloat(item.baseQuantity?.toString() || item.quantity.toString());
        
        // Get the unit cost from invoice item
        const unitCost = parseFloat(item.unitCost?.toString() || '0');

        // Create a new batch for the returned stock
        await transaction.insert(productBatches).values({
          productId: item.productId,
          storeId: invoice.storeId,
          batchNumber: `PICKUP-RETURN-INV-${invoice.invoiceNumber}`,
          initialQuantity: quantityToReturn.toString(),
          remainingQuantity: quantityToReturn.toString(),
          capitalCost: unitCost.toString(),
          purchaseDate: new Date().toISOString().split('T')[0],
        });
      }

      // Reset invoice profit data
      await transaction
        .update(invoices)
        .set({
          totalCost: '0',
          profit: '0',
          updatedAt: new Date()
        })
        .where(eq(invoices.id, invoiceId));
    };

    if (tx) return action(tx);
    return withTransaction(action);
  }

  // Purchase order payment methods (for prepaid POs)
  async getPurchaseOrderPayment(paymentId: number): Promise<PurchaseOrderPayment | undefined> {
    const [payment] = await db
      .select()
      .from(purchaseOrderPayments)
      .where(eq(purchaseOrderPayments.id, paymentId));
    return payment;
  }

  async getPurchaseOrderPayments(purchaseOrderId: number): Promise<PurchaseOrderPayment[]> {
    const payments = await db
      .select()
      .from(purchaseOrderPayments)
      .where(eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(purchaseOrderPayments.paymentDate));
    
    return payments;
  }

  async getPurchaseOrderPaidAmount(purchaseOrderId: number): Promise<number> {
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(${purchaseOrderPayments.amount}), 0)`
      })
      .from(purchaseOrderPayments)
      .where(eq(purchaseOrderPayments.purchaseOrderId, purchaseOrderId));
    
    return parseFloat(result[0]?.total || '0');
  }

  async createPurchaseOrderPayment(payment: InsertPurchaseOrderPayment): Promise<PurchaseOrderPayment> {
    const [newPayment] = await db
      .insert(purchaseOrderPayments)
      .values(payment)
      .returning();
    
    return newPayment;
  }

  async updatePurchaseOrderPayment(id: number, payment: Partial<InsertPurchaseOrderPayment>): Promise<PurchaseOrderPayment> {
    const [updatedPayment] = await db
      .update(purchaseOrderPayments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(purchaseOrderPayments.id, id))
      .returning();
    
    if (!updatedPayment) {
      throw new Error(`Purchase order payment with ID ${id} not found`);
    }
    
    return updatedPayment;
  }

  async deletePurchaseOrderPayment(id: number): Promise<void> {
    await db
      .delete(purchaseOrderPayments)
      .where(eq(purchaseOrderPayments.id, id));
  }

  // Delivery note methods
  async getDeliveryNote(id: number): Promise<DeliveryNote | undefined> {
    const [deliveryNote] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, id));
    return deliveryNote;
  }

  async getDeliveryNoteWithItems(id: number): Promise<{ deliveryNote: DeliveryNote, items: (DeliveryNoteItem & { invoiceItem: InvoiceItem & { product: Product; unitLabel?: string } })[] } | undefined> {
    const [deliveryNote] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, id));
    if (!deliveryNote) {
      return undefined;
    }

    const rawItems = await db
      .select({
        deliveryNoteItem: deliveryNoteItems,
        invoiceItem: invoiceItems,
        product: products,
        selectedUnitLabel: productUnits.unitLabel,
      })
      .from(deliveryNoteItems)
      .innerJoin(invoiceItems, eq(deliveryNoteItems.invoiceItemId, invoiceItems.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .leftJoin(productUnits, eq(invoiceItems.productUnitId, productUnits.id))
      .where(eq(deliveryNoteItems.deliveryNoteId, id));

    const items = rawItems.map(row => ({
      ...row.deliveryNoteItem,
      invoiceItem: {
        ...row.invoiceItem,
        product: row.product,
        unitLabel: row.selectedUnitLabel || row.product.unit || undefined
      }
    })) as (DeliveryNoteItem & { invoiceItem: InvoiceItem & { product: Product; unitLabel?: string } })[];

    return { deliveryNote, items };
  }

  async getDeliveryNotesByInvoice(invoiceId: number): Promise<DeliveryNote[]> {
    return db
      .select()
      .from(deliveryNotes)
      .where(eq(deliveryNotes.invoiceId, invoiceId))
      .orderBy(desc(deliveryNotes.deliveryDate));
  }

  async getDeliveryNotes(storeId: number): Promise<DeliveryNote[]> {
    return db
      .select()
      .from(deliveryNotes)
      .where(eq(deliveryNotes.storeId, storeId))
      .orderBy(desc(deliveryNotes.deliveryDate));
  }

  async getDeliveryNotesWithDetails(storeId: number, status?: string): Promise<(DeliveryNote & { invoice: Invoice & { client: Client | null }, itemCount: number })[]> {
    const conditions = [eq(deliveryNotes.storeId, storeId)];
    if (status) {
      conditions.push(eq(deliveryNotes.status, status as "pending" | "delivered" | "cancelled"));
    }
    
    // Use a single query with JOINs and subquery for item count to avoid N+1
    const results = await db
      .select({
        // Delivery note fields
        id: deliveryNotes.id,
        storeId: deliveryNotes.storeId,
        invoiceId: deliveryNotes.invoiceId,
        deliveryNumber: deliveryNotes.deliveryNumber,
        deliveryDate: deliveryNotes.deliveryDate,
        deliveryType: deliveryNotes.deliveryType,
        status: deliveryNotes.status,
        vehicleInfo: deliveryNotes.vehicleInfo,
        driverName: deliveryNotes.driverName,
        recipientName: deliveryNotes.recipientName,
        notes: deliveryNotes.notes,
        createdAt: deliveryNotes.createdAt,
        updatedAt: deliveryNotes.updatedAt,
        // Invoice fields
        invoiceStoreId: invoices.storeId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceClientId: invoices.clientId,
        invoiceIssueDate: invoices.issueDate,
        invoiceDueDate: invoices.dueDate,
        invoiceStatus: invoices.status,
        invoiceSubtotal: invoices.subtotal,
        invoiceTaxRate: invoices.taxRate,
        invoiceTaxAmount: invoices.taxAmount,
        invoiceDiscount: invoices.discount,
        invoiceShipping: invoices.shipping,
        invoiceTotalAmount: invoices.totalAmount,
        invoiceTotalProfit: invoices.totalProfit,
        invoiceTermsAndConditions: invoices.termsAndConditions,
        invoicePaperSize: invoices.paperSize,
        invoiceNotes: invoices.notes,
        invoiceCreatedAt: invoices.createdAt,
        invoiceUpdatedAt: invoices.updatedAt,
        invoiceDeliveryAddress: invoices.deliveryAddress,
        invoiceDeliveryAddressLink: invoices.deliveryAddressLink,
        invoicePaymentTerms: invoices.paymentTerms,
        invoiceUseFakturPajak: invoices.useFakturPajak,
        invoiceDeliveryType: invoices.deliveryType,
        // Client fields
        clientId: clients.id,
        clientName: clients.name,
        clientEmail: clients.email,
        clientPhone: clients.phone,
        clientAddress: clients.address,
        clientAddressLink: clients.addressLink,
        clientNumber: clients.clientNumber,
        clientTaxNumber: clients.taxNumber,
        clientNotes: clients.notes,
        clientStoreId: clients.storeId,
        clientCreatedAt: clients.createdAt,
        clientUpdatedAt: clients.updatedAt,
        // Item count via subquery
        itemCount: sql<number>`(SELECT COUNT(*) FROM delivery_note_items WHERE delivery_note_id = ${deliveryNotes.id})`.as('itemCount')
      })
      .from(deliveryNotes)
      .innerJoin(invoices, eq(deliveryNotes.invoiceId, invoices.id))
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(deliveryNotes.deliveryDate));
    
    // Transform the flat results back into nested structure
    return results.map(row => ({
      id: row.id,
      storeId: row.storeId,
      invoiceId: row.invoiceId,
      deliveryNumber: row.deliveryNumber,
      deliveryDate: row.deliveryDate,
      deliveryType: row.deliveryType,
      status: row.status,
      vehicleInfo: row.vehicleInfo,
      driverName: row.driverName,
      recipientName: row.recipientName,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      invoice: {
        id: row.invoiceId,
        storeId: row.invoiceStoreId,
        invoiceNumber: row.invoiceNumber,
        clientId: row.invoiceClientId,
        issueDate: row.invoiceIssueDate,
        dueDate: row.invoiceDueDate,
        status: row.invoiceStatus,
        subtotal: row.invoiceSubtotal,
        taxRate: row.invoiceTaxRate,
        taxAmount: row.invoiceTaxAmount,
        discount: row.invoiceDiscount,
        shipping: row.invoiceShipping,
        totalAmount: row.invoiceTotalAmount,
        totalProfit: row.invoiceTotalProfit,
        termsAndConditions: row.invoiceTermsAndConditions,
        paperSize: row.invoicePaperSize,
        notes: row.invoiceNotes,
        createdAt: row.invoiceCreatedAt,
        updatedAt: row.invoiceUpdatedAt,
        deliveryAddress: row.invoiceDeliveryAddress,
        deliveryAddressLink: row.invoiceDeliveryAddressLink,
        paymentTerms: row.invoicePaymentTerms,
        useFakturPajak: row.invoiceUseFakturPajak,
        deliveryType: row.invoiceDeliveryType,
        client: row.clientId ? {
          id: row.clientId,
          storeId: row.clientStoreId!,
          clientNumber: row.clientNumber!,
          name: row.clientName!,
          email: row.clientEmail,
          phone: row.clientPhone,
          address: row.clientAddress,
          addressLink: row.clientAddressLink,
          taxNumber: row.clientTaxNumber,
          notes: row.clientNotes,
          createdAt: row.clientCreatedAt!,
          updatedAt: row.clientUpdatedAt!
        } : null
      },
      itemCount: Number(row.itemCount || 0)
    }));
  }

  async getInvoiceDeliveryStatus(invoiceId: number): Promise<{ orderedItems: { invoiceItemId: number; description: string; quantity: number; delivered: number; remaining: number }[]; fullyDelivered: boolean }> {
    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    const deliveredAmounts = await db
      .select({
        invoiceItemId: deliveryNoteItems.invoiceItemId,
        totalDelivered: sql<string>`SUM(${deliveryNoteItems.deliveredQuantity})`
      })
      .from(deliveryNoteItems)
      .innerJoin(deliveryNotes, eq(deliveryNoteItems.deliveryNoteId, deliveryNotes.id))
      .where(and(
        eq(deliveryNotes.invoiceId, invoiceId),
        inArray(deliveryNotes.status, ['pending', 'delivered'])
      ))
      .groupBy(deliveryNoteItems.invoiceItemId);

    const deliveredMap = new Map(deliveredAmounts.map(d => [d.invoiceItemId, parseFloat(d.totalDelivered || '0')]));

    const orderedItems = items.map(item => {
      const quantity = parseFloat(item.quantity);
      const delivered = deliveredMap.get(item.id) || 0;
      return {
        invoiceItemId: item.id,
        description: item.description,
        quantity,
        delivered,
        remaining: quantity - delivered
      };
    });

    const fullyDelivered = orderedItems.every(item => item.remaining <= 0);

    return { orderedItems, fullyDelivered };
  }

  // Calculate payment status for an invoice
  async calculatePaymentStatus(invoiceId: number, totalAmount: string, dueDate: string): Promise<'unpaid' | 'partial_paid' | 'paid' | 'overpaid' | 'overdue'> {
    const payments = await db
      .select({ amount: invoicePayments.amount })
      .from(invoicePayments)
      .where(eq(invoicePayments.invoiceId, invoiceId));
    
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
    const total = parseFloat(totalAmount || '0');
    
    if (totalPaid > total) {
      return 'overpaid';
    }
    
    if (totalPaid >= total && totalPaid > 0) {
      return 'paid';
    }
    
    // Check if overdue (has due date and past due, but not fully paid)
    if (dueDate) {
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (due < today && totalPaid < total) {
        return 'overdue';
      }
    }
    
    if (totalPaid > 0) {
      return 'partial_paid';
    }
    
    return 'unpaid';
  }

  // Calculate delivery status for an invoice
  async calculateDeliveryStatus(invoiceId: number): Promise<'undelivered' | 'partial_delivered' | 'delivered'> {
    const deliveryStatus = await this.getInvoiceDeliveryStatus(invoiceId);
    
    if (deliveryStatus.orderedItems.length === 0) {
      return 'undelivered';
    }
    
    const totalDelivered = deliveryStatus.orderedItems.reduce((sum, item) => sum + item.delivered, 0);
    const totalOrdered = deliveryStatus.orderedItems.reduce((sum, item) => sum + item.quantity, 0);
    
    if (totalOrdered === 0) {
      return 'undelivered';
    }
    
    if (deliveryStatus.fullyDelivered) {
      return 'delivered';
    }
    
    if (totalDelivered > 0) {
      return 'partial_delivered';
    }
    
    return 'undelivered';
  }

  // Get invoices with calculated payment and delivery status
  async getInvoicesWithStatus(storeId: number): Promise<(Invoice & { 
    clientName: string | null; 
    paymentStatus: 'unpaid' | 'partial_paid' | 'paid' | 'overpaid' | 'overdue';
    deliveryStatus: 'undelivered' | 'partial_delivered' | 'delivered';
  })[]> {
    const baseInvoices = await this.getInvoices(storeId);
    
    const invoicesWithStatus = await Promise.all(
      baseInvoices.map(async (invoice) => {
        // If voided, set special status
        if (invoice.isVoided) {
          return {
            ...invoice,
            paymentStatus: 'unpaid' as const,
            deliveryStatus: 'undelivered' as const
          };
        }
        
        const paymentStatus = await this.calculatePaymentStatus(invoice.id, invoice.totalAmount, invoice.dueDate);
        const deliveryStatus = await this.calculateDeliveryStatus(invoice.id);
        
        return {
          ...invoice,
          paymentStatus,
          deliveryStatus
        };
      })
    );
    
    return invoicesWithStatus;
  }

  async createDeliveryNote(deliveryNoteData: InsertDeliveryNote, items: InsertDeliveryNoteItem[]): Promise<DeliveryNote> {
    return withTransaction(async (tx) => {
      // Lock the invoice row to prevent concurrent delivery note creation
      const invoiceResult = await tx.execute(
        sql`SELECT * FROM invoices WHERE id = ${deliveryNoteData.invoiceId} FOR UPDATE`
      );
      
      const invoice = (invoiceResult as any)[0];
      if (!invoice) {
        throw new Error(`Invoice with ID ${deliveryNoteData.invoiceId} not found`);
      }

      // Generate DN number based on invoice number
      // INV-2601-0005 → DN-2601-0005 (full delivery), DN-2601-0005-1, -2 (partial deliveries)
      const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
      const baseDnNumber = invoiceNumber.replace(/^INV/, 'DN');
      
      // Get existing delivery note numbers for this invoice to determine next suffix
      const existingDNs = await tx
        .select({ deliveryNumber: deliveryNotes.deliveryNumber })
        .from(deliveryNotes)
        .where(eq(deliveryNotes.invoiceId, deliveryNoteData.invoiceId));
      
      let deliveryNumber: string;
      if (existingDNs.length === 0) {
        // First DN: check if it carries ALL invoice items with full quantities
        const allInvoiceItems = await tx
          .select({ id: invoiceItems.id, quantity: invoiceItems.quantity })
          .from(invoiceItems)
          .where(eq(invoiceItems.invoiceId, deliveryNoteData.invoiceId));
        
        // Build a map of invoice item quantities
        const invoiceItemQtyMap = new Map<number, number>();
        for (const ii of allInvoiceItems) {
          invoiceItemQtyMap.set(ii.id, parseFloat(ii.quantity));
        }
        
        // Check if DN items cover all invoice items with full quantities
        const dnItemMap = new Map<number, number>();
        for (const item of items) {
          dnItemMap.set(item.invoiceItemId, parseFloat(item.deliveredQuantity.toString()));
        }
        
        let isFullDelivery = true;
        for (const [itemId, qty] of invoiceItemQtyMap) {
          const dnQty = dnItemMap.get(itemId) || 0;
          if (dnQty < qty) {
            isFullDelivery = false;
            break;
          }
        }
        
        deliveryNumber = isFullDelivery ? baseDnNumber : `${baseDnNumber}-1`;
      } else {
        // Parse existing suffixes to find max
        let maxSuffix = 0;
        for (const dn of existingDNs) {
          const match = dn.deliveryNumber.match(new RegExp(`^${baseDnNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}-(\\d+)$`));
          if (match) {
            maxSuffix = Math.max(maxSuffix, parseInt(match[1]));
          } else if (dn.deliveryNumber === baseDnNumber) {
            maxSuffix = Math.max(maxSuffix, 0);
          }
        }
        deliveryNumber = `${baseDnNumber}-${maxSuffix + 1}`;
      }

      const [newDeliveryNote] = await tx
        .insert(deliveryNotes)
        .values({
          ...deliveryNoteData,
          deliveryNumber
        })
        .returning();

      if (items.length > 0) {
        await tx
          .insert(deliveryNoteItems)
          .values(items.map(item => ({
            ...item,
            deliveryNoteId: newDeliveryNote.id
          })));
      }

      // FIFO stock deduction at DN creation: deduct remaining and unreserve
      const storeId = invoice.store_id || invoice.storeId;
      const dnItems = await tx.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, newDeliveryNote.id));
      let totalCost = 0;
      let totalRevenue = 0;

      for (const dnItem of dnItems) {
        const [invItem] = await tx.select().from(invoiceItems).where(eq(invoiceItems.id, dnItem.invoiceItemId));
        if (!invItem) continue;

        const deliveredQty = parseFloat(dnItem.deliveredQuantity.toString());

        let baseDeliveredQty = deliveredQty;
        if (invItem.baseQuantity && invItem.quantity) {
          const ratio = parseFloat(invItem.baseQuantity.toString()) / parseFloat(invItem.quantity.toString());
          baseDeliveredQty = deliveredQty * ratio;
        }

        const unitPrice = parseFloat(invItem.unitPrice.toString());
        totalRevenue += deliveredQty * unitPrice;

        const [product] = await tx.select().from(products).where(eq(products.id, invItem.productId));

        let stockItems: { productId: number; quantity: number }[] = [];
        if (product && product.productType === 'bundle') {
          const components = await tx
            .select()
            .from(productBundleComponents)
            .where(eq(productBundleComponents.bundleProductId, product.id));
          for (const comp of components) {
            stockItems.push({
              productId: comp.componentProductId,
              quantity: parseFloat(comp.quantity) * baseDeliveredQty
            });
          }
        } else {
          stockItems.push({ productId: invItem.productId, quantity: baseDeliveredQty });
        }

        for (const { productId: stockProductId, quantity: qtyToAllocate } of stockItems) {
          const availableBatches = await tx
            .select()
            .from(productBatches)
            .where(
              and(
                eq(productBatches.productId, stockProductId),
                eq(productBatches.storeId, storeId),
                gt(productBatches.remainingQuantity, 0)
              )
            )
            .orderBy(productBatches.purchaseDate);

          let remainingToAllocate = qtyToAllocate;

          for (const batch of availableBatches) {
            if (remainingToAllocate <= 0) break;

            const remaining = parseFloat(batch.remainingQuantity.toString());
            const reserved = parseFloat(batch.reservedQuantity?.toString() || '0');
            const capitalCost = parseFloat(batch.capitalCost?.toString() || '0');

            const quantityFromBatch = Math.min(remainingToAllocate, remaining);
            totalCost += quantityFromBatch * capitalCost;

            const newRemaining = remaining - quantityFromBatch;
            const reservedReduction = Math.min(reserved, quantityFromBatch);
            const newReserved = reserved - reservedReduction;

            await tx
              .update(productBatches)
              .set({
                remainingQuantity: newRemaining.toString(),
                reservedQuantity: Math.max(0, newReserved).toString(),
                updatedAt: new Date()
              })
              .where(eq(productBatches.id, batch.id));

            remainingToAllocate -= quantityFromBatch;
          }

          if (remainingToAllocate > 0) {
            const anyBatch = await tx
              .select()
              .from(productBatches)
              .where(
                and(
                  eq(productBatches.productId, stockProductId),
                  eq(productBatches.storeId, storeId)
                )
              )
              .orderBy(desc(productBatches.purchaseDate))
              .limit(1);

            if (anyBatch.length > 0) {
              const batch = anyBatch[0];
              const currentRemaining = parseFloat(batch.remainingQuantity.toString());
              await tx
                .update(productBatches)
                .set({
                  remainingQuantity: (currentRemaining - remainingToAllocate).toString(),
                  updatedAt: new Date()
                })
                .where(eq(productBatches.id, batch.id));
            } else {
              const today = new Date().toISOString().split('T')[0];
              await tx.insert(productBatches).values({
                productId: stockProductId,
                storeId: storeId,
                batchNumber: `NEG-${stockProductId}-${today}`,
                purchaseDate: today,
                capitalCost: '0',
                initialQuantity: '0',
                remainingQuantity: (-remainingToAllocate).toString(),
                reservedQuantity: '0',
                notes: 'Negative stock from overselling'
              });
            }
          }
        }
      }

      // Store cost and profit on the delivery note at creation
      const profit = totalRevenue - totalCost;
      await tx
        .update(deliveryNotes)
        .set({
          totalCost: totalCost.toString(),
          profit: profit.toString(),
          updatedAt: new Date()
        })
        .where(eq(deliveryNotes.id, newDeliveryNote.id));

      return { ...newDeliveryNote, totalCost: totalCost.toString(), profit: profit.toString() };
    });
  }

  async updateDeliveryNote(id: number, deliveryNoteData: Partial<InsertDeliveryNote>): Promise<DeliveryNote> {
    const [updatedDeliveryNote] = await db
      .update(deliveryNotes)
      .set({ ...deliveryNoteData, updatedAt: new Date() })
      .where(eq(deliveryNotes.id, id))
      .returning();

    if (!updatedDeliveryNote) {
      throw new Error(`Delivery note with ID ${id} not found`);
    }

    return updatedDeliveryNote;
  }

  async deleteDeliveryNote(id: number): Promise<void> {
    const [deliveryNote] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, id));
    if (!deliveryNote) {
      throw new Error(`Delivery note with ID ${id} not found`);
    }

    // Stock was deducted at DN creation — restore it if pending (goods not yet delivered)
    if (deliveryNote.status === 'pending') {
      await this.restorePendingDeliveryNoteStock(id);
    } else if (deliveryNote.status === 'delivered') {
      // Delivered goods can't be returned to stock; just recalculate invoice profit
      const remainingDNs = await db
        .select()
        .from(deliveryNotes)
        .where(
          and(
            eq(deliveryNotes.invoiceId, deliveryNote.invoiceId),
            eq(deliveryNotes.status, 'delivered'),
            not(eq(deliveryNotes.id, id))
          )
        );
      const newInvoiceProfit = remainingDNs.reduce((sum, dn) => {
        return sum + parseFloat(dn.profit?.toString() || '0');
      }, 0);
      await db
        .update(invoices)
        .set({ totalProfit: newInvoiceProfit.toString(), updatedAt: new Date() })
        .where(eq(invoices.id, deliveryNote.invoiceId));
    }

    // Delete items and the delivery note record
    await db.delete(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, id));
    await db.delete(deliveryNotes).where(eq(deliveryNotes.id, id));
  }

  async getNextDeliveryNoteNumber(deliveryDate?: Date, invoiceId?: number, dnItemCount?: number): Promise<string> {
    if (invoiceId) {
      const invoice = await this.getInvoice(invoiceId);
      if (invoice) {
        const baseDnNumber = invoice.invoiceNumber.replace(/^INV/, 'DN');
        const existingDNs = await db
          .select({ deliveryNumber: deliveryNotes.deliveryNumber })
          .from(deliveryNotes)
          .where(eq(deliveryNotes.invoiceId, invoiceId));
        if (existingDNs.length === 0) {
          // For preview: if dnItemCount is provided, compare with invoice item count
          // If not provided or they match, assume full delivery
          if (dnItemCount !== undefined) {
            const allInvoiceItems = await db
              .select({ id: invoiceItems.id })
              .from(invoiceItems)
              .where(eq(invoiceItems.invoiceId, invoiceId));
            if (dnItemCount < allInvoiceItems.length) {
              return `${baseDnNumber}-1`;
            }
          }
          return baseDnNumber;
        }
        let maxSuffix = 0;
        for (const dn of existingDNs) {
          const match = dn.deliveryNumber.match(new RegExp(`^${baseDnNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}-(\\d+)$`));
          if (match) {
            maxSuffix = Math.max(maxSuffix, parseInt(match[1]));
          }
        }
        return `${baseDnNumber}-${maxSuffix + 1}`;
      }
    }
    const date = deliveryDate || new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = year + month;
    return generateNextNumber("DN", yearMonth, deliveryNotes, deliveryNotes.deliveryNumber, db);
  }

  async allocateStockOnDelivery(deliveryNoteId: number): Promise<void> {
    return withTransaction(async (tx) => {
      const [deliveryNote] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, deliveryNoteId));
      if (!deliveryNote) {
        throw new Error(`Delivery note with ID ${deliveryNoteId} not found`);
      }

      // Stock was already deducted at DN creation time.
      // Here we only update invoice total profit for financial recognition.
      const allDNsForInvoice = await tx
        .select()
        .from(deliveryNotes)
        .where(eq(deliveryNotes.invoiceId, deliveryNote.invoiceId));

      const invoiceTotalProfit = allDNsForInvoice
        .filter(dn => dn.status === 'delivered' || dn.id === deliveryNoteId)
        .reduce((sum, dn) => sum + parseFloat(dn.profit?.toString() || '0'), 0);

      await tx
        .update(invoices)
        .set({ totalProfit: invoiceTotalProfit.toString(), updatedAt: new Date() })
        .where(eq(invoices.id, deliveryNote.invoiceId));
    });
  }

  // Reverse stock allocation when delivery note is cancelled after being delivered
  async reverseDeliveryNoteStock(deliveryNoteId: number): Promise<void> {
    return withTransaction(async (tx) => {
      const [deliveryNote] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, deliveryNoteId));
      if (!deliveryNote) {
        throw new Error(`Delivery note with ID ${deliveryNoteId} not found`);
      }

      if (deliveryNote.profit === null && deliveryNote.totalCost === null) {
        console.log(`Delivery note ${deliveryNoteId} has no allocated stock to reverse`);
        return;
      }

      // For delivered DNs: do NOT restore stock (goods already left the warehouse).
      // Only clear the financial data (cost/profit) and recalculate invoice profit.

      await tx
        .update(deliveryNotes)
        .set({
          totalCost: null,
          profit: null,
          updatedAt: new Date()
        })
        .where(eq(deliveryNotes.id, deliveryNoteId));

      // Recalculate invoice total profit from remaining delivered delivery notes
      const remainingDeliveredNotes = await tx
        .select()
        .from(deliveryNotes)
        .where(
          and(
            eq(deliveryNotes.invoiceId, deliveryNote.invoiceId),
            eq(deliveryNotes.status, 'delivered')
          )
        );
      const newInvoiceProfit = remainingDeliveredNotes.reduce((sum, dn) => {
        return sum + parseFloat(dn.profit?.toString() || '0');
      }, 0);
      await tx
        .update(invoices)
        .set({ totalProfit: newInvoiceProfit.toString(), updatedAt: new Date() })
        .where(eq(invoices.id, deliveryNote.invoiceId));
    });
  }

  async restorePendingDeliveryNoteStock(deliveryNoteId: number, tx?: any): Promise<void> {
    const action = async (transaction: any) => {
      const [deliveryNote] = await transaction.select().from(deliveryNotes).where(eq(deliveryNotes.id, deliveryNoteId));
      if (!deliveryNote) {
        throw new Error(`Delivery note with ID ${deliveryNoteId} not found`);
      }

      if (deliveryNote.profit === null && deliveryNote.totalCost === null) {
        return;
      }

      const dnItems = await transaction.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, deliveryNoteId));

      const [invoice] = await transaction.select().from(invoices).where(eq(invoices.id, deliveryNote.invoiceId));
      if (!invoice) {
        throw new Error(`Invoice with ID ${deliveryNote.invoiceId} not found`);
      }

      for (const dnItem of dnItems) {
        const [invItem] = await transaction.select().from(invoiceItems).where(eq(invoiceItems.id, dnItem.invoiceItemId));
        if (!invItem) continue;

        const deliveredQty = parseFloat(dnItem.deliveredQuantity.toString());

        let baseDeliveredQty = deliveredQty;
        if (invItem.baseQuantity && invItem.quantity) {
          const ratio = parseFloat(invItem.baseQuantity.toString()) / parseFloat(invItem.quantity.toString());
          baseDeliveredQty = deliveredQty * ratio;
        }

        const [product] = await transaction.select().from(products).where(eq(products.id, invItem.productId));

        let stockItems: { productId: number; quantity: number }[] = [];
        if (product && product.productType === 'bundle') {
          const components = await transaction
            .select()
            .from(productBundleComponents)
            .where(eq(productBundleComponents.bundleProductId, product.id));
          for (const comp of components) {
            stockItems.push({
              productId: comp.componentProductId,
              quantity: parseFloat(comp.quantity) * baseDeliveredQty
            });
          }
        } else {
          stockItems.push({ productId: invItem.productId, quantity: baseDeliveredQty });
        }

        for (const { productId: stockProductId, quantity: qtyToRestore } of stockItems) {
          const batches = await transaction
            .select()
            .from(productBatches)
            .where(
              and(
                eq(productBatches.productId, stockProductId),
                eq(productBatches.storeId, invoice.storeId)
              )
            )
            .orderBy(desc(productBatches.purchaseDate));

          let remainingToRestore = qtyToRestore;

          for (const batch of batches) {
            if (remainingToRestore <= 0) break;

            const totalQty = parseFloat(batch.initialQuantity.toString());
            const remainingQty = parseFloat(batch.remainingQuantity.toString());
            const reservedQty = parseFloat(batch.reservedQuantity?.toString() || '0');

            const canRestore = Math.min(remainingToRestore, totalQty - remainingQty);

            if (canRestore > 0) {
              await transaction
                .update(productBatches)
                .set({
                  remainingQuantity: (remainingQty + canRestore).toString(),
                  reservedQuantity: (reservedQty + canRestore).toString(),
                  updatedAt: new Date()
                })
                .where(eq(productBatches.id, batch.id));

              remainingToRestore -= canRestore;
            }
          }
        }
      }

      await transaction
        .update(deliveryNotes)
        .set({
          totalCost: null,
          profit: null,
          updatedAt: new Date()
        })
        .where(eq(deliveryNotes.id, deliveryNoteId));

      const remainingDeliveredNotes = await transaction
        .select()
        .from(deliveryNotes)
        .where(
          and(
            eq(deliveryNotes.invoiceId, deliveryNote.invoiceId),
            eq(deliveryNotes.status, 'delivered')
          )
        );
      const newInvoiceProfit = remainingDeliveredNotes.reduce((sum, dn) => {
        return sum + parseFloat(dn.profit?.toString() || '0');
      }, 0);
      await transaction
        .update(invoices)
        .set({ totalProfit: newInvoiceProfit.toString(), updatedAt: new Date() })
        .where(eq(invoices.id, deliveryNote.invoiceId));
    };

    if (tx) return action(tx);
    return withTransaction(action);
  }

  async revertDeliveryNoteToPending(deliveryNoteId: number): Promise<DeliveryNote> {
    return withTransaction(async (tx) => {
      const [deliveryNote] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, deliveryNoteId));
      if (!deliveryNote) {
        throw new Error(`Delivery note with ID ${deliveryNoteId} not found`);
      }

      if (deliveryNote.status !== 'delivered') {
        throw new Error(`Can only revert delivered delivery notes. Current status: ${deliveryNote.status}`);
      }

      // Stock was already deducted at DN creation — do NOT restore it.
      // Only recalculate invoice profit (remove this DN's profit from delivered total).
      const remainingDeliveredNotes = await tx
        .select()
        .from(deliveryNotes)
        .where(
          and(
            eq(deliveryNotes.invoiceId, deliveryNote.invoiceId),
            eq(deliveryNotes.status, 'delivered'),
            not(eq(deliveryNotes.id, deliveryNoteId))
          )
        );
      const newInvoiceProfit = remainingDeliveredNotes.reduce((sum, dn) => {
        return sum + parseFloat(dn.profit?.toString() || '0');
      }, 0);
      await tx
        .update(invoices)
        .set({ totalProfit: newInvoiceProfit.toString(), updatedAt: new Date() })
        .where(eq(invoices.id, deliveryNote.invoiceId));

      const [updated] = await tx
        .update(deliveryNotes)
        .set({
          status: 'pending',
          updatedAt: new Date()
        })
        .where(eq(deliveryNotes.id, deliveryNoteId))
        .returning();

      return updated;
    });
  }

  async updateDeliveryNoteItems(deliveryNoteId: number, items: { invoiceItemId: number; deliveredQuantity: number }[]): Promise<void> {
    return withTransaction(async (tx) => {
      const [deliveryNote] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, deliveryNoteId));
      if (!deliveryNote) {
        throw new Error(`Delivery note with ID ${deliveryNoteId} not found`);
      }

      if (deliveryNote.status !== 'pending') {
        throw new Error(`Can only edit items on pending delivery notes. Current status: ${deliveryNote.status}`);
      }

      // Get invoice items to validate ownership and calculate max quantities
      const invItems = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, deliveryNote.invoiceId));
      const invItemIds = new Set(invItems.map(i => i.id));

      // Get current delivery note items (to add back to remaining calc)
      const currentDnItems = await tx.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, deliveryNoteId));
      const currentQtyMap = new Map(currentDnItems.map(di => [di.invoiceItemId, parseFloat(di.deliveredQuantity.toString())]));

      // Get all other delivery notes for this invoice (excluding this one) to calculate delivered quantities
      const otherDnItems = await tx
        .select({
          invoiceItemId: deliveryNoteItems.invoiceItemId,
          deliveredQuantity: deliveryNoteItems.deliveredQuantity
        })
        .from(deliveryNoteItems)
        .innerJoin(deliveryNotes, eq(deliveryNotes.id, deliveryNoteItems.deliveryNoteId))
        .where(
          and(
            eq(deliveryNotes.invoiceId, deliveryNote.invoiceId),
            not(eq(deliveryNotes.id, deliveryNoteId)),
            not(eq(deliveryNotes.status, 'cancelled'))
          )
        );

      // Calculate delivered by other DNs
      const deliveredByOthers = new Map<number, number>();
      for (const item of otherDnItems) {
        const current = deliveredByOthers.get(item.invoiceItemId) || 0;
        deliveredByOthers.set(item.invoiceItemId, current + parseFloat(item.deliveredQuantity.toString()));
      }

      // Validate items
      const validItems = items.filter(item => item.deliveredQuantity > 0);
      if (validItems.length === 0) {
        throw new Error('At least one item with quantity > 0 is required');
      }

      for (const item of validItems) {
        // Validate item belongs to invoice
        if (!invItemIds.has(item.invoiceItemId)) {
          throw new Error(`Invoice item ${item.invoiceItemId} does not belong to this delivery note's invoice`);
        }

        // Validate quantity doesn't exceed available
        const invItem = invItems.find(i => i.id === item.invoiceItemId);
        if (!invItem) continue;
        
        const orderedQty = parseFloat(invItem.quantity.toString());
        const deliveredOther = deliveredByOthers.get(item.invoiceItemId) || 0;
        const maxAllowed = orderedQty - deliveredOther;
        
        if (item.deliveredQuantity > maxAllowed) {
          throw new Error(`Quantity ${item.deliveredQuantity} exceeds maximum allowed ${maxAllowed} for item ${invItem.description}`);
        }
      }

      // Step 1: Restore stock from old items (reverse the FIFO deduction done at DN creation)
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, deliveryNote.invoiceId));
      if (!invoice) throw new Error(`Invoice with ID ${deliveryNote.invoiceId} not found`);

      for (const oldDnItem of currentDnItems) {
        const [oldInvItem] = await tx.select().from(invoiceItems).where(eq(invoiceItems.id, oldDnItem.invoiceItemId));
        if (!oldInvItem) continue;

        const oldDeliveredQty = parseFloat(oldDnItem.deliveredQuantity.toString());
        let oldBaseQty = oldDeliveredQty;
        if (oldInvItem.baseQuantity && oldInvItem.quantity) {
          const ratio = parseFloat(oldInvItem.baseQuantity.toString()) / parseFloat(oldInvItem.quantity.toString());
          oldBaseQty = oldDeliveredQty * ratio;
        }

        const [oldProduct] = await tx.select().from(products).where(eq(products.id, oldInvItem.productId));
        let oldStockItems: { productId: number; quantity: number }[] = [];
        if (oldProduct && oldProduct.productType === 'bundle') {
          const components = await tx.select().from(productBundleComponents).where(eq(productBundleComponents.bundleProductId, oldProduct.id));
          for (const comp of components) { oldStockItems.push({ productId: comp.componentProductId, quantity: parseFloat(comp.quantity) * oldBaseQty }); }
        } else {
          oldStockItems.push({ productId: oldInvItem.productId, quantity: oldBaseQty });
        }

        for (const { productId: stockProductId, quantity: qtyToRestore } of oldStockItems) {
          const batches = await tx.select().from(productBatches).where(and(eq(productBatches.productId, stockProductId), eq(productBatches.storeId, invoice.storeId))).orderBy(desc(productBatches.purchaseDate));
          let remainingToRestore = qtyToRestore;
          for (const batch of batches) {
            if (remainingToRestore <= 0) break;
            const totalQty = parseFloat(batch.initialQuantity.toString());
            const remainingQty = parseFloat(batch.remainingQuantity.toString());
            const reservedQty = parseFloat(batch.reservedQuantity?.toString() || '0');
            const canRestore = Math.min(remainingToRestore, totalQty - remainingQty);
            if (canRestore > 0) {
              await tx.update(productBatches).set({ remainingQuantity: (remainingQty + canRestore).toString(), reservedQuantity: (reservedQty + canRestore).toString(), updatedAt: new Date() }).where(eq(productBatches.id, batch.id));
              remainingToRestore -= canRestore;
            }
          }
        }
      }

      // Step 2: Delete existing items and insert new items
      await tx.delete(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, deliveryNoteId));
      for (const item of validItems) {
        await tx.insert(deliveryNoteItems).values({
          deliveryNoteId,
          invoiceItemId: item.invoiceItemId,
          deliveredQuantity: item.deliveredQuantity.toString()
        });
      }

      // Step 3: Re-deduct stock with new items (FIFO) and recalculate cost/profit
      const newDnItems = await tx.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, deliveryNoteId));
      let totalCost = 0;
      let totalRevenue = 0;

      for (const dnItem of newDnItems) {
        const [invItem] = await tx.select().from(invoiceItems).where(eq(invoiceItems.id, dnItem.invoiceItemId));
        if (!invItem) continue;

        const deliveredQty = parseFloat(dnItem.deliveredQuantity.toString());
        let baseDeliveredQty = deliveredQty;
        if (invItem.baseQuantity && invItem.quantity) {
          const ratio = parseFloat(invItem.baseQuantity.toString()) / parseFloat(invItem.quantity.toString());
          baseDeliveredQty = deliveredQty * ratio;
        }

        const unitPrice = parseFloat(invItem.unitPrice.toString());
        totalRevenue += deliveredQty * unitPrice;

        const [product] = await tx.select().from(products).where(eq(products.id, invItem.productId));
        let stockItemsList: { productId: number; quantity: number }[] = [];
        if (product && product.productType === 'bundle') {
          const components = await tx.select().from(productBundleComponents).where(eq(productBundleComponents.bundleProductId, product.id));
          for (const comp of components) { stockItemsList.push({ productId: comp.componentProductId, quantity: parseFloat(comp.quantity) * baseDeliveredQty }); }
        } else {
          stockItemsList.push({ productId: invItem.productId, quantity: baseDeliveredQty });
        }

        for (const { productId: stockProductId, quantity: qtyToAllocate } of stockItemsList) {
          const availableBatches = await tx.select().from(productBatches).where(and(eq(productBatches.productId, stockProductId), eq(productBatches.storeId, invoice.storeId), gt(productBatches.remainingQuantity, 0))).orderBy(productBatches.purchaseDate);
          let remainingToAllocate = qtyToAllocate;
          for (const batch of availableBatches) {
            if (remainingToAllocate <= 0) break;
            const remaining = parseFloat(batch.remainingQuantity.toString());
            const reserved = parseFloat(batch.reservedQuantity?.toString() || '0');
            const capitalCost = parseFloat(batch.capitalCost?.toString() || '0');
            const quantityFromBatch = Math.min(remainingToAllocate, remaining);
            totalCost += quantityFromBatch * capitalCost;
            const newRemaining = remaining - quantityFromBatch;
            const reservedReduction = Math.min(reserved, quantityFromBatch);
            const newReserved = reserved - reservedReduction;
            await tx.update(productBatches).set({ remainingQuantity: newRemaining.toString(), reservedQuantity: Math.max(0, newReserved).toString(), updatedAt: new Date() }).where(eq(productBatches.id, batch.id));
            remainingToAllocate -= quantityFromBatch;
          }
          if (remainingToAllocate > 0) {
            const anyBatch = await tx.select().from(productBatches).where(and(eq(productBatches.productId, stockProductId), eq(productBatches.storeId, invoice.storeId))).orderBy(desc(productBatches.purchaseDate)).limit(1);
            if (anyBatch.length > 0) {
              const batch = anyBatch[0];
              const currentRemaining = parseFloat(batch.remainingQuantity.toString());
              await tx.update(productBatches).set({ remainingQuantity: (currentRemaining - remainingToAllocate).toString(), updatedAt: new Date() }).where(eq(productBatches.id, batch.id));
            }
          }
        }
      }

      const newProfit = totalRevenue - totalCost;
      await tx.update(deliveryNotes).set({ totalCost: totalCost.toString(), profit: newProfit.toString(), updatedAt: new Date() }).where(eq(deliveryNotes.id, deliveryNoteId));
    });
  }

  // Goods Receipt methods
  async getGoodsReceipt(id: number): Promise<GoodsReceipt | undefined> {
    const [receipt] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id));
    return receipt;
  }

  async getGoodsReceiptWithItems(id: number): Promise<{ goodsReceipt: GoodsReceipt, items: GoodsReceiptItem[], payments: GoodsReceiptPayment[] } | undefined> {
    const [goodsReceipt] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, id));
    if (!goodsReceipt) return undefined;

    const items = await db.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, id)).orderBy(goodsReceiptItems.id);
    const payments = await db.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, id)).orderBy(desc(goodsReceiptPayments.paymentDate));

    return { goodsReceipt, items, payments };
  }

  async getGoodsReceipts(storeId: number): Promise<GoodsReceipt[]> {
    return db.select().from(goodsReceipts).where(eq(goodsReceipts.storeId, storeId)).orderBy(desc(goodsReceipts.receiptDate));
  }

  async getGoodsReceiptsWithPendingReturns(storeId: number): Promise<GoodsReceipt[]> {
    return db.select().from(goodsReceipts).where(and(eq(goodsReceipts.storeId, storeId), eq(goodsReceipts.hasReturns, true))).orderBy(desc(goodsReceipts.receiptDate));
  }

  async createGoodsReceipt(goodsReceiptData: InsertGoodsReceipt, items: Array<InsertGoodsReceiptItem & { productId: number }>): Promise<GoodsReceipt> {
    return withTransaction(async (tx) => {
      const receiptNumber = await this.getNextGoodsReceiptNumber(goodsReceiptData.receiptDate ? new Date(goodsReceiptData.receiptDate) : undefined);

      const receiptValues: any = {
        ...goodsReceiptData,
        receiptNumber,
        receiptDate: goodsReceiptData.receiptDate instanceof Date 
          ? goodsReceiptData.receiptDate.toISOString().split('T')[0] 
          : goodsReceiptData.receiptDate,
        dueDate: goodsReceiptData.dueDate instanceof Date 
          ? goodsReceiptData.dueDate.toISOString().split('T')[0] 
          : goodsReceiptData.dueDate,
      };
      const [newReceipt] = await tx.insert(goodsReceipts).values(receiptValues).returning();

      if (items && items.length > 0) {
        const hasReturns = items.some(item => parseFloat(String(item.returnQuantity || 0)) > 0);
        
        for (const item of items) {
          await tx.insert(goodsReceiptItems).values({
            ...item,
            goodsReceiptId: newReceipt.id
          });

          // Update product stock by creating/updating product batch
          // Use baseQuantity if available (for multi-unit products), otherwise use quantity
          // Subtract returnQuantity from stock added (returns reduce incoming stock)
          const itemAny = item as any;
          const fullBaseQuantity = parseFloat(String(itemAny.baseQuantity || item.quantity || 0));
          const returnQty = parseFloat(String(item.returnQuantity || 0));
          const conversionFactor = itemAny.baseQuantity ? fullBaseQuantity / (parseFloat(String(item.quantity || 1)) || 1) : 1;
          const baseReturnQty = returnQty * conversionFactor;
          const baseQuantity = fullBaseQuantity - baseReturnQty;
          if (baseQuantity > 0) {
            const batchReference = `GR-${receiptNumber}-${item.productId}`;
            const batchDescription = `Received from GR ${receiptNumber}`;
            
            // Get product info
            const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
            
            // Try to find existing batch for this GR item
            const [existingBatch] = await tx
              .select()
              .from(productBatches)
              .where(eq(productBatches.batchNumber, batchReference))
              .limit(1);

            if (existingBatch) {
              const newQuantity = parseFloat(existingBatch.initialQuantity) + baseQuantity;
              const newRemainingQuantity = parseFloat(existingBatch.remainingQuantity) + baseQuantity;

              await tx
                .update(productBatches)
                .set({
                  initialQuantity: newQuantity.toString(),
                  remainingQuantity: newRemainingQuantity.toString(),
                  updatedAt: new Date()
                })
                .where(eq(productBatches.id, existingBatch.id));
            } else {
              // Create new batch - use baseCost if available (for multi-unit products), otherwise use unitCost
              const batchCost = itemAny.baseCost || item.unitCost || '0';
              await tx
                .insert(productBatches)
                .values({
                  productId: item.productId,
                  storeId: goodsReceiptData.storeId,
                  batchNumber: batchReference,
                  purchaseDate: typeof goodsReceiptData.receiptDate === 'string' ? goodsReceiptData.receiptDate : new Date().toISOString().split('T')[0],
                  expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  initialQuantity: baseQuantity.toString(),
                  remainingQuantity: baseQuantity.toString(),
                  capitalCost: String(batchCost),
                  notes: batchDescription
                });
            }
          }
        }

        if (hasReturns) {
          await tx.update(goodsReceipts).set({ hasReturns: true }).where(eq(goodsReceipts.id, newReceipt.id));
        }
      }

      return newReceipt;
    });
  }

  async updateGoodsReceipt(id: number, goodsReceiptData: Partial<InsertGoodsReceipt>, items?: Array<InsertGoodsReceiptItem & { id?: number, productId: number }>): Promise<GoodsReceipt> {
    return withTransaction(async (tx) => {
      const [updatedReceipt] = await tx.update(goodsReceipts)
        .set({ ...goodsReceiptData, updatedAt: new Date() })
        .where(eq(goodsReceipts.id, id))
        .returning();

      if (!updatedReceipt) {
        throw new Error(`Goods Receipt with ID ${id} not found`);
      }

      if (items) {
        const oldItems = await tx.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, id));
        await this.reversePOReceivedFromGR(tx, oldItems);

        await tx.delete(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, id));

        const hasReturns = items.some(item => parseFloat(String(item.returnQuantity || 0)) > 0);

        for (const item of items) {
          const { id: itemId, ...itemData } = item;
          await tx.insert(goodsReceiptItems).values({
            ...itemData,
            goodsReceiptId: id
          });
        }

        await tx.update(goodsReceipts).set({ hasReturns }).where(eq(goodsReceipts.id, id));

        await this.applyPOReceivedFromGR(tx, items);
      }

      return updatedReceipt;
    });
  }

  private async applyPOReceivedFromGR(tx: any, grItems: any[]): Promise<void> {
    const poItemsMap = new Map<number, Array<{ purchaseOrderItemId: number, quantityReceived: number }>>();
    for (const item of grItems) {
      const poId = item.purchaseOrderId;
      const poItemId = item.purchaseOrderItemId;
      if (poId && poItemId) {
        const existing = poItemsMap.get(poId) || [];
        existing.push({
          purchaseOrderItemId: poItemId,
          quantityReceived: parseFloat(String(item.quantity || 0)),
        });
        poItemsMap.set(poId, existing);
      }
    }

    for (const [poId, items] of poItemsMap.entries()) {
      const [purchaseOrder] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
      if (!purchaseOrder) continue;

      for (const item of items) {
        const [poItem] = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
        if (!poItem || poItem.purchaseOrderId !== poId) continue;

        const currentReceived = parseFloat(poItem.receivedQuantity || '0');
        const newReceivedQuantity = Math.min(
          currentReceived + item.quantityReceived,
          parseFloat(poItem.quantity)
        );

        await tx.update(purchaseOrderItems)
          .set({ receivedQuantity: newReceivedQuantity.toString(), updatedAt: new Date() })
          .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
      }

      const allItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
      const allFullyReceived = allItems.every((item: any) => parseFloat(item.receivedQuantity || '0') >= parseFloat(item.quantity));
      const anyReceived = allItems.some((item: any) => parseFloat(item.receivedQuantity || '0') > 0);

      let newStatus: string;
      if (allFullyReceived) {
        newStatus = 'received';
      } else if (anyReceived) {
        newStatus = 'partial';
      } else {
        newStatus = 'pending';
      }

      const updateData: any = { status: newStatus as any, updatedAt: new Date() };
      if (newStatus === 'received') updateData.deliveredDate = new Date();

      await tx.update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, poId));
    }
  }

  async updateGoodsReceiptStatus(id: number, status: string): Promise<GoodsReceipt> {
    return withTransaction(async (tx) => {
      const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, id));
      if (!receipt) {
        throw new Error(`Goods Receipt with ID ${id} not found`);
      }

      const previousStatus = receipt.status;

      // If changing to cancelled from a confirmed status, reverse the stock
      if (status === 'cancelled' && previousStatus !== 'cancelled' && previousStatus !== 'draft') {
        await this.reverseGoodsReceiptStock(tx, id);
      }

      const [updatedReceipt] = await tx.update(goodsReceipts)
        .set({ status: status as any, updatedAt: new Date() })
        .where(eq(goodsReceipts.id, id))
        .returning();

      return updatedReceipt;
    });
  }

  // Helper method to reverse stock added by a goods receipt
  private async reverseGoodsReceiptStock(tx: any, goodsReceiptId: number): Promise<void> {
    const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, goodsReceiptId));
    if (!receipt) return;

    const items = await tx.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, goodsReceiptId));

    for (const item of items) {
      const batchReference = `GR-${receipt.receiptNumber}-${item.productId}`;
      
      // Find the batch created by this GR
      const [batch] = await tx
        .select()
        .from(productBatches)
        .where(eq(productBatches.batchNumber, batchReference))
        .limit(1);

      if (batch) {
        const itemAny = item as any;
        const baseQuantity = parseFloat(String(itemAny.baseQuantity || item.quantity || 0));
        
        // Reduce the batch quantity
        const newRemaining = Math.max(0, parseFloat(batch.remainingQuantity) - baseQuantity);
        const newTotal = Math.max(0, parseFloat(batch.initialQuantity) - baseQuantity);

        if (newTotal <= 0) {
          await tx.delete(productBatches).where(eq(productBatches.id, batch.id));
        } else {
          await tx
            .update(productBatches)
            .set({
              initialQuantity: newTotal.toString(),
              remainingQuantity: newRemaining.toString(),
              updatedAt: new Date()
            })
            .where(eq(productBatches.id, batch.id));
        }
      }
    }
  }

  async deleteGoodsReceipt(id: number): Promise<void> {
    return withTransaction(async (tx) => {
      const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, id));
      if (!receipt) {
        throw new Error(`Goods Receipt with ID ${id} not found`);
      }

      // Reverse stock if the receipt was confirmed (not draft or cancelled)
      if (receipt.status !== 'draft' && receipt.status !== 'cancelled') {
        await this.reverseGoodsReceiptStock(tx, id);
      }

      // Reverse PO received quantities for linked items
      const grItems = await tx.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, id));
      await this.reversePOReceivedFromGR(tx, grItems);

      // Delete transactions linked to GR payments first
      const grPayments = await tx.select({ id: goodsReceiptPayments.id }).from(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, id));
      for (const payment of grPayments) {
        await tx.delete(transactions).where(eq(transactions.goodsReceiptPaymentId, payment.id));
      }

      // Delete payments
      await tx.delete(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, id));
      
      // Delete items
      await tx.delete(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, id));
      
      // Delete the receipt
      await tx.delete(goodsReceipts).where(eq(goodsReceipts.id, id));
    });
  }

  private async reversePOReceivedFromGR(tx: any, grItems: any[]): Promise<void> {
    const poItemsMap = new Map<number, Array<{ purchaseOrderItemId: number, quantityToReverse: number }>>();
    for (const item of grItems) {
      if (item.purchaseOrderId && item.purchaseOrderItemId) {
        const existing = poItemsMap.get(item.purchaseOrderId) || [];
        existing.push({
          purchaseOrderItemId: item.purchaseOrderItemId,
          quantityToReverse: parseFloat(String(item.quantity || 0)),
        });
        poItemsMap.set(item.purchaseOrderId, existing);
      }
    }

    for (const [poId, items] of poItemsMap.entries()) {
      const [purchaseOrder] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId));
      if (!purchaseOrder) continue;

      for (const item of items) {
        const [poItem] = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
        if (!poItem || poItem.purchaseOrderId !== poId) continue;

        const currentReceived = parseFloat(poItem.receivedQuantity || '0');
        const newReceivedQuantity = Math.max(0, currentReceived - item.quantityToReverse);

        await tx.update(purchaseOrderItems)
          .set({ receivedQuantity: newReceivedQuantity.toString(), updatedAt: new Date() })
          .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
      }

      const allItems = await tx.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
      const allFullyReceived = allItems.every((item: any) => parseFloat(item.receivedQuantity || '0') >= parseFloat(item.quantity));
      const anyReceived = allItems.some((item: any) => parseFloat(item.receivedQuantity || '0') > 0);

      let newStatus: string;
      if (allFullyReceived) {
        newStatus = 'received';
      } else if (anyReceived) {
        newStatus = 'partial';
      } else {
        newStatus = 'pending';
      }

      await tx.update(purchaseOrders)
        .set({ status: newStatus as any, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, poId));
    }
  }

  async getNextGoodsReceiptNumber(storeId: number, receiptDate?: Date): Promise<string> {
    const date = receiptDate || new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const yearMonth = year + month;
    return generateNextNumber("GR", yearMonth, goodsReceipts, goodsReceipts.receiptNumber, db, storeId);
  }

  async updateGoodsReceiptItem(id: number, itemData: Partial<InsertGoodsReceiptItem>): Promise<GoodsReceiptItem> {
    return withTransaction(async (tx) => {
      const [existingItem] = await tx.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.id, id));
      if (!existingItem) {
        throw new Error(`Goods Receipt Item with ID ${id} not found`);
      }
      
      const oldReturnedQty = parseFloat(String(existingItem.returnedQuantity || 0));
      const newReturnedQty = itemData.returnedQuantity !== undefined ? parseFloat(String(itemData.returnedQuantity)) : oldReturnedQty;
      const returnedDiff = newReturnedQty - oldReturnedQty;
      
      const autoStatus = (() => {
        const returnQty = parseFloat(String(itemData.returnQuantity || existingItem.returnQuantity || 0));
        if (returnQty <= 0) return 'none' as const;
        return newReturnedQty >= returnQty ? 'returned' as const : 'pending' as const;
      })();
      
      const [updatedItem] = await tx.update(goodsReceiptItems)
        .set({ ...itemData, returnStatus: autoStatus, updatedAt: new Date() })
        .where(eq(goodsReceiptItems.id, id))
        .returning();

      if (returnedDiff !== 0) {
        const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, existingItem.goodsReceiptId));
        if (receipt) {
          const itemAny = existingItem as any;
          const fullBaseQty = parseFloat(String(itemAny.baseQuantity || existingItem.quantity || 0));
          const itemQty = parseFloat(String(existingItem.quantity || 1)) || 1;
          const conversionFactor = itemAny.baseQuantity ? fullBaseQty / itemQty : 1;
          const baseReturnedDiff = returnedDiff * conversionFactor;
          
          const batchReference = `GR-${receipt.receiptNumber}-${existingItem.productId}`;
          const [existingBatch] = await tx.select().from(productBatches)
            .where(eq(productBatches.batchNumber, batchReference)).limit(1);
          
          if (existingBatch) {
            const newRemaining = Math.max(0, parseFloat(existingBatch.remainingQuantity) + baseReturnedDiff);
            const newInitial = Math.max(0, parseFloat(existingBatch.initialQuantity) + baseReturnedDiff);
            await tx.update(productBatches).set({
              remainingQuantity: newRemaining.toString(),
              initialQuantity: newInitial.toString(),
              updatedAt: new Date()
            }).where(eq(productBatches.id, existingBatch.id));
          } else if (returnedDiff > 0) {
            const batchCost = itemAny.baseCost || existingItem.unitCost || '0';
            await tx.insert(productBatches).values({
              productId: existingItem.productId,
              storeId: receipt.storeId,
              batchNumber: `${batchReference}-RET`,
              purchaseDate: new Date().toISOString().split('T')[0],
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              initialQuantity: baseReturnedDiff.toString(),
              remainingQuantity: baseReturnedDiff.toString(),
              capitalCost: String(batchCost),
              notes: `Returned stock from GR ${receipt.receiptNumber}`
            });
          }
        }
      }

      const receiptItems = await tx.select().from(goodsReceiptItems).where(eq(goodsReceiptItems.goodsReceiptId, updatedItem.goodsReceiptId));
      const hasReturns = receiptItems.some(item => parseFloat(String(item.returnQuantity || 0)) > 0 && item.returnStatus !== 'returned');

      await tx.update(goodsReceipts).set({ hasReturns }).where(eq(goodsReceipts.id, updatedItem.goodsReceiptId));

      return updatedItem;
    });
  }

  async getGoodsReceiptPayment(paymentId: number): Promise<GoodsReceiptPayment | undefined> {
    const [payment] = await db.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.id, paymentId));
    return payment;
  }

  async getGoodsReceiptPayments(goodsReceiptId: number): Promise<GoodsReceiptPayment[]> {
    return db.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, goodsReceiptId)).orderBy(desc(goodsReceiptPayments.paymentDate));
  }

  async createGoodsReceiptPayment(payment: InsertGoodsReceiptPayment): Promise<GoodsReceiptPayment> {
    return withTransaction(async (tx) => {
      const [newPayment] = await tx.insert(goodsReceiptPayments).values(payment).returning();

      const allPayments = await tx.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, payment.goodsReceiptId));
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

      const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, payment.goodsReceiptId));
      const totalAmount = parseFloat(String(receipt.totalAmount));

      let newStatus = receipt.status;
      if (totalPaid >= totalAmount) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partial_paid';
      }

      await tx.update(goodsReceipts).set({ amountPaid: String(totalPaid), status: newStatus, updatedAt: new Date() }).where(eq(goodsReceipts.id, payment.goodsReceiptId));

      return newPayment;
    });
  }

  async updateGoodsReceiptPayment(id: number, paymentData: Partial<InsertGoodsReceiptPayment>): Promise<GoodsReceiptPayment> {
    return withTransaction(async (tx) => {
      const [updatedPayment] = await tx.update(goodsReceiptPayments)
        .set({ ...paymentData, updatedAt: new Date() })
        .where(eq(goodsReceiptPayments.id, id))
        .returning();

      if (!updatedPayment) {
        throw new Error(`Goods Receipt Payment with ID ${id} not found`);
      }

      const allPayments = await tx.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, updatedPayment.goodsReceiptId));
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

      const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, updatedPayment.goodsReceiptId));
      const totalAmount = parseFloat(String(receipt.totalAmount));

      let newStatus = receipt.status;
      if (receipt.status !== 'draft' && receipt.status !== 'cancelled') {
        if (totalPaid >= totalAmount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partial_paid';
        } else {
          newStatus = 'confirmed';
        }
      }

      await tx.update(goodsReceipts).set({ amountPaid: String(totalPaid), status: newStatus, updatedAt: new Date() }).where(eq(goodsReceipts.id, updatedPayment.goodsReceiptId));

      return updatedPayment;
    });
  }

  async deleteGoodsReceiptPayment(id: number): Promise<void> {
    await withTransaction(async (tx) => {
      const [payment] = await tx.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.id, id));
      if (!payment) return;

      const [receipt] = await tx.select().from(goodsReceipts).where(eq(goodsReceipts.id, payment.goodsReceiptId));

      await tx.delete(goodsReceiptPayments).where(eq(goodsReceiptPayments.id, id));

      const allPayments = await tx.select().from(goodsReceiptPayments).where(eq(goodsReceiptPayments.goodsReceiptId, payment.goodsReceiptId));
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);

      const totalAmount = parseFloat(String(receipt?.totalAmount || 0));

      let newStatus = receipt?.status || 'confirmed';
      if (receipt && receipt.status !== 'draft' && receipt.status !== 'cancelled') {
        if (totalPaid >= totalAmount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partial_paid';
        } else {
          newStatus = 'confirmed';
        }
      }

      if (receipt) {
        await tx.update(goodsReceipts).set({ amountPaid: String(totalPaid), status: newStatus, updatedAt: new Date() }).where(eq(goodsReceipts.id, payment.goodsReceiptId));
      }
    });
  }

  // Quotation methods
  async getQuotation(id: number): Promise<Quotation | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));
    return quotation;
  }

  async getQuotationWithItems(id: number): Promise<{ quotation: Quotation; items: (QuotationItem & { productSku?: string; productCode?: string; unitLabel?: string })[]; client?: Client } | undefined> {
    const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id));

    if (!quotation) {
      return undefined;
    }

    const enrichedItems = await db
      .select({
        id: quotationItems.id,
        quotationId: quotationItems.quotationId,
        productId: quotationItems.productId,
        productUnitId: quotationItems.productUnitId,
        description: quotationItems.description,
        quantity: quotationItems.quantity,
        baseQuantity: quotationItems.baseQuantity,
        unitPrice: quotationItems.unitPrice,
        taxRate: quotationItems.taxRate,
        taxAmount: quotationItems.taxAmount,
        discount: quotationItems.discount,
        subtotal: quotationItems.subtotal,
        totalAmount: quotationItems.totalAmount,
        createdAt: quotationItems.createdAt,
        updatedAt: quotationItems.updatedAt,
        productSku: products.sku,
        productBaseUnit: products.unit,
        selectedUnitLabel: productUnits.unitLabel,
      })
      .from(quotationItems)
      .leftJoin(products, eq(quotationItems.productId, products.id))
      .leftJoin(productUnits, eq(quotationItems.productUnitId, productUnits.id))
      .where(eq(quotationItems.quotationId, id))
      .orderBy(quotationItems.id);

    const items = enrichedItems.map(item => ({
      id: item.id,
      quotationId: item.quotationId,
      productId: item.productId,
      productUnitId: item.productUnitId,
      description: item.description,
      quantity: item.quantity,
      baseQuantity: item.baseQuantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      discount: item.discount,
      subtotal: item.subtotal,
      totalAmount: item.totalAmount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      productCode: item.productSku || undefined,
      productSku: item.productSku || undefined,
      unitLabel: item.selectedUnitLabel || item.productBaseUnit || undefined,
    }));

    let client;
    if (quotation.clientId) {
      [client] = await db.select().from(clients).where(eq(clients.id, quotation.clientId));
    }

    return { quotation, items, client };
  }

  async getQuotations(storeId: number): Promise<(Quotation & { clientName: string | null })[]> {
    const results = await db
      .select({
        id: quotations.id,
        storeId: quotations.storeId,
        quotationNumber: quotations.quotationNumber,
        clientId: quotations.clientId,
        issueDate: quotations.issueDate,
        expiryDate: quotations.expiryDate,
        status: quotations.status,
        subtotal: quotations.subtotal,
        taxRate: quotations.taxRate,
        taxAmount: quotations.taxAmount,
        discount: quotations.discount,
        shipping: quotations.shipping,
        totalAmount: quotations.totalAmount,
        termsAndConditions: quotations.termsAndConditions,
        paperSize: quotations.paperSize,
        notes: quotations.notes,
        convertedToInvoiceId: quotations.convertedToInvoiceId,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        clientName: clients.name
      })
      .from(quotations)
      .leftJoin(clients, eq(quotations.clientId, clients.id))
      .where(eq(quotations.storeId, storeId))
      .orderBy(desc(quotations.issueDate));

    return results;
  }

  async createQuotation(quotationData: InsertQuotation, items: InsertQuotationItem[]): Promise<Quotation> {
    return withTransaction(async (tx) => {
      // Generate unique quotation number with YYMM format
      const currentDate = new Date();
      const year = currentDate.getFullYear().toString().slice(-2); // Get last 2 digits of year
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Get month with leading zero
      const yearMonth = year + month;
      const quotationNumber = await generateNextNumber("QUO", yearMonth, quotations, quotations.quotationNumber, tx);

      // Create the quotation
      const [newQuotation] = await tx
        .insert(quotations)
        .values({
          ...quotationData,
          quotationNumber
        })
        .returning();

      // Create all quotation items
      for (const item of items) {
        await tx
          .insert(quotationItems)
          .values({
            ...item,
            quotationId: newQuotation.id
          });
      }

      return newQuotation;
    });
  }

  async updateQuotation(id: number, quotationData: Partial<InsertQuotation>, items?: InsertQuotationItem[]): Promise<Quotation> {
    return withTransaction(async (tx) => {
      // Update quotation data
      const [updatedQuotation] = await tx
        .update(quotations)
        .set({ ...quotationData, updatedAt: new Date() })
        .where(eq(quotations.id, id))
        .returning();
      
      // If items are provided, update them
      if (items && items.length > 0) {
        // Delete existing items
        await tx
          .delete(quotationItems)
          .where(eq(quotationItems.quotationId, id));
        
        // Insert new items
        for (const item of items) {
          await tx
            .insert(quotationItems)
            .values({
              ...item,
              quotationId: id
            });
        }
      }
      
      return updatedQuotation;
    });
  }

  async patchQuotation(id: number, data: { status?: string; rejectionReason?: string }): Promise<Quotation> {
    const [updatedQuotation] = await db
      .update(quotations)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(quotations.id, id))
      .returning();
    
    if (!updatedQuotation) {
      throw new Error(`Quotation with ID ${id} not found`);
    }
    
    return updatedQuotation;
  }

  async convertQuotationToInvoice(id: number): Promise<Invoice> {
    return withTransaction(async (tx) => {
      // Get the quotation with its items
      const [quotation] = await tx
        .select()
        .from(quotations)
        .where(eq(quotations.id, id));

      if (!quotation) {
        throw new Error(`Quotation with ID ${id} not found`);
      }

      const items = await tx
        .select()
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, id));

      // Generate a unique invoice number using the standard generation function
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = year + month;

      const invoiceNumber = await generateNextNumber("INV", yearMonth, invoices, invoices.invoiceNumber, tx);

      // Create a new invoice based on the quotation
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      
      const [newInvoice] = await tx
        .insert(invoices)
        .values({
          storeId: quotation.storeId,
          invoiceNumber,
          clientId: quotation.clientId,
          issueDate: issueDate.toISOString().split('T')[0],
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'draft',
          subtotal: quotation.subtotal,
          taxRate: quotation.taxRate,
          taxAmount: quotation.taxAmount,
          discount: quotation.discount,
          shipping: quotation.shipping,
          totalAmount: quotation.totalAmount,
          paperSize: quotation.paperSize,
          notes: quotation.notes,
          deliveryAddress: quotation.deliveryAddress,
          deliveryAddressLink: quotation.deliveryAddressLink,
        })
        .returning();

      // Copy all items from quotation to invoice
      for (const item of items) {
        await tx
          .insert(invoiceItems)
          .values({
            invoiceId: newInvoice.id,
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            discount: item.discount,
            subtotal: item.subtotal,
            totalAmount: item.totalAmount,
          });
      }

      // Update the quotation to mark it as converted (only set convertedToInvoiceId, not status)
      await tx
        .update(quotations)
        .set({ 
          convertedToInvoiceId: newInvoice.id,
          updatedAt: new Date()
        })
        .where(eq(quotations.id, id));

      return newInvoice;
    });
  }

  async deleteQuotation(id: number): Promise<void> {
    return withTransaction(async (tx) => {
      // Delete quotation items (cascading)
      await tx
        .delete(quotationItems)
        .where(eq(quotationItems.quotationId, id));

      // Delete the quotation
      await tx
        .delete(quotations)
        .where(eq(quotations.id, id));
    });
  }

  // Purchase Order methods
  async getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return purchaseOrder;
  }

  async getPurchaseOrderWithItems(id: number): Promise<{ purchaseOrder: PurchaseOrder, items: PurchaseOrderItem[] } | undefined> {
    const [purchaseOrder] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));

    if (!purchaseOrder) {
      return undefined;
    }

    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id))
      .orderBy(purchaseOrderItems.id);

    return { purchaseOrder, items };
  }

  async getPurchaseOrders(storeId: number): Promise<PurchaseOrder[]> {
    return db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.storeId, storeId))
      .orderBy(desc(purchaseOrders.orderDate));
  }

  async getPurchaseOrdersWithItems(storeId: number): Promise<(PurchaseOrder & { items: { productId: number; description: string; quantity: string; unitCost: string }[] })[]> {
    const pos = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.storeId, storeId))
      .orderBy(desc(purchaseOrders.orderDate));

    const result = [];
    for (const po of pos) {
      const items = await db
        .select({
          id: purchaseOrderItems.id,
          productId: purchaseOrderItems.productId,
          description: purchaseOrderItems.description,
          quantity: purchaseOrderItems.quantity,
          unitCost: purchaseOrderItems.unitCost,
          baseCost: purchaseOrderItems.baseCost,
          baseQuantity: purchaseOrderItems.baseQuantity,
          productUnitId: purchaseOrderItems.productUnitId,
          receivedQuantity: purchaseOrderItems.receivedQuantity,
        })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

      result.push({
        ...po,
        items: items.map(item => ({
          id: item.id,
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          unitCost: item.unitCost,
          baseCost: item.baseCost,
          baseQuantity: item.baseQuantity,
          productUnitId: item.productUnitId,
          receivedQuantity: item.receivedQuantity || '0',
        })),
      });
    }
    return result;
  }

  async getPendingPOQuantityByProduct(storeId: number): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    
    const activePOs = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.storeId, storeId),
          inArray(purchaseOrders.status, ['pending', 'partial'])
        )
      );
    
    for (const po of activePOs) {
      const items = await db
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, po.id));
      
      for (const item of items) {
        const quantity = parseFloat(item.quantity.toString()) || 0;
        const received = parseFloat(item.receivedQuantity?.toString() || '0') || 0;
        const pending = quantity - received;
        
        if (pending > 0) {
          const current = result.get(item.productId) || 0;
          result.set(item.productId, current + pending);
        }
      }
    }
    
    return result;
  }

  async getReceivedQuantitiesForPO(purchaseOrderId: number): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    
    // Get all goods receipt items linked to this purchase order
    const items = await db
      .select({
        productId: goodsReceiptItems.productId,
        quantity: goodsReceiptItems.quantity,
      })
      .from(goodsReceiptItems)
      .where(eq(goodsReceiptItems.purchaseOrderId, purchaseOrderId));
    
    // Accumulate quantities by productId
    for (const item of items) {
      const qty = parseFloat(item.quantity.toString()) || 0;
      const current = parseFloat(result.get(item.productId) || '0');
      result.set(item.productId, (current + qty).toString());
    }
    
    return result;
  }

  async createPurchaseOrder(purchaseOrderData: InsertPurchaseOrder, items: Array<InsertPurchaseOrderItem & { productId: number, quantity: number | string }>): Promise<PurchaseOrder> {
    return withTransaction(async (tx) => {
      // Generate purchase order number using the standard generation function
      const orderDate = purchaseOrderData.orderDate ? new Date(purchaseOrderData.orderDate) : new Date();
      const year = orderDate.getFullYear().toString().slice(-2);
      const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = year + month;

      const purchaseOrderNumber = await generateNextNumber("PO", yearMonth, purchaseOrders, purchaseOrders.purchaseOrderNumber, tx);

      // Create purchase order
      const [newPurchaseOrder] = await tx
        .insert(purchaseOrders)
        .values({
          ...purchaseOrderData,
          purchaseOrderNumber
        })
        .returning();

      // Create purchase order items
      for (const item of items) {
        await tx
          .insert(purchaseOrderItems)
          .values({
            ...item,
            purchaseOrderId: newPurchaseOrder.id,
            quantity: item.quantity.toString(),
            unitCost: item.unitCost.toString(),
            subtotal: item.subtotal.toString(),
            totalAmount: item.totalAmount.toString(),
            taxRate: item.taxRate?.toString() || '0',
            taxAmount: item.taxAmount?.toString() || '0',
            discount: item.discount?.toString() || '0',
            productUnitId: (item as any).productUnitId || null,
            baseQuantity: (item as any).baseQuantity?.toString() || null,
            baseCost: (item as any).baseCost?.toString() || null
          });
      }

      return newPurchaseOrder;
    });
  }

  async updatePurchaseOrder(id: number, purchaseOrderData: Partial<InsertPurchaseOrder>, items: Array<InsertPurchaseOrderItem & { id?: number, productId: number, quantity: number | string }>): Promise<PurchaseOrder> {
    return withTransaction(async (tx) => {
      // Update purchase order
      const [updatedPurchaseOrder] = await tx
        .update(purchaseOrders)
        .set({ ...purchaseOrderData, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id))
        .returning();

      // Delete existing items
      await tx
        .delete(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, id));

      // Create new items
      for (const item of items) {
        await tx
          .insert(purchaseOrderItems)
          .values({
            ...item,
            purchaseOrderId: id,
            quantity: item.quantity.toString(),
            unitCost: item.unitCost.toString(),
            subtotal: item.subtotal.toString(),
            totalAmount: item.totalAmount.toString(),
            taxRate: item.taxRate?.toString() || '0',
            taxAmount: item.taxAmount?.toString() || '0',
            discount: item.discount?.toString() || '0',
            productUnitId: (item as any).productUnitId || null,
            baseQuantity: (item as any).baseQuantity?.toString() || null,
            baseCost: (item as any).baseCost?.toString() || null
          });
      }

      return updatedPurchaseOrder;
    });
  }

  async updatePurchaseOrderStatus(id: number, status: string, deliveredDate?: Date): Promise<PurchaseOrder> {
    const updateData: any = {
      status: status as any,
      updatedAt: new Date()
    };

    if (deliveredDate) {
      updateData.deliveredDate = deliveredDate;
    }

    const [updatedPurchaseOrder] = await db
      .update(purchaseOrders)
      .set(updateData)
      .where(eq(purchaseOrders.id, id))
      .returning();

    return updatedPurchaseOrder;
  }

  async receivePurchaseOrderItems(purchaseOrderId: number, items: Array<{ itemId: number, quantityReceived: number }>): Promise<PurchaseOrder> {
    return withTransaction(async (tx) => {
      // Get the purchase order
      const [purchaseOrder] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, purchaseOrderId));

      if (!purchaseOrder) {
        throw new Error(`Purchase order with ID ${purchaseOrderId} not found`);
      }

      let allItemsFullyReceived = true;

      // Process each item
      for (const item of items) {
        // Get the current purchase order item
        const [poItem] = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.id, item.itemId));

        if (!poItem) {
          throw new Error(`Purchase order item with ID ${item.itemId} not found`);
        }

        // Calculate new received quantity
        const currentReceived = parseFloat(poItem.receivedQuantity || '0');
        const newReceivedQuantity = currentReceived + item.quantityReceived;
        const totalOrdered = parseFloat(poItem.quantity);

        // Prevent receiving more than ordered
        if (newReceivedQuantity > totalOrdered) {
          throw new Error(`Cannot receive ${item.quantityReceived} items. Maximum remaining: ${totalOrdered - currentReceived}`);
        }

        // Update the purchase order item with new received quantity
        await tx
          .update(purchaseOrderItems)
          .set({ 
            receivedQuantity: newReceivedQuantity.toString(),
            updatedAt: new Date()
          })
          .where(eq(purchaseOrderItems.id, item.itemId));

        // Create or update product batch to add inventory
        if (item.quantityReceived > 0) {
          // Find existing batch or create a new one
          const batchReference = `PO-${purchaseOrder.purchaseOrderNumber}-${poItem.id}`;
          const batchDescription = `Received from PO ${purchaseOrder.purchaseOrderNumber} - ${poItem.description}`;

          // Try to find existing batch for this PO item
          const [existingBatch] = await tx
            .select()
            .from(productBatches)
            .where(eq(productBatches.batchNumber, batchReference))
            .limit(1);

          if (existingBatch) {
            const newQuantity = parseFloat(existingBatch.initialQuantity) + item.quantityReceived;
            const newRemainingQuantity = parseFloat(existingBatch.remainingQuantity) + item.quantityReceived;

            await tx
              .update(productBatches)
              .set({
                initialQuantity: newQuantity.toString(),
                remainingQuantity: newRemainingQuantity.toString(),
                updatedAt: new Date()
              })
              .where(eq(productBatches.id, existingBatch.id));
          } else {
            await tx
              .insert(productBatches)
              .values({
                productId: poItem.productId,
                storeId: purchaseOrder.storeId,
                batchNumber: batchReference,
                purchaseDate: new Date().toISOString().split('T')[0],
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                initialQuantity: item.quantityReceived.toString(),
                remainingQuantity: item.quantityReceived.toString(),
                capitalCost: poItem.unitCost,
                notes: batchDescription
              });
          }
        }

        // Check if this item is fully received
        if (newReceivedQuantity < totalOrdered) {
          allItemsFullyReceived = false;
        }
      }

      // Determine new purchase order status
      let newStatus: string;
      if (allItemsFullyReceived) {
        // Check if ALL items in the PO are fully received
        const allItems = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

        const allFullyReceived = allItems.every(item => 
          parseFloat(item.receivedQuantity || '0') >= parseFloat(item.quantity)
        );

        newStatus = allFullyReceived ? 'received' : 'partial';
      } else {
        newStatus = 'partial';
      }

      // Update purchase order status and delivered date if fully received
      const updateData: any = {
        status: newStatus as any,
        updatedAt: new Date()
      };

      if (newStatus === 'received') {
        updateData.deliveredDate = new Date();
      }

      const [updatedPurchaseOrder] = await tx
        .update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, purchaseOrderId))
        .returning();

      return updatedPurchaseOrder;
    });
  }

  async updatePOReceivedFromGR(purchaseOrderId: number, items: Array<{ purchaseOrderItemId: number, quantityReceived: number }>): Promise<void> {
    return withTransaction(async (tx) => {
      const [purchaseOrder] = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, purchaseOrderId));

      if (!purchaseOrder) return;

      for (const item of items) {
        const [poItem] = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));

        if (!poItem || poItem.purchaseOrderId !== purchaseOrderId) continue;

        const currentReceived = parseFloat(poItem.receivedQuantity || '0');
        const newReceivedQuantity = Math.min(
          currentReceived + item.quantityReceived,
          parseFloat(poItem.quantity)
        );

        await tx
          .update(purchaseOrderItems)
          .set({
            receivedQuantity: newReceivedQuantity.toString(),
            updatedAt: new Date()
          })
          .where(eq(purchaseOrderItems.id, item.purchaseOrderItemId));
      }

      const allItems = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

      const allFullyReceived = allItems.every(item =>
        parseFloat(item.receivedQuantity || '0') >= parseFloat(item.quantity)
      );

      const anyReceived = allItems.some(item =>
        parseFloat(item.receivedQuantity || '0') > 0
      );

      let newStatus: string;
      if (allFullyReceived) {
        newStatus = 'received';
      } else if (anyReceived) {
        newStatus = 'partial';
      } else {
        newStatus = purchaseOrder.status;
      }

      const updateData: any = {
        status: newStatus as any,
        updatedAt: new Date()
      };

      if (newStatus === 'received') {
        updateData.deliveredDate = new Date();
      }

      await tx
        .update(purchaseOrders)
        .set(updateData)
        .where(eq(purchaseOrders.id, purchaseOrderId));
    });
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    return withTransaction(async (tx) => {
      // Delete transactions linked to PO payments first
      const poPayments = await tx.select({ id: purchaseOrderPayments.id }).from(purchaseOrderPayments).where(eq(purchaseOrderPayments.purchaseOrderId, id));
      for (const payment of poPayments) {
        await tx.delete(transactions).where(eq(transactions.purchaseOrderPaymentId, payment.id));
      }

      // Delete PO payments
      await tx.delete(purchaseOrderPayments).where(eq(purchaseOrderPayments.purchaseOrderId, id));

      // Delete purchase order items
      await tx.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));

      // Delete the purchase order
      await tx.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    });
  }

  async getProductPendingPOs(productId: number, storeId: number): Promise<Array<{
    purchaseOrderId: number;
    purchaseOrderNumber: string;
    supplierName: string;
    orderDate: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
  }>> {
    const result = await db
      .select({
        purchaseOrderId: purchaseOrders.id,
        purchaseOrderNumber: purchaseOrders.purchaseOrderNumber,
        supplierName: purchaseOrders.supplierName,
        orderDate: purchaseOrders.orderDate,
        orderedQty: purchaseOrderItems.quantity,
        receivedQty: purchaseOrderItems.receivedQuantity,
      })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .where(
        and(
          eq(purchaseOrderItems.productId, productId),
          eq(purchaseOrders.storeId, storeId),
          or(
            eq(purchaseOrders.status, 'pending'),
            eq(purchaseOrders.status, 'partial')
          )
        )
      )
      .orderBy(desc(purchaseOrders.orderDate));

    return result
      .map(row => {
        const orderedQty = parseFloat(row.orderedQty);
        const receivedQty = parseFloat(row.receivedQty || '0');
        const pendingQty = orderedQty - receivedQty;
        return {
          purchaseOrderId: row.purchaseOrderId,
          purchaseOrderNumber: row.purchaseOrderNumber,
          supplierName: row.supplierName,
          orderDate: row.orderDate,
          orderedQty,
          receivedQty,
          pendingQty,
        };
      })
      .filter(row => row.pendingQty > 0);
  }

  async getPendingPOItemsList(storeId: number): Promise<Array<{
    purchaseOrderId: number;
    purchaseOrderNumber: string;
    supplierName: string;
    orderDate: string;
    productId: number;
    productName: string;
    orderedQty: number;
    receivedQty: number;
    pendingQty: number;
  }>> {
    const result = await db
      .select({
        purchaseOrderId: purchaseOrders.id,
        purchaseOrderNumber: purchaseOrders.purchaseOrderNumber,
        supplierName: purchaseOrders.supplierName,
        orderDate: purchaseOrders.orderDate,
        productId: purchaseOrderItems.productId,
        productName: products.name,
        orderedQty: purchaseOrderItems.quantity,
        receivedQty: purchaseOrderItems.receivedQuantity,
      })
      .from(purchaseOrderItems)
      .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(
        and(
          eq(purchaseOrders.storeId, storeId),
          not(
            inArray(purchaseOrders.status, ['received', 'cancelled'])
          )
        )
      )
      .orderBy(desc(purchaseOrders.orderDate), purchaseOrderItems.id);

    return result
      .map(row => {
        const orderedQty = parseFloat(row.orderedQty);
        const receivedQty = parseFloat(row.receivedQty || '0');
        const pendingQty = orderedQty - receivedQty;
        return {
          purchaseOrderId: row.purchaseOrderId,
          purchaseOrderNumber: row.purchaseOrderNumber,
          supplierName: row.supplierName,
          orderDate: row.orderDate,
          productId: row.productId,
          productName: row.productName,
          orderedQty,
          receivedQty,
          pendingQty,
        };
      })
      .filter(row => row.pendingQty > 0);
  }

  // Transaction methods
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async getTransactions(storeId: number): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.storeId, storeId))
      .orderBy(desc(transactions.createdAt), desc(transactions.id));
  }

  async getTransactionsByType(storeId: number, type: string): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.storeId, storeId),
          eq(transactions.type, type as any)
        )
      )
      .orderBy(desc(transactions.createdAt), desc(transactions.id));
  }

  async createTransaction(transactionData: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transactionData)
      .returning();
    return newTransaction;
  }

  async updateTransaction(id: number, transactionData: Partial<InsertTransaction>): Promise<Transaction> {
    const [updatedTransaction] = await db
      .update(transactions)
      .set({ ...transactionData, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async deleteTransactionByInvoicePaymentId(invoicePaymentId: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.invoicePaymentId, invoicePaymentId));
  }

  async deleteTransactionByGoodsReceiptPaymentId(goodsReceiptPaymentId: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.goodsReceiptPaymentId, goodsReceiptPaymentId));
  }

  async deleteTransactionByPurchaseOrderPaymentId(purchaseOrderPaymentId: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.purchaseOrderPaymentId, purchaseOrderPaymentId));
  }

  // Stock adjustment methods
  async getStockAdjustment(id: number): Promise<StockAdjustment | undefined> {
    const [adjustment] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.id, id));
    return adjustment;
  }

  async getStockAdjustments(storeId: number): Promise<StockAdjustment[]> {
    return db
      .select()
      .from(stockAdjustments)
      .where(eq(stockAdjustments.storeId, storeId))
      .orderBy(desc(stockAdjustments.date));
  }

  async getStockAdjustmentsByProduct(productId: number, storeId: number): Promise<StockAdjustment[]> {
    return db
      .select()
      .from(stockAdjustments)
      .where(
        and(
          eq(stockAdjustments.productId, productId),
          eq(stockAdjustments.storeId, storeId)
        )
      )
      .orderBy(desc(stockAdjustments.date));
  }

  async createStockAdjustment(adjustment: InsertStockAdjustment): Promise<StockAdjustment> {
    const [created] = await db.insert(stockAdjustments).values(adjustment).returning();
    
    // If a specific batch is selected, update that batch
    if (adjustment.productBatchId) {
      const batch = await this.getProductBatch(adjustment.productBatchId);
      if (batch) {
        const currentQty = parseFloat(batch.remainingQuantity.toString());
        const adjustmentQty = parseFloat(adjustment.quantity.toString());
        const newQty = adjustment.type === 'increase' 
          ? currentQty + adjustmentQty 
          : Math.max(0, currentQty - adjustmentQty);
        
        await this.updateProductBatch(adjustment.productBatchId, {
          remainingQuantity: newQty.toString()
        });
      }
    } else {
      // If no specific batch, create a new adjustment batch or update the most recent batch
      const batches = await this.getProductBatches(adjustment.productId, adjustment.storeId);
      
      if (adjustment.type === 'increase') {
        // Create a new batch for stock increase
        const today = new Date().toISOString().split('T')[0];
        const batchNumber = `ADJ-${adjustment.productId}-${today}-${Date.now()}`;
        
        await this.createProductBatch({
          productId: adjustment.productId,
          storeId: adjustment.storeId,
          batchNumber,
          purchaseDate: adjustment.date,
          capitalCost: '0',
          initialQuantity: adjustment.quantity.toString(),
          remainingQuantity: adjustment.quantity.toString(),
          supplierName: 'Stock Adjustment',
          notes: `Stock adjustment: ${adjustment.reason}`
        });
      } else {
        // For decrease, use FIFO from existing batches
        let remainingToDecrease = parseFloat(adjustment.quantity.toString());
        
        for (const batch of batches) {
          if (remainingToDecrease <= 0) break;
          
          const batchQty = parseFloat(batch.remainingQuantity.toString());
          if (batchQty > 0) {
            const decreaseAmount = Math.min(batchQty, remainingToDecrease);
            await this.updateProductBatch(batch.id, {
              remainingQuantity: (batchQty - decreaseAmount).toString()
            });
            remainingToDecrease -= decreaseAmount;
          }
        }
      }
    }
    
    return created;
  }

  async deleteStockAdjustment(id: number): Promise<void> {
    await db.delete(stockAdjustments).where(eq(stockAdjustments.id, id));
  }

  // Settings methods
  async getSetting(storeId: number, key: string): Promise<Setting | undefined> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.storeId, storeId),
          eq(settings.key, key)
        )
      );
    return setting;
  }

  async getSettings(storeId: number): Promise<Setting[]> {
    return db
      .select()
      .from(settings)
      .where(eq(settings.storeId, storeId));
  }

  async setSetting(settingData: InsertSetting): Promise<Setting> {
    // Check if setting exists
    const [existingSetting] = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.storeId, settingData.storeId),
          eq(settings.key, settingData.key)
        )
      );

    if (existingSetting) {
      // Update existing setting
      const [updatedSetting] = await db
        .update(settings)
        .set({ 
          value: settingData.value,
          updatedAt: new Date()
        })
        .where(eq(settings.id, existingSetting.id))
        .returning();
      return updatedSetting;
    } else {
      // Create new setting
      const [newSetting] = await db
        .insert(settings)
        .values(settingData)
        .returning();
      return newSetting;
    }
  }

  async deleteSetting(id: number): Promise<void> {
    await db.delete(settings).where(eq(settings.id, id));
  }

  // Print Settings methods
  async getPrintSettings(storeId: number): Promise<PrintSettings | undefined> {
    const [printSetting] = await db
      .select()
      .from(printSettings)
      .where(eq(printSettings.storeId, storeId));
    return printSetting;
  }

  async createPrintSettings(settingsData: InsertPrintSettings): Promise<PrintSettings> {
    const [newSettings] = await db
      .insert(printSettings)
      .values(settingsData)
      .returning();
    return newSettings;
  }

  async updatePrintSettings(storeId: number, settingsData: Partial<InsertPrintSettings>): Promise<PrintSettings> {
    const [updatedSettings] = await db
      .update(printSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(printSettings.storeId, storeId))
      .returning();
    return updatedSettings;
  }

  // Payment Types methods
  async getPaymentTypes(storeId: number): Promise<PaymentType[]> {
    return db
      .select()
      .from(paymentTypes)
      .where(eq(paymentTypes.storeId, storeId))
      .orderBy(paymentTypes.name);
  }

  async getPaymentType(id: number): Promise<PaymentType | undefined> {
    const [paymentType] = await db
      .select()
      .from(paymentTypes)
      .where(eq(paymentTypes.id, id));
    return paymentType;
  }

  async getPaymentTypeByName(storeId: number, name: string): Promise<PaymentType | undefined> {
    const [paymentType] = await db
      .select()
      .from(paymentTypes)
      .where(and(eq(paymentTypes.storeId, storeId), eq(paymentTypes.name, name)));
    return paymentType;
  }

  async createPaymentType(paymentTypeData: InsertPaymentType): Promise<PaymentType> {
    const [newPaymentType] = await db
      .insert(paymentTypes)
      .values(paymentTypeData)
      .returning();
    return newPaymentType;
  }

  async updatePaymentType(id: number, paymentTypeData: Partial<InsertPaymentType>): Promise<PaymentType> {
    const [updatedPaymentType] = await db
      .update(paymentTypes)
      .set({ ...paymentTypeData, updatedAt: new Date() })
      .where(eq(paymentTypes.id, id))
      .returning();
    return updatedPaymentType;
  }

  async deletePaymentType(id: number): Promise<void> {
    await db.delete(paymentTypes).where(eq(paymentTypes.id, id));
  }

  // Payment Terms methods
  async getPaymentTerms(storeId: number): Promise<PaymentTerm[]> {
    return db
      .select()
      .from(paymentTermsConfig)
      .where(eq(paymentTermsConfig.storeId, storeId))
      .orderBy(paymentTermsConfig.days);
  }

  async getPaymentTerm(id: number): Promise<PaymentTerm | undefined> {
    const [paymentTerm] = await db
      .select()
      .from(paymentTermsConfig)
      .where(eq(paymentTermsConfig.id, id));
    return paymentTerm;
  }

  async createPaymentTerm(paymentTermData: InsertPaymentTerm): Promise<PaymentTerm> {
    const [newPaymentTerm] = await db
      .insert(paymentTermsConfig)
      .values(paymentTermData)
      .returning();
    return newPaymentTerm;
  }

  async updatePaymentTerm(id: number, paymentTermData: Partial<InsertPaymentTerm>): Promise<PaymentTerm> {
    const [updatedPaymentTerm] = await db
      .update(paymentTermsConfig)
      .set({ ...paymentTermData, updatedAt: new Date() })
      .where(eq(paymentTermsConfig.id, id))
      .returning();
    return updatedPaymentTerm;
  }

  async deletePaymentTerm(id: number): Promise<void> {
    await db.delete(paymentTermsConfig).where(eq(paymentTermsConfig.id, id));
  }

  // Inflow Categories methods
  async getInflowCategories(storeId: number): Promise<InflowCategory[]> {
    return db
      .select()
      .from(inflowCategories)
      .where(eq(inflowCategories.storeId, storeId))
      .orderBy(inflowCategories.name);
  }

  async getInflowCategory(id: number): Promise<InflowCategory | undefined> {
    const [category] = await db
      .select()
      .from(inflowCategories)
      .where(eq(inflowCategories.id, id));
    return category;
  }

  async createInflowCategory(categoryData: InsertInflowCategory): Promise<InflowCategory> {
    const [newCategory] = await db
      .insert(inflowCategories)
      .values(categoryData)
      .returning();
    return newCategory;
  }

  async updateInflowCategory(id: number, categoryData: Partial<InsertInflowCategory>): Promise<InflowCategory> {
    const [updatedCategory] = await db
      .update(inflowCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(inflowCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteInflowCategory(id: number): Promise<void> {
    await db.delete(inflowCategories).where(eq(inflowCategories.id, id));
  }

  // Outflow Categories methods
  async getOutflowCategories(storeId: number): Promise<OutflowCategory[]> {
    return db
      .select()
      .from(outflowCategories)
      .where(eq(outflowCategories.storeId, storeId))
      .orderBy(outflowCategories.name);
  }

  async getOutflowCategory(id: number): Promise<OutflowCategory | undefined> {
    const [category] = await db
      .select()
      .from(outflowCategories)
      .where(eq(outflowCategories.id, id));
    return category;
  }

  async createOutflowCategory(categoryData: InsertOutflowCategory): Promise<OutflowCategory> {
    const [newCategory] = await db
      .insert(outflowCategories)
      .values(categoryData)
      .returning();
    return newCategory;
  }

  async updateOutflowCategory(id: number, categoryData: Partial<InsertOutflowCategory>): Promise<OutflowCategory> {
    const [updatedCategory] = await db
      .update(outflowCategories)
      .set({ ...categoryData, updatedAt: new Date() })
      .where(eq(outflowCategories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteOutflowCategory(id: number): Promise<void> {
    await db.delete(outflowCategories).where(eq(outflowCategories.id, id));
  }

  // Cash Account methods
  async getCashAccounts(storeId: number): Promise<CashAccount[]> {
    return db
      .select()
      .from(cashAccounts)
      .where(eq(cashAccounts.storeId, storeId))
      .orderBy(cashAccounts.name);
  }

  async getCashAccount(id: number): Promise<CashAccount | undefined> {
    const [account] = await db
      .select()
      .from(cashAccounts)
      .where(eq(cashAccounts.id, id));
    return account;
  }

  async getCashAccountWithBalance(id: number): Promise<CashAccountWithBalance | undefined> {
    const account = await this.getCashAccount(id);
    if (!account) return undefined;

    // Get total income for this account
    const incomeResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM ${transactions}
      WHERE account_id = ${id} AND type = 'income'
    `);
    const totalIncome = parseFloat(incomeResult[0]?.total || '0');

    // Get total expenses for this account
    const expenseResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM ${transactions}
      WHERE account_id = ${id} AND type = 'expense'
    `);
    const totalExpense = parseFloat(expenseResult[0]?.total || '0');

    // Get total transfers in
    const transfersInResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM ${accountTransfers}
      WHERE to_account_id = ${id}
    `);
    const totalTransfersIn = parseFloat(transfersInResult[0]?.total || '0');

    // Get total transfers out
    const transfersOutResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM ${accountTransfers}
      WHERE from_account_id = ${id}
    `);
    const totalTransfersOut = parseFloat(transfersOutResult[0]?.total || '0');

    const initialBalance = parseFloat(account.initialBalance || '0');
    const currentBalance = initialBalance + totalIncome - totalExpense + totalTransfersIn - totalTransfersOut;

    return {
      ...account,
      currentBalance,
      totalIncome,
      totalExpense,
      totalTransfersIn,
      totalTransfersOut
    };
  }

  async getCashAccountsWithBalance(storeId: number): Promise<CashAccountWithBalance[]> {
    const accounts = await this.getCashAccounts(storeId);
    const accountsWithBalance: CashAccountWithBalance[] = [];

    for (const account of accounts) {
      const withBalance = await this.getCashAccountWithBalance(account.id);
      if (withBalance) {
        accountsWithBalance.push(withBalance);
      }
    }

    return accountsWithBalance;
  }

  async createCashAccount(account: InsertCashAccount): Promise<CashAccount> {
    const [newAccount] = await db
      .insert(cashAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async updateCashAccount(id: number, account: Partial<InsertCashAccount>): Promise<CashAccount> {
    const [updatedAccount] = await db
      .update(cashAccounts)
      .set({ ...account, updatedAt: new Date() })
      .where(eq(cashAccounts.id, id))
      .returning();
    return updatedAccount;
  }

  async deleteCashAccount(id: number): Promise<void> {
    await db.delete(cashAccounts).where(eq(cashAccounts.id, id));
  }

  // Account Transfer methods
  async getAccountTransfers(storeId: number): Promise<AccountTransfer[]> {
    return db
      .select()
      .from(accountTransfers)
      .where(eq(accountTransfers.storeId, storeId))
      .orderBy(desc(accountTransfers.date));
  }

  async getAccountTransfer(id: number): Promise<AccountTransfer | undefined> {
    const [transfer] = await db
      .select()
      .from(accountTransfers)
      .where(eq(accountTransfers.id, id));
    return transfer;
  }

  async createAccountTransfer(transfer: InsertAccountTransfer): Promise<AccountTransfer> {
    const [newTransfer] = await db
      .insert(accountTransfers)
      .values(transfer)
      .returning();
    return newTransfer;
  }

  async updateAccountTransfer(id: number, transfer: Partial<InsertAccountTransfer>): Promise<AccountTransfer> {
    const [updatedTransfer] = await db
      .update(accountTransfers)
      .set({ ...transfer, updatedAt: new Date() })
      .where(eq(accountTransfers.id, id))
      .returning();
    return updatedTransfer;
  }

  async deleteAccountTransfer(id: number): Promise<void> {
    await db.delete(accountTransfers).where(eq(accountTransfers.id, id));
  }

  // Import/Export methods
  async createImportExportLog(logData: InsertImportExportLog): Promise<ImportExportLog> {
    const [newLog] = await db
      .insert(importExportLogs)
      .values(logData)
      .returning();
    return newLog;
  }

  async getImportExportLogs(storeId: number): Promise<ImportExportLog[]> {
    return db
      .select()
      .from(importExportLogs)
      .where(eq(importExportLogs.storeId, storeId))
      .orderBy(desc(importExportLogs.completedAt));
  }

  // Dashboard metrics
  async getDashboardStats(storeId: number): Promise<DashboardStats> {
    // Get current date
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDay()); // Sunday of current week
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Format dates as strings for PostgreSQL
    const startOfDayStr = startOfDay.toISOString().split('T')[0];
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

    // Calculate total revenue and expenses
    const revenueResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM ${sql.identifier('transactions')}
      WHERE store_id = ${storeId} AND type = 'income'
    `);

    const expensesResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as total
      FROM ${sql.identifier('transactions')}
      WHERE store_id = ${storeId} AND type = 'expense'
    `);

    // Calculate open invoices (excluding paid and cancelled)
    const openInvoicesResult = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_amount::numeric), 0) as value
      FROM ${invoices}
      WHERE store_id = ${storeId} AND status IN ('draft', 'sent', 'overdue')
    `);

    // Count clients
    const clientsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${clients}
      WHERE store_id = ${storeId}
    `);

    // Count products belonging to this store
    const productsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${products}
      WHERE store_id = ${storeId} AND is_active = true
    `);

    // Count products with low stock (summing batches per store)
    const lowStockResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM (
        SELECT p.id
        FROM ${products} p
        LEFT JOIN ${productBatches} pb ON p.id = pb.product_id AND pb.store_id = ${storeId}
        WHERE p.store_id = ${storeId} AND p.is_active = true
        GROUP BY p.id
        HAVING COALESCE(SUM(pb.remaining_quantity::numeric), 0) <= p.min_stock
      ) as low_stock_products
    `);

    // Count sales by periods
    const salesTodayResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${invoices}
      WHERE store_id = ${storeId} 
        AND status = 'paid'
        AND issue_date >= ${startOfDayStr}
    `);

    const salesThisWeekResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${invoices}
      WHERE store_id = ${storeId} 
        AND status = 'paid'
        AND issue_date >= ${startOfWeekStr}
    `);

    const salesThisMonthResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${invoices}
      WHERE store_id = ${storeId} 
        AND status = 'paid'
        AND issue_date >= ${startOfMonthStr}
    `);

    // Calculate total profit from delivered delivery notes
    const profitResult = await db.execute(sql`
      SELECT COALESCE(SUM(profit::numeric), 0) as total
      FROM ${deliveryNotes}
      WHERE store_id = ${storeId} AND status = 'delivered'
    `);

    return {
      totalRevenue: parseFloat(revenueResult[0]?.total || '0'),
      totalExpenses: parseFloat(expensesResult[0]?.total || '0'),
      totalProfit: parseFloat(profitResult[0]?.total || '0'),
      openInvoices: {
        count: parseInt(openInvoicesResult[0]?.count || '0'),
        value: parseFloat(openInvoicesResult[0]?.value || '0')
      },
      totalClients: parseInt(clientsResult[0]?.count || '0'),
      productsCount: parseInt(productsResult[0]?.count || '0'),
      lowStockCount: parseInt(lowStockResult[0]?.count || '0'),
      salesCount: {
        today: parseInt(salesTodayResult[0]?.count || '0'),
        thisWeek: parseInt(salesThisWeekResult[0]?.count || '0'),
        thisMonth: parseInt(salesThisMonthResult[0]?.count || '0')
      }
    };
  }

  async getTopClients(storeId: number, limit: number): Promise<ClientWithSalesStats[]> {
    const result = await db.execute(sql`
      WITH client_stats AS (
        SELECT 
          c.id,
          c.name,
          c.email,
          COUNT(DISTINCT i.id) as invoice_count,
          COALESCE(SUM(i.total_amount::numeric), 0) as total_spent,
          MAX(i.issue_date) as last_purchase_date
        FROM ${clients} c
        LEFT JOIN ${invoices} i ON c.id = i.client_id AND i.status = 'paid'
        WHERE c.store_id = ${storeId}
        GROUP BY c.id, c.name, c.email
      )
      SELECT 
        id,
        name,
        email,
        invoice_count,
        total_spent,
        CASE 
          WHEN invoice_count > 0 THEN total_spent / invoice_count 
          ELSE 0 
        END as average_spend,
        last_purchase_date
      FROM client_stats
      ORDER BY total_spent DESC
      LIMIT ${limit}
    `);

    return result.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      invoiceCount: parseInt(row.invoice_count || '0'),
      totalSpent: parseFloat(row.total_spent || '0'),
      averageSpend: parseFloat(row.average_spend || '0'),
      lastPurchaseDate: row.last_purchase_date
    }));
  }

  async getInvoiceStatusSummary(storeId: number): Promise<InvoiceStatusSummary> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'paid') as paid,
        COUNT(*) FILTER (WHERE status IN ('sent', 'draft')) as pending,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue,
        COUNT(*) as total
      FROM ${invoices}
      WHERE store_id = ${storeId}
    `);

    const row = result[0];
    return {
      paid: parseInt(row.paid || '0'),
      pending: parseInt(row.pending || '0'),
      overdue: parseInt(row.overdue || '0'),
      total: parseInt(row.total || '0')
    };
  }

  async getProductSalesByCategory(storeId: number): Promise<CategorySalesData[]> {
    const result = await db.execute(sql`
      SELECT 
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(ii.total_amount::numeric), 0) as total_revenue,
        COALESCE(SUM(ii.quantity::numeric), 0) as total_quantity,
        COUNT(DISTINCT p.id) as product_count
      FROM ${sql.identifier('categories')} c
      INNER JOIN ${sql.identifier('products')} p ON c.id = p.category_id
      INNER JOIN ${sql.identifier('invoice_items')} ii ON p.id = ii.product_id
      INNER JOIN ${sql.identifier('invoices')} i ON ii.invoice_id = i.id
      WHERE i.store_id = ${storeId} AND i.status = 'paid'
      GROUP BY c.id, c.name
      HAVING COALESCE(SUM(ii.total_amount::numeric), 0) > 0

      UNION ALL

      SELECT 
        NULL as category_id,
        'Uncategorized' as category_name,
        COALESCE(SUM(ii.total_amount::numeric), 0) as total_revenue,
        COALESCE(SUM(ii.quantity::numeric), 0) as total_quantity,
        COUNT(DISTINCT p.id) as product_count
      FROM ${sql.identifier('products')} p
      INNER JOIN ${sql.identifier('invoice_items')} ii ON p.id = ii.product_id
      INNER JOIN ${sql.identifier('invoices')} i ON ii.invoice_id = i.id
      WHERE p.category_id IS NULL AND i.store_id = ${storeId} AND i.status = 'paid'
      GROUP BY p.category_id
      HAVING COALESCE(SUM(ii.total_amount::numeric), 0) > 0

      ORDER BY total_revenue DESC
    `);

    return result.map(row => ({
      categoryId: row.category_id ? parseInt(row.category_id as string) : null,
      categoryName: row.category_name as string,
      totalRevenue: parseFloat(row.total_revenue as string || '0'),
      totalQuantity: parseFloat(row.total_quantity as string || '0'),
      productCount: parseInt(row.product_count as string || '0')
    }));
  }

  async getRevenueData(storeId: number, start: Date, end: Date): Promise<RevenueData> {
    // Generate series of dates between start and end
    const dateList = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dateList.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Format dates for display as full ISO date so frontend can show year info
    const dateLabels = dateList.map(date => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    });

    // Format dates as strings for PostgreSQL
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    // Get revenue data
    const revenueResult = await db.execute(sql`
      SELECT 
        DATE(date) as date,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount::numeric ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0) as expenses
      FROM ${transactions}
      WHERE 
        store_id = ${storeId} AND
        date >= ${startStr} AND
        date <= ${endStr}
      GROUP BY DATE(date)
      ORDER BY DATE(date)
    `);

    // Initialize data arrays
    const revenueData = Array(dateList.length).fill(0);
    const expenseData = Array(dateList.length).fill(0);
    const profitData = Array(dateList.length).fill(0);

    // Populate data arrays from query results
    revenueResult.forEach(row => {
      const rowDate = new Date(row.date);
      const index = dateList.findIndex(date => 
        date.getDate() === rowDate.getDate() &&
        date.getMonth() === rowDate.getMonth() &&
        date.getFullYear() === rowDate.getFullYear()
      );

      if (index !== -1) {
        revenueData[index] = parseFloat(row.income || '0');
        expenseData[index] = parseFloat(row.expenses || '0');
        profitData[index] = revenueData[index] - expenseData[index];
      }
    });

    return {
      dates: dateLabels,
      revenue: revenueData,
      expenses: expenseData,
      profit: profitData
    };
  }

  async getProductPerformance(storeId: number, limit: number): Promise<ProductPerformanceStats[]> {
    const result = await db.execute(sql`
      WITH product_sales AS (
        SELECT 
          p.id,
          p.name,
          p.sku,
          SUM(ii.quantity::numeric) as total_sold,
          SUM(ii.total_amount::numeric) as total_revenue,
          SUM(ii.profit::numeric) as total_profit
        FROM ${sql.identifier('products')} p
        JOIN ${sql.identifier('invoice_items')} ii ON p.id = ii.product_id
        JOIN ${sql.identifier('invoices')} i ON ii.invoice_id = i.id
        WHERE i.store_id = ${storeId} AND i.status = 'paid'
        GROUP BY p.id, p.name, p.sku
      )
      SELECT 
        id,
        name,
        sku,
        total_sold,
        total_revenue,
        total_profit,
        CASE 
          WHEN total_revenue > 0 THEN (total_profit / total_revenue) * 100 
          ELSE 0 
        END as profit_margin
      FROM product_sales
      ORDER BY total_profit DESC
      LIMIT ${limit}
    `);

    return result.map(row => ({
      id: row.id,
      name: row.name,
      sku: row.sku,
      totalSold: parseFloat(row.total_sold || '0'),
      totalRevenue: parseFloat(row.total_revenue || '0'),
      totalProfit: parseFloat(row.total_profit || '0'),
      profitMargin: parseFloat(row.profit_margin || '0')
    }));
  }

  async getInventoryValueStats(storeId: number): Promise<InventoryValueStats> {
    // Get inventory summary stats
    const summaryResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT p.id) as total_items,
        COUNT(pb.id) as batches_count,
        COALESCE(SUM(pb.remaining_quantity::numeric * pb.capital_cost::numeric), 0) as total_value,
        CASE 
          WHEN SUM(pb.remaining_quantity::numeric) > 0 
          THEN SUM(pb.remaining_quantity::numeric * pb.capital_cost::numeric) / SUM(pb.remaining_quantity::numeric)
          ELSE 0 
        END as average_cost
      FROM ${sql.identifier('product_batches')} pb
      JOIN ${sql.identifier('products')} p ON pb.product_id = p.id
      WHERE pb.store_id = ${storeId} AND pb.remaining_quantity::numeric > 0
    `);

    // Get value by category
    const categoryResult = await db.execute(sql`
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category,
        COALESCE(SUM(pb.remaining_quantity::numeric * pb.capital_cost::numeric), 0) as value
      FROM ${sql.identifier('product_batches')} pb
      JOIN ${sql.identifier('products')} p ON pb.product_id = p.id
      LEFT JOIN ${sql.identifier('categories')} c ON p.category_id = c.id
      WHERE pb.store_id = ${storeId} AND pb.remaining_quantity::numeric > 0
      GROUP BY c.name
      ORDER BY value DESC
    `);

    return {
      totalItems: parseInt(summaryResult[0]?.total_items || '0'),
      totalValue: parseFloat(summaryResult[0]?.total_value || '0'),
      batchesCount: parseInt(summaryResult[0]?.batches_count || '0'),
      averageCost: parseFloat(summaryResult[0]?.average_cost || '0'),
      valueByCategory: categoryResult.map(row => ({
        category: row.category,
        value: parseFloat(row.value || '0')
      }))
    };
  }

  async getFinancialReport(storeId: number, dateRange: string): Promise<any> {
    const { startDate, endDate } = this.getDateRangeFromString(dateRange);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Get sales revenue from paid invoices
    const salesRevenueResult = await db.execute(sql`
      SELECT COALESCE(SUM(total_amount::numeric), 0) as sales_revenue
      FROM ${invoices}
      WHERE store_id = ${storeId} 
        AND status = 'paid'
        AND issue_date >= ${startStr}
        AND issue_date <= ${endStr}
    `);

    // Get other income from transactions (exclude invoice payment transactions to avoid double counting)
    const otherIncomeResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as other_income
      FROM ${transactions}
      WHERE store_id = ${storeId}
        AND type = 'income'
        AND category != 'Sales'
        AND invoice_payment_id IS NULL
        AND date >= ${startStr}
        AND date <= ${endStr}
    `);

    // Get total COGS from paid invoices:
    // For self_pickup: COGS = total_amount - total_profit (profit saved at payment time)
    // For delivery: COGS = SUM(delivery_notes.total_cost) for delivered notes
    const cogsResult = await db.execute(sql`
      SELECT 
        COALESCE(
          -- Self-pickup: cost = revenue - profit (stored in invoices.total_profit when paid)
          (SELECT SUM((i.total_amount - COALESCE(i.total_profit, 0))::numeric)
           FROM ${invoices} i
           WHERE i.store_id = ${storeId}
             AND i.delivery_type = 'self_pickup'
             AND i.status = 'paid'
             AND i.issue_date >= ${startStr}
             AND i.issue_date <= ${endStr}
             AND i.total_profit IS NOT NULL AND i.total_profit != 0),
        0) +
        COALESCE(
          -- Delivery: cost from delivered delivery notes (total_cost set by FIFO allocation)
          (SELECT SUM(dn.total_cost::numeric)
           FROM ${deliveryNotes} dn
           JOIN ${invoices} i ON i.id = dn.invoice_id
           WHERE i.store_id = ${storeId}
             AND i.status = 'paid'
             AND i.issue_date >= ${startStr}
             AND i.issue_date <= ${endStr}
             AND dn.status = 'delivered'
             AND dn.profit IS NOT NULL),
        0) as total_cogs
    `);

    // Get return cost adjustment (batches created from returns in the period)
    const returnCostResult = await db.execute(sql`
      SELECT COALESCE(SUM(pb.initial_quantity::numeric * pb.capital_cost::numeric), 0) as return_cost
      FROM ${productBatches} pb
      WHERE pb.store_id = ${storeId}
        AND pb.batch_number LIKE 'RTN-%'
        AND pb.purchase_date >= ${startStr}
        AND pb.purchase_date <= ${endStr}
    `);

    // Get inventory values
    const inventoryResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(CASE WHEN pb.purchase_date < ${startStr} THEN pb.remaining_quantity::numeric * pb.capital_cost::numeric ELSE 0 END), 0) as beginning_inventory,
        COALESCE(SUM(pb.remaining_quantity::numeric * pb.capital_cost::numeric), 0) as ending_inventory,
        COALESCE(SUM(CASE WHEN pb.purchase_date >= ${startStr} AND pb.purchase_date <= ${endStr} THEN pb.initial_quantity::numeric * pb.capital_cost::numeric ELSE 0 END), 0) as purchases
      FROM ${productBatches} pb
      WHERE pb.store_id = ${storeId}
    `);

    // Get operating expenses (exclude PO prepaid payments — those are already in COGS via product batches purchases)
    const operatingExpensesResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as operating_expenses
      FROM ${transactions}
      WHERE store_id = ${storeId}
        AND type = 'expense'
        AND purchase_order_payment_id IS NULL
        AND date >= ${startStr}
        AND date <= ${endStr}
    `);

    const salesRevenue = parseFloat(salesRevenueResult[0]?.sales_revenue || '0');
    const otherIncome = parseFloat(otherIncomeResult[0]?.other_income || '0');
    const totalRevenue = salesRevenue + otherIncome;

    const beginningInventory = parseFloat(inventoryResult[0]?.beginning_inventory || '0');
    const purchases = parseFloat(inventoryResult[0]?.purchases || '0');
    const endingInventory = parseFloat(inventoryResult[0]?.ending_inventory || '0');
    const grossCOGS = parseFloat(cogsResult[0]?.total_cogs || '0');
    const returnCost = parseFloat(returnCostResult[0]?.return_cost || '0');
    const totalCOGS = grossCOGS - returnCost;

    const operatingExpenses = parseFloat(operatingExpensesResult[0]?.operating_expenses || '0');
    const otherExpenses = 0; // Can be expanded later

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - operatingExpenses - otherExpenses;

    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      revenue: {
        salesRevenue,
        otherIncome,
        totalRevenue
      },
      cogs: {
        beginningInventory,
        purchases,
        endingInventory,
        returnCost,
        totalCOGS
      },
      expenses: {
        operatingExpenses,
        otherExpenses,
        totalExpenses: operatingExpenses + otherExpenses
      },
      profit: {
        grossProfit,
        netProfit,
        grossProfitMargin,
        netProfitMargin
      }
    };
  }

  async getCashFlowReport(storeId: number, dateRange: string): Promise<any> {
    const { startDate, endDate } = this.getDateRangeFromString(dateRange);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Operating activities - cash from sales
    const cashFromSalesResult = await db.execute(sql`
      SELECT COALESCE(SUM(total_amount::numeric), 0) as cash_from_sales
      FROM ${invoices}
      WHERE store_id = ${storeId}
        AND status = 'paid'
        AND issue_date >= ${startStr}
        AND issue_date <= ${endStr}
    `);

    // Cash paid to suppliers (from purchase orders)
    const cashToSuppliersResult = await db.execute(sql`
      SELECT COALESCE(SUM(total_amount::numeric), 0) as cash_to_suppliers
      FROM ${purchaseOrders}
      WHERE store_id = ${storeId}
        AND status IN ('received', 'partial')
        AND order_date >= ${startStr}
        AND order_date <= ${endStr}
    `);

    // Cash paid for expenses
    const cashForExpensesResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as cash_for_expenses
      FROM ${transactions}
      WHERE store_id = ${storeId}
        AND type = 'expense'
        AND date >= ${startStr}
        AND date <= ${endStr}
    `);

    // Equipment purchases (if tracked in transactions)
    const equipmentResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as equipment_purchases
      FROM ${transactions}
      WHERE store_id = ${storeId}
        AND type = 'expense'
        AND category = 'Equipment'
        AND date >= ${startStr}
        AND date <= ${endStr}
    `);

    // Owner investment (if tracked)
    const ownerInvestmentResult = await db.execute(sql`
      SELECT COALESCE(SUM(amount::numeric), 0) as owner_investment
      FROM ${transactions}
      WHERE store_id = ${storeId}
        AND type = 'income'
        AND category = 'Owner Investment'
        AND date >= ${startStr}
        AND date <= ${endStr}
    `);

    const cashFromSales = parseFloat(cashFromSalesResult[0]?.cash_from_sales || '0');
    const cashPaidToSuppliers = parseFloat(cashToSuppliersResult[0]?.cash_to_suppliers || '0');
    const cashPaidForExpenses = parseFloat(cashForExpensesResult[0]?.cash_for_expenses || '0');
    const equipmentPurchases = parseFloat(equipmentResult[0]?.equipment_purchases || '0');
    const ownerInvestment = parseFloat(ownerInvestmentResult[0]?.owner_investment || '0');

    const netOperatingCashFlow = cashFromSales - cashPaidToSuppliers - cashPaidForExpenses;
    const netInvestingCashFlow = -equipmentPurchases;
    const netFinancingCashFlow = ownerInvestment;
    const netCashFlow = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;

    // Calculate per-account breakdown from cash accounts
    const allAccounts = await this.getCashAccounts(storeId);
    const accountBreakdown: { 
      id: number; 
      name: string; 
      openingBalance: number; 
      inflow: number; 
      outflow: number; 
      closingBalance: number; 
    }[] = [];

    let totalBeginningCash = 0;
    let totalEndingCash = 0;

    for (const account of allAccounts) {
      // Get transactions for this account before start date (opening balance)
      const openingTxResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount::numeric ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0) as opening_balance
        FROM ${transactions}
        WHERE store_id = ${storeId}
          AND account_id = ${account.id}
          AND date < ${startStr}
      `);
      
      // Get transfers before start date for opening balance
      const openingTransfersInResult = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) as transfers_in
        FROM ${accountTransfers}
        WHERE store_id = ${storeId}
          AND to_account_id = ${account.id}
          AND date < ${startStr}
      `);
      const openingTransfersOutResult = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) as transfers_out
        FROM ${accountTransfers}
        WHERE store_id = ${storeId}
          AND from_account_id = ${account.id}
          AND date < ${startStr}
      `);
      
      // Add initial balance from account + transactions + transfers
      const accountInitialBalance = parseFloat(account.initialBalance?.toString() || '0');
      const openingTxBalance = parseFloat(openingTxResult[0]?.opening_balance?.toString() || '0');
      const openingTransfersIn = parseFloat(openingTransfersInResult[0]?.transfers_in?.toString() || '0');
      const openingTransfersOut = parseFloat(openingTransfersOutResult[0]?.transfers_out?.toString() || '0');
      const openingBalance = accountInitialBalance + openingTxBalance + openingTransfersIn - openingTransfersOut;

      // Get inflows and outflows during the period (transactions)
      const periodResult = await db.execute(sql`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'income' THEN amount::numeric ELSE 0 END), 0) as inflow,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount::numeric ELSE 0 END), 0) as outflow
        FROM ${transactions}
        WHERE store_id = ${storeId}
          AND account_id = ${account.id}
          AND date >= ${startStr}
          AND date <= ${endStr}
      `);

      // Get transfers during the period
      const periodTransfersInResult = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) as transfers_in
        FROM ${accountTransfers}
        WHERE store_id = ${storeId}
          AND to_account_id = ${account.id}
          AND date >= ${startStr}
          AND date <= ${endStr}
      `);
      const periodTransfersOutResult = await db.execute(sql`
        SELECT COALESCE(SUM(amount::numeric), 0) as transfers_out
        FROM ${accountTransfers}
        WHERE store_id = ${storeId}
          AND from_account_id = ${account.id}
          AND date >= ${startStr}
          AND date <= ${endStr}
      `);

      const txInflow = parseFloat(periodResult[0]?.inflow?.toString() || '0');
      const txOutflow = parseFloat(periodResult[0]?.outflow?.toString() || '0');
      const periodTransfersIn = parseFloat(periodTransfersInResult[0]?.transfers_in?.toString() || '0');
      const periodTransfersOut = parseFloat(periodTransfersOutResult[0]?.transfers_out?.toString() || '0');
      
      const inflow = txInflow + periodTransfersIn;
      const outflow = txOutflow + periodTransfersOut;
      const closingBalance = openingBalance + inflow - outflow;

      accountBreakdown.push({
        id: account.id,
        name: account.name,
        openingBalance,
        inflow,
        outflow,
        closingBalance
      });

      totalBeginningCash += openingBalance;
      totalEndingCash += closingBalance;
    }

    return {
      operating: {
        cashFromSales,
        cashPaidToSuppliers,
        cashPaidForExpenses,
        netOperatingCashFlow
      },
      investing: {
        equipmentPurchases,
        netInvestingCashFlow
      },
      financing: {
        ownerInvestment,
        netFinancingCashFlow
      },
      netCashFlow,
      beginningCash: totalBeginningCash,
      endingCash: totalEndingCash,
      accountBreakdown
    };
  }

  private getDateRangeFromString(dateRange: string): { startDate: Date; endDate: Date } {
    const today = new Date();
    let endDate = new Date(today);
    let startDate = new Date(today);

    // Handle custom date range format: "custom:YYYY-MM-DD:YYYY-MM-DD"
    if (dateRange.startsWith('custom:')) {
      const parts = dateRange.split(':');
      if (parts.length === 3) {
        startDate = new Date(parts[1]);
        endDate = new Date(parts[2]);
        return { startDate, endDate };
      }
    }

    switch (dateRange) {
      case 'this_month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate.setDate(0); // Last day of previous month
        break;
      case 'this_quarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'this_year':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    return { startDate, endDate };
  }

  async getBatchProfitabilityAnalysis(storeId: number, productId?: number): Promise<BatchProfitabilityData[]> {
    // Product-level profitability based on delivered items
    const productFilter = productId 
      ? sql`AND p.id = ${productId}` 
      : sql``;

    const result = await db.execute(sql`
      WITH product_delivery_stats AS (
        SELECT 
          ii.product_id,
          SUM(dni.delivered_quantity::numeric) as delivered_qty,
          SUM(ii.unit_price::numeric * dni.delivered_quantity::numeric) as revenue,
          SUM(dn.total_cost::numeric) as cost
        FROM ${deliveryNotes} dn
        JOIN ${deliveryNoteItems} dni ON dni.delivery_note_id = dn.id
        JOIN ${invoiceItems} ii ON dni.invoice_item_id = ii.id
        WHERE dn.store_id = ${storeId}
          AND dn.status = 'delivered'
          AND dn.profit IS NOT NULL
        GROUP BY ii.product_id
      )
      SELECT 
        p.id as product_id,
        p.name as product_name,
        pb.batch_number,
        pb.capital_cost as capital_cost,
        pb.purchase_date,
        (pb.initial_quantity::numeric - pb.remaining_quantity::numeric) as sold_quantity,
        COALESCE(pds.revenue / NULLIF(pds.delivered_qty, 0), p.price::numeric) as avg_selling_price,
        CASE 
          WHEN COALESCE(pds.cost, 0) > 0 
          THEN (COALESCE(pds.revenue, 0) - COALESCE(pds.cost, 0)) / NULLIF(pds.cost, 0) * 100
          ELSE 0 
        END as profit_margin,
        CASE 
          WHEN (pb.initial_quantity::numeric - pb.remaining_quantity::numeric) > 0 
          THEN (
            (COALESCE(pds.revenue / NULLIF(pds.delivered_qty, 0), p.price::numeric) * (pb.initial_quantity::numeric - pb.remaining_quantity::numeric)) -
            (pb.capital_cost::numeric * (pb.initial_quantity::numeric - pb.remaining_quantity::numeric))
          )
          ELSE 0 
        END as total_profit
      FROM ${productBatches} pb
      JOIN ${products} p ON pb.product_id = p.id
      LEFT JOIN product_delivery_stats pds ON pds.product_id = p.id
      WHERE pb.store_id = ${storeId} ${productFilter}
      ORDER BY 
        CASE WHEN ${productId ? true : false} THEN pb.purchase_date ELSE p.name END,
        CASE WHEN ${productId ? true : false} THEN NULL ELSE p.name END,
        pb.purchase_date DESC
    `);

    return result.map(row => ({
      productId: row.product_id,
      productName: row.product_name,
      batchNumber: row.batch_number,
      capitalCost: parseFloat(row.capital_cost || '0'),
      avgSellingPrice: parseFloat(row.avg_selling_price || '0'),
      profitMargin: parseFloat(row.profit_margin || '0'),
      soldQuantity: parseFloat(row.sold_quantity || '0'),
      totalProfit: parseFloat(row.total_profit || '0'),
      purchaseDate: new Date(row.purchase_date)
    }));
  }

  async getDeliveryProfitSummary(storeId: number, startDate?: Date, endDate?: Date): Promise<DeliveryProfitSummary> {
    // Default to last 30 days if not specified
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as delivery_count,
        COALESCE((
          SELECT SUM(ii.unit_price::numeric * dni.delivered_quantity::numeric)
          FROM delivery_note_items dni
          JOIN invoice_items ii ON dni.invoice_item_id = ii.id
          JOIN delivery_notes dn2 ON dni.delivery_note_id = dn2.id
          WHERE dn2.store_id = ${storeId}
            AND dn2.status = 'delivered'
            AND dn2.delivery_date >= ${start.toISOString().split('T')[0]}
            AND dn2.delivery_date <= ${end.toISOString().split('T')[0]}
        ), 0) as total_revenue,
        COALESCE(SUM(total_cost::numeric), 0) as total_cost,
        COALESCE(SUM(profit::numeric), 0) as total_profit
      FROM ${deliveryNotes} dn
      WHERE dn.store_id = ${storeId}
        AND dn.status = 'delivered'
        AND dn.delivery_date >= ${start.toISOString().split('T')[0]}
        AND dn.delivery_date <= ${end.toISOString().split('T')[0]}
    `);

    const summary = result[0] || { delivery_count: 0, total_revenue: 0, total_cost: 0, total_profit: 0 };
    const totalRevenue = parseFloat(summary.total_revenue?.toString() || '0');
    const totalCost = parseFloat(summary.total_cost?.toString() || '0');
    const totalProfit = parseFloat(summary.total_profit?.toString() || '0');
    
    // Get profit by period (daily for last 30 days)
    const periodResult = await db.execute(sql`
      SELECT 
        dn.delivery_date as period,
        COALESCE(SUM(
          (SELECT SUM(ii.unit_price::numeric * dni.delivered_quantity::numeric)
           FROM delivery_note_items dni
           JOIN invoice_items ii ON dni.invoice_item_id = ii.id
           WHERE dni.delivery_note_id = dn.id)
        ), 0) as revenue,
        COALESCE(SUM(dn.total_cost::numeric), 0) as cost,
        COALESCE(SUM(dn.profit::numeric), 0) as profit
      FROM ${deliveryNotes} dn
      WHERE dn.store_id = ${storeId}
        AND dn.status = 'delivered'
        AND dn.delivery_date >= ${start.toISOString().split('T')[0]}
        AND dn.delivery_date <= ${end.toISOString().split('T')[0]}
      GROUP BY dn.delivery_date
      ORDER BY dn.delivery_date
    `);

    return {
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      deliveryCount: parseInt(summary.delivery_count?.toString() || '0'),
      byPeriod: periodResult.map((row: any) => ({
        period: row.period,
        revenue: parseFloat(row.revenue?.toString() || '0'),
        cost: parseFloat(row.cost?.toString() || '0'),
        profit: parseFloat(row.profit?.toString() || '0')
      }))
    };
  }

  async getProfitOverview(storeId: number, startDate?: Date, endDate?: Date): Promise<ProfitOverview> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get realized profit from delivered delivery notes
    const realizedResult = await db.execute(sql`
      SELECT 
        COUNT(*) as delivered_count,
        COALESCE(SUM(
          (SELECT SUM(ii.unit_price::numeric * dni.delivered_quantity::numeric)
           FROM delivery_note_items dni
           JOIN invoice_items ii ON dni.invoice_item_id = ii.id
           WHERE dni.delivery_note_id = dn.id)
        ), 0) as realized_revenue,
        COALESCE(SUM(total_cost::numeric), 0) as realized_cost,
        COALESCE(SUM(profit::numeric), 0) as realized_profit
      FROM ${sql.identifier('delivery_notes')} dn
      WHERE dn.store_id = ${storeId}
        AND dn.status = 'delivered'
        AND dn.delivery_date >= ${start.toISOString().split('T')[0]}
        AND dn.delivery_date <= ${end.toISOString().split('T')[0]}
    `);

    const realized = realizedResult[0] || {};
    const realizedRevenue = parseFloat(realized.realized_revenue?.toString() || '0');
    const realizedCost = parseFloat(realized.realized_cost?.toString() || '0');
    const realizedProfit = parseFloat(realized.realized_profit?.toString() || '0');
    const deliveredCount = parseInt(realized.delivered_count?.toString() || '0');

    // Get projected profit from invoices with pending delivery notes
    // Use FIFO-based cost simulation for accurate projection
    
    // Step 1: Get pending items (invoice items not fully delivered) using CTE
    const pendingItemsResult = await db.execute(sql`
      WITH all_items AS (
        SELECT 
          ii.id as invoice_item_id,
          ii.unit_price,
          ii.product_id,
          ii.base_quantity::numeric - COALESCE(
            (SELECT SUM(dni.delivered_quantity::numeric) 
             FROM delivery_note_items dni
             JOIN delivery_notes dn ON dni.delivery_note_id = dn.id
             WHERE dni.invoice_item_id = ii.id AND dn.status = 'delivered'),
            0
          ) as pending_qty
        FROM invoice_items ii
        JOIN invoices inv ON ii.invoice_id = inv.id
        WHERE inv.store_id = ${storeId}
          AND inv.status NOT IN ('cancelled', 'void')
          AND inv.issue_date >= ${start.toISOString().split('T')[0]}
          AND inv.issue_date <= ${end.toISOString().split('T')[0]}
      )
      SELECT * FROM all_items WHERE pending_qty > 0
      ORDER BY invoice_item_id
    `);

    // Step 2: Get available batches for FIFO simulation (ordered by purchase date, filtered by store)
    const batchesResult = await db.execute(sql`
      SELECT 
        pb.id,
        pb.product_id,
        pb.remaining_quantity::numeric as remaining_qty,
        pb.capital_cost::numeric as unit_cost,
        pb.purchase_date
      FROM product_batches pb
      JOIN products p ON pb.product_id = p.id
      WHERE pb.remaining_quantity > 0
        AND pb.store_id = ${storeId}
      ORDER BY pb.product_id, pb.purchase_date ASC
    `);

    // Step 3: Simulate FIFO allocation for projected cost
    type PendingItem = { invoice_item_id: number; unit_price: string; product_id: number; pending_qty: string };
    type BatchInfo = { id: number; product_id: number; remaining_qty: string; unit_cost: string; purchase_date: string };
    
    const pendingItems = pendingItemsResult as PendingItem[];
    const batches = batchesResult as BatchInfo[];
    
    // Group batches by product for FIFO simulation
    const batchesByProduct = new Map<number, { remainingQty: number; unitCost: number }[]>();
    for (const batch of batches) {
      const productId = batch.product_id;
      if (!batchesByProduct.has(productId)) {
        batchesByProduct.set(productId, []);
      }
      batchesByProduct.get(productId)!.push({
        remainingQty: parseFloat(batch.remaining_qty),
        unitCost: parseFloat(batch.unit_cost)
      });
    }

    let projectedRevenue = 0;
    let projectedCost = 0;
    let pendingCount = 0;

    for (const item of pendingItems) {
      const pendingQty = parseFloat(item.pending_qty);
      const unitPrice = parseFloat(item.unit_price);
      const productId = item.product_id;
      
      projectedRevenue += pendingQty * unitPrice;
      pendingCount++;

      // FIFO cost allocation simulation
      let remainingToAllocate = pendingQty;
      const productBatches = batchesByProduct.get(productId) || [];
      
      for (const batch of productBatches) {
        if (remainingToAllocate <= 0) break;
        if (batch.remainingQty <= 0) continue;

        const allocateQty = Math.min(remainingToAllocate, batch.remainingQty);
        projectedCost += allocateQty * batch.unitCost;
        batch.remainingQty -= allocateQty;
        remainingToAllocate -= allocateQty;
      }
      
      // If not enough batch stock, remaining items have zero cost (or could use last known cost)
      // For now, we assume zero cost for out-of-stock projections
    }

    const projectedProfit = projectedRevenue - projectedCost;

    const totalExpectedProfit = realizedProfit + projectedProfit;
    const totalRevenue = realizedRevenue + projectedRevenue;
    const averageMargin = totalRevenue > 0 ? (totalExpectedProfit / totalRevenue) * 100 : 0;

    return {
      realizedProfit,
      realizedRevenue,
      realizedCost,
      projectedProfit,
      projectedRevenue,
      projectedCost,
      totalExpectedProfit,
      averageMargin,
      deliveredCount,
      pendingCount
    };
  }

  // Preview number generation methods
  async getNextClientNumber(): Promise<string> {
    try {
      return withTransaction(async (tx) => {
        return await generateSimpleSequentialNumber("C", clients, clients.clientNumber, tx);
      });
    } catch (error) {
      console.error('Error in getNextClientNumber:', error);
      throw error;
    }
  }

  async getNextSupplierNumber(): Promise<string> {
    try {
      return withTransaction(async (tx) => {
        return await generateSimpleSequentialNumber("S", suppliers, suppliers.supplierNumber, tx);
      });
    } catch (error) {
      console.error('Error in getNextSupplierNumber:', error);
      throw error;
    }
  }

  async getNextInvoiceNumber(issueDate: Date = new Date()): Promise<string> {
    try {
      const year = issueDate.getFullYear().toString().slice(-2);
      const month = (issueDate.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = year + month;

      console.log('Generating invoice number for yearMonth:', yearMonth);

      return withTransaction(async (tx) => {
        return await generateNextNumber("INV", yearMonth, invoices, invoices.invoiceNumber, tx);
      });
    } catch (error) {
      console.error('Error in getNextInvoiceNumber:', error);
      throw error;
    }
  }

  async getNextQuotationNumber(): Promise<string> {
    try {
      const currentDate = new Date();
      const year = currentDate.getFullYear().toString().slice(-2);
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = year + month;

      console.log('Generating quotation number for yearMonth:', yearMonth);

      return withTransaction(async (tx) => {
        return await generateNextNumber("QUO", yearMonth, quotations, quotations.quotationNumber, tx);
      });
    } catch (error) {
      console.error('Error in getNextQuotationNumber:', error);
      throw error;
    }
  }

  async getNextPurchaseOrderNumber(orderDate?: Date): Promise<string> {
    try {
      const currentDate = orderDate || new Date();
      const year = currentDate.getFullYear().toString().slice(-2);
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = year + month;

      console.log('Generating purchase order number for yearMonth:', yearMonth);

      return withTransaction(async (tx) => {
        return await generateNextNumber("PO", yearMonth, purchaseOrders, purchaseOrders.purchaseOrderNumber, tx);
      });
    } catch (error) {
      console.error('Error in getNextPurchaseOrderNumber:', error);
      throw error;
    }
  }

  // Returns/Credit Note methods
  async getReturn(id: number): Promise<Return | undefined> {
    const [result] = await db.select().from(returns).where(eq(returns.id, id));
    return result;
  }

  async getReturnWithItems(id: number): Promise<{ return: Return, items: (ReturnItem & { invoiceItem: InvoiceItem & { product: Product } })[], usages: CreditNoteUsage[], invoice: Invoice, client: Client } | undefined> {
    const [returnData] = await db.select().from(returns).where(eq(returns.id, id));
    if (!returnData) return undefined;

    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, returnData.invoiceId));
    if (!invoice) return undefined;

    const [client] = await db.select().from(clients).where(eq(clients.id, returnData.clientId));
    if (!client) return undefined;

    const rawItems = await db
      .select()
      .from(returnItems)
      .innerJoin(invoiceItems, eq(returnItems.invoiceItemId, invoiceItems.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(returnItems.returnId, id));

    const items = rawItems.map(row => ({
      ...row.return_items,
      invoiceItem: {
        ...row.invoice_items,
        product: row.products
      }
    }));

    const usages = await db.select().from(creditNoteUsages).where(eq(creditNoteUsages.returnId, id)).orderBy(desc(creditNoteUsages.usedAt));

    return { return: returnData, items, usages, invoice, client };
  }

  async getReturnsByInvoiceId(invoiceId: number): Promise<(Return & { items: (ReturnItem & { productName: string })[] })[]> {
    const returnsList = await db
      .select()
      .from(returns)
      .where(eq(returns.invoiceId, invoiceId))
      .orderBy(desc(returns.returnDate));

    const result = await Promise.all(returnsList.map(async (ret) => {
      const rawItems = await db
        .select()
        .from(returnItems)
        .innerJoin(invoiceItems, eq(returnItems.invoiceItemId, invoiceItems.id))
        .innerJoin(products, eq(invoiceItems.productId, products.id))
        .where(eq(returnItems.returnId, ret.id));

      const items = rawItems.map(row => ({
        ...row.return_items,
        productName: row.products.name,
      }));

      return { ...ret, items };
    }));

    return result;
  }

  async getReturns(storeId: number): Promise<Return[]> {
    return db.select().from(returns).where(eq(returns.storeId, storeId)).orderBy(desc(returns.returnDate));
  }

  async getReturnsWithDetails(storeId: number): Promise<(Return & { invoice: Invoice, client: Client })[]> {
    const results = await db
      .select()
      .from(returns)
      .innerJoin(invoices, eq(returns.invoiceId, invoices.id))
      .innerJoin(clients, eq(returns.clientId, clients.id))
      .where(eq(returns.storeId, storeId))
      .orderBy(desc(returns.returnDate));

    return results.map(row => ({
      ...row.returns,
      invoice: row.invoices,
      client: row.clients
    }));
  }

  async getClientCreditNotes(clientId: number): Promise<(Return & { remainingBalance: number })[]> {
    // Credit notes with 'pending' status have available balance
    // 'completed' status means fully used, so we filter for 'pending'
    const creditNotes = await db
      .select()
      .from(returns)
      .where(and(
        eq(returns.clientId, clientId),
        eq(returns.returnType, 'credit_note'),
        eq(returns.status, 'pending')
      ))
      .orderBy(desc(returns.returnDate));

    return creditNotes.map(cn => ({
      ...cn,
      remainingBalance: Number(cn.totalAmount) - Number(cn.usedAmount)
    })).filter(cn => cn.remainingBalance > 0);
  }

  async createReturn(returnData: InsertReturn, items: InsertReturnItem[]): Promise<Return> {
    return withTransaction(async (tx) => {
      const [newReturn] = await tx.insert(returns).values(returnData).returning();
      
      if (items.length > 0) {
        await tx.insert(returnItems).values(
          items.map(item => ({
            ...item,
            returnId: newReturn.id
          }))
        );
      }

      // If return is completed (e.g., refund type), create batches for returned items
      if (returnData.status === 'completed') {
        await this.createBatchesForReturn(tx, newReturn, items);

        if (returnData.returnType === 'refund' || returnData.returnType === 'immediate_refund') {
          await tx.insert(transactions).values({
            storeId: newReturn.storeId,
            type: 'expense',
            amount: newReturn.totalAmount.toString(),
            description: `Refund Retur ${newReturn.returnNumber}`,
            date: new Date().toISOString().split('T')[0],
            returnId: newReturn.id
          });
        }
      }

      return newReturn;
    });
  }

  private async createBatchesForReturn(tx: any, returnRecord: Return, items: InsertReturnItem[]): Promise<void> {
    // Get the invoice to determine store
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, returnRecord.invoiceId));
    if (!invoice) return;

    // Get delivered quantities per invoiceItem for this invoice (only from delivered delivery notes)
    const deliveredRows = await tx
      .select({
        invoiceItemId: deliveryNoteItems.invoiceItemId,
        total: sql<string>`SUM(${deliveryNoteItems.deliveredQuantity})`
      })
      .from(deliveryNoteItems)
      .innerJoin(deliveryNotes, eq(deliveryNoteItems.deliveryNoteId, deliveryNotes.id))
      .where(
        and(
          eq(deliveryNotes.invoiceId, returnRecord.invoiceId),
          eq(deliveryNotes.status, 'delivered')
        )
      )
      .groupBy(deliveryNoteItems.invoiceItemId);

    const deliveredQtyMap = new Map<number, number>(
      deliveredRows.map((r: any) => [r.invoiceItemId, parseFloat(r.total || '0')])
    );

    for (const item of items) {
      // Get the invoice item to get product info
      const [invoiceItem] = await tx.select().from(invoiceItems).where(eq(invoiceItems.id, item.invoiceItemId));
      if (!invoiceItem) continue;

      // How many units of this item have actually left the warehouse
      const deliveredQty = deliveredQtyMap.get(item.invoiceItemId) ?? 0;
      const returnQty = parseFloat(item.quantity.toString());

      // Only the portion that was actually shipped goes back to stock
      const qtyToStock = Math.min(returnQty, deliveredQty);
      if (qtyToStock <= 0) continue; // Nothing to put back in stock

      // Convert to base unit if a unit conversion ratio exists
      let baseQtyToStock = qtyToStock;
      if (invoiceItem.baseQuantity && invoiceItem.quantity) {
        const ratio = parseFloat(invoiceItem.baseQuantity.toString()) / parseFloat(invoiceItem.quantity.toString());
        baseQtyToStock = qtyToStock * ratio;
      }

      // Get the unit cost from the most recent batch for this product (capitalCost field)
      let returnCost = 0;
      
      const existingBatches = await tx
        .select()
        .from(productBatches)
        .where(
          and(
            eq(productBatches.productId, invoiceItem.productId),
            eq(productBatches.storeId, invoice.storeId)
          )
        )
        .orderBy(desc(productBatches.purchaseDate))
        .limit(1);
      
      if (existingBatches.length > 0) {
        returnCost = parseFloat(existingBatches[0].capitalCost?.toString() || '0');
      }

      // Create a new batch only for the delivered portion being returned
      const batchNumber = returnRecord.returnNumber;
      await tx.insert(productBatches).values({
        productId: invoiceItem.productId,
        storeId: invoice.storeId,
        batchNumber,
        capitalCost: returnCost.toString(),
        initialQuantity: baseQtyToStock.toString(),
        remainingQuantity: baseQtyToStock.toString(),
        reservedQuantity: '0',
        purchaseDate: returnRecord.returnDate,
        notes: `Return dari ${returnRecord.returnNumber}`,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  async updateReturn(id: number, returnData: Partial<InsertReturn>, items?: InsertReturnItem[]): Promise<Return> {
    return withTransaction(async (tx) => {
      // Check if return has usages - if so, only allow updating notes
      const [existingReturn] = await tx.select().from(returns).where(eq(returns.id, id));
      if (!existingReturn) {
        throw new Error("Return not found");
      }
      
      const hasUsages = parseFloat(existingReturn.usedAmount || '0') > 0;
      
      if (hasUsages) {
        // Only allow updating notes if there are usages
        const [updated] = await tx
          .update(returns)
          .set({ notes: returnData.notes, updatedAt: new Date() })
          .where(eq(returns.id, id))
          .returning();
        return updated;
      }
      
      // Full update allowed if no usages
      const [updated] = await tx
        .update(returns)
        .set({ ...returnData, updatedAt: new Date() })
        .where(eq(returns.id, id))
        .returning();
      
      // Update items if provided
      if (items && items.length > 0) {
        await tx.delete(returnItems).where(eq(returnItems.returnId, id));
        await tx.insert(returnItems).values(
          items.map(item => ({
            ...item,
            returnId: id
          }))
        );
        
        // Recalculate total amount
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.subtotal as string), 0);
        await tx.update(returns).set({ totalAmount: totalAmount.toString() }).where(eq(returns.id, id));
      }
      
      const [finalReturn] = await tx.select().from(returns).where(eq(returns.id, id));
      return finalReturn;
    });
  }

  async updateReturnStatus(id: number, status: string): Promise<Return> {
    return withTransaction(async (tx) => {
      // Get return before update to check previous status
      const [existingReturn] = await tx.select().from(returns).where(eq(returns.id, id));
      const previousStatus = existingReturn?.status;

      const [updated] = await tx
        .update(returns)
        .set({ status: status as "pending" | "completed" | "cancelled", updatedAt: new Date() })
        .where(eq(returns.id, id))
        .returning();

      // If status changed to 'completed' from non-completed, create batches for returned items
      if (status === 'completed' && previousStatus !== 'completed' && existingReturn) {
        const items = await tx.select().from(returnItems).where(eq(returnItems.returnId, id));
        await this.createBatchesForReturn(tx, updated, items);

        if (existingReturn.returnType === 'refund' || existingReturn.returnType === 'immediate_refund') {
          await tx.insert(transactions).values({
            storeId: existingReturn.storeId,
            type: 'expense',
            amount: existingReturn.totalAmount.toString(),
            description: `Refund Retur ${existingReturn.returnNumber}`,
            date: new Date().toISOString().split('T')[0],
            returnId: existingReturn.id
          });
        }
      }

      if (previousStatus === 'completed' && status !== 'completed' && existingReturn) {
        await tx.delete(transactions).where(eq(transactions.returnId, id));

        if (existingReturn.returnNumber) {
          await tx.delete(productBatches).where(
            eq(productBatches.batchNumber, existingReturn.returnNumber)
          );
        }
      }

      return updated;
    });
  }

  async deleteReturn(id: number): Promise<void> {
    await withTransaction(async (tx) => {
      const [existingReturn] = await tx.select().from(returns).where(eq(returns.id, id));
      if (!existingReturn) return;

      if (parseFloat(existingReturn.usedAmount || '0') > 0) {
        throw new Error("Cannot delete return with existing usages");
      }

      await tx.delete(transactions).where(eq(transactions.returnId, id));

      if (existingReturn.status === 'completed' && existingReturn.returnNumber) {
        await tx.delete(productBatches).where(
          eq(productBatches.batchNumber, existingReturn.returnNumber)
        );
      }

      await tx.delete(returnItems).where(eq(returnItems.returnId, id));
      await tx.delete(creditNoteUsages).where(eq(creditNoteUsages.returnId, id));
      await tx.delete(returns).where(eq(returns.id, id));
    });
  }

  async getNextReturnNumber(returnDate?: Date): Promise<string> {
    try {
      const currentDate = returnDate || new Date();
      const year = currentDate.getFullYear().toString().slice(-2);
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const yearMonth = year + month;

      return withTransaction(async (tx) => {
        return await generateNextNumber("RTN", yearMonth, returns, returns.returnNumber, tx);
      });
    } catch (error) {
      console.error('Error in getNextReturnNumber:', error);
      throw error;
    }
  }

  // Credit Note Usage methods
  async getCreditNoteUsages(returnId: number): Promise<CreditNoteUsage[]> {
    return db.select().from(creditNoteUsages).where(eq(creditNoteUsages.returnId, returnId)).orderBy(desc(creditNoteUsages.usedAt));
  }

  async createCreditNoteUsage(usage: InsertCreditNoteUsage): Promise<CreditNoteUsage> {
    const [newUsage] = await db.insert(creditNoteUsages).values(usage).returning();
    return newUsage;
  }

  async applyCreditNoteToPayment(returnId: number, invoicePaymentId: number, amount: number): Promise<CreditNoteUsage> {
    return withTransaction(async (tx) => {
      // Create the usage record
      const [usage] = await tx.insert(creditNoteUsages).values({
        returnId,
        invoicePaymentId,
        amount: amount.toString(),
        usageType: 'payment',
        notes: 'Applied to invoice payment'
      }).returning();

      // Update the return's used amount
      await tx
        .update(returns)
        .set({ 
          usedAmount: sql`${returns.usedAmount} + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(returns.id, returnId));

      // Check if credit note is fully used and auto-complete it
      const [updated] = await tx.select().from(returns).where(eq(returns.id, returnId));
      if (updated && parseFloat(updated.usedAmount || '0') >= parseFloat(updated.totalAmount || '0')) {
        await tx.update(returns).set({ status: 'completed', updatedAt: new Date() }).where(eq(returns.id, returnId));
      }

      return usage;
    });
  }

  async convertCreditNoteToRefund(returnId: number, amount: number): Promise<CreditNoteUsage> {
    return withTransaction(async (tx) => {
      // Create the usage record for refund conversion
      const [usage] = await tx.insert(creditNoteUsages).values({
        returnId,
        invoicePaymentId: null,
        amount: amount.toString(),
        usageType: 'refund',
        notes: 'Converted to cash refund'
      }).returning();

      // Update the return's used amount
      await tx
        .update(returns)
        .set({ 
          usedAmount: sql`${returns.usedAmount} + ${amount}`,
          updatedAt: new Date()
        })
        .where(eq(returns.id, returnId));

      // Check if credit note is fully used and auto-complete it
      const [updated] = await tx.select().from(returns).where(eq(returns.id, returnId));
      if (updated && parseFloat(updated.usedAmount || '0') >= parseFloat(updated.totalAmount || '0')) {
        await tx.update(returns).set({ status: 'completed', updatedAt: new Date() }).where(eq(returns.id, returnId));
      }

      // Record expense transaction for cash refund
      const [returnRecord] = await tx.select().from(returns).where(eq(returns.id, returnId));
      if (returnRecord) {
        await tx.insert(transactions).values({
          storeId: returnRecord.storeId,
          type: 'expense',
          amount: amount.toString(),
          description: `Refund Credit Note ${returnRecord.returnNumber}`,
          date: new Date().toISOString().split('T')[0],
          returnId: returnRecord.id
        });
      }

      return usage;
    });
  }

  async getClientDeposits(clientId: number): Promise<ClientDeposit[]> {
    return db
      .select()
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId))
      .orderBy(desc(clientDeposits.createdAt));
  }

  async getClientDepositBalance(clientId: number): Promise<number> {
    const deposits = await db
      .select({ amount: clientDeposits.amount, type: clientDeposits.type })
      .from(clientDeposits)
      .where(eq(clientDeposits.clientId, clientId));
    
    return deposits.reduce((balance, d) => {
      const amt = parseFloat(d.amount || '0');
      return d.type === 'deposit' ? balance + amt : balance - amt;
    }, 0);
  }

  async createClientDeposit(deposit: InsertClientDeposit): Promise<ClientDeposit> {
    const [created] = await db.insert(clientDeposits).values(deposit).returning();
    return created;
  }

  async deleteClientDepositByPaymentId(invoicePaymentId: number): Promise<void> {
    await db.delete(clientDeposits).where(eq(clientDeposits.invoicePaymentId, invoicePaymentId));
  }

  async createActivityLog(data: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(data).returning();
    return created;
  }

  async getActivityLogs(filters: { storeId: number; userId?: number; action?: string; entity?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number }): Promise<{ logs: ActivityLog[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(activityLogs.storeId, filters.storeId)];
    if (filters?.userId) conditions.push(eq(activityLogs.userId, filters.userId));
    if (filters?.action) conditions.push(eq(activityLogs.action, filters.action));
    if (filters?.entity) conditions.push(eq(activityLogs.entity, filters.entity));
    if (filters?.dateFrom) conditions.push(gte(activityLogs.createdAt, new Date(filters.dateFrom)));
    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(activityLogs.createdAt, toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, [countResult]] = await Promise.all([
      db.select().from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(activityLogs).where(whereClause)
    ]);

    return { logs, total: Number(countResult?.count || 0) };
  }
}

// Create and export the storage instance
export const storage = new DatabaseStorage();