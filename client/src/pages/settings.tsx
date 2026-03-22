import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, User, Building, CreditCard, Upload, Save, Check, Database, Download, FolderPlus, FolderEdit, FolderMinus, FolderOpen, Plus, Edit, Trash2, FileText, Wallet, ArrowLeftRight, Users, Star, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserManagement } from "@/components/user-management";
import { StoreManagement } from "@/components/store-management";
import { RoleManagement } from "@/components/role-management";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { UploadResult } from "@uppy/core";
import { useStore } from '@/lib/store-context';
import type { PrintSettings } from "@shared/schema";

// Profile settings schema
const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  companyName: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

// Company settings schema
const companySchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyTagline: z.string().optional(),
  companyAddress: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  taxNumber: z.string().optional(),
  defaultTaxRate: z.string().optional(),
  logoUrl: z.string().optional(),
  quotationNotes: z.string().optional(),
  invoiceNotes: z.string().optional(),
  deliveryNoteNotes: z.string().optional(),
  defaultNotes: z.string().optional(),
});

// Notes settings schema (per branch)
const notesSchema = z.object({
  quotationNotes: z.string().optional(),
  invoiceNotes: z.string().optional(),
  deliveryNoteNotes: z.string().optional(),
});
type NotesFormValues = z.infer<typeof notesSchema>;

// Payment settings schema
const paymentSchema = z.object({
  accountName: z.string().min(2, "Account name is required"),
  accountNumber: z.string().min(2, "Account number is required"),
  bank: z.string().min(2, "Bank name is required"),
  routingNumber: z.string().optional(),
  swiftCode: z.string().optional(),
  paypalEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
});

// Security settings schema
const securitySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Payment type schema
const paymentTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  cashAccountId: z.number().nullable().optional(),
  deductionPercentage: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  storeId: z.number().default(1)
});

// Payment term schema
const paymentTermSchema = z.object({
  name: z.string().min(1, "Name is required"),
  days: z.number().min(0, "Days must be 0 or greater"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  storeId: z.number().default(1)
});

// Category schema
const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
});

// Inflow category schema
const inflowCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  storeId: z.number().default(1),
  isActive: z.boolean().default(true),
});

// Outflow category schema
const outflowCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  storeId: z.number().default(1),
  isActive: z.boolean().default(true),
});

// Cash account schema
const cashAccountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  accountType: z.enum(["cash", "bank_company", "bank_personal", "other"]).default("cash"),
  initialBalance: z.string().default("0"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  storeId: z.number().default(1)
});

// Account transfer schema
const accountTransferSchema = z.object({
  fromAccountId: z.number().min(1, "Source account is required"),
  toAccountId: z.number().min(1, "Destination account is required"),
  amount: z.string().min(1, "Amount is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  reference: z.string().optional(),
  storeId: z.number().default(1)
});

type CategoryFormData = z.infer<typeof categorySchema>;
type Category = { id: number; name: string; description: string | null };

type InflowCategoryFormData = z.infer<typeof inflowCategorySchema>;
type InflowCategory = { id: number; storeId: number; name: string; description: string | null; isActive: boolean };

type OutflowCategoryFormData = z.infer<typeof outflowCategorySchema>;
type OutflowCategory = { id: number; storeId: number; name: string; description: string | null; isActive: boolean };

type CashAccountFormData = z.infer<typeof cashAccountSchema>;
type CashAccountWithBalance = { 
  id: number; 
  name: string; 
  accountType: string; 
  initialBalance: string;
  description: string | null;
  isActive: boolean;
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalTransfersIn: number;
  totalTransfersOut: number;
};

type AccountTransferFormData = z.infer<typeof accountTransferSchema>;
type AccountTransfer = {
  id: number;
  fromAccountId: number;
  toAccountId: number;
  amount: string;
  date: string;
  notes: string | null;
  reference: string | null;
};

type ProfileFormValues = z.infer<typeof profileSchema>;
type CompanyFormValues = z.infer<typeof companySchema>;
type PaymentFormValues = z.infer<typeof paymentSchema>;
type SecurityFormValues = z.infer<typeof securitySchema>;
type PaymentTypeFormData = z.infer<typeof paymentTypeSchema>;
type PaymentTermFormData = z.infer<typeof paymentTermSchema>;

type Store = {
  id: number;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  defaultTaxRate: string | null;
  npwp: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  logoUrl: string | null;
  quotationNotes: string | null;
  invoiceNotes: string | null;
  deliveryNoteNotes: string | null;
  defaultNotes: string | null;
  invoicePaymentCategoryId: number | null;
  goodsReceiptPaymentCategoryId: number | null;
  defaultPaymentTypeId: number | null;
  defaultPaymentTermId: number | null;
};

type UserData = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
};

type PaymentType = {
  id: number;
  storeId: number;
  name: string;
  description: string | null;
  cashAccountId: number | null;
  deductionPercentage: string | null;
  isActive: boolean;
};

type PaymentTerm = {
  id: number;
  storeId: number;
  code: string;
  name: string;
  days: number;
  description: string | null;
  isActive: boolean;
};

function AutoTransactionSettings() {
  const { currentStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: store } = useQuery<Store>({
    queryKey: [`/api/stores/${currentStoreId}`],
  });

  const { data: inflowCategories } = useQuery<InflowCategory[]>({
    queryKey: [`/api/stores/${currentStoreId}/inflow-categories`],
  });

  const { data: outflowCategories } = useQuery<OutflowCategory[]>({
    queryKey: [`/api/stores/${currentStoreId}/outflow-categories`],
  });

  const [invoicePaymentCategoryId, setInvoicePaymentCategoryId] = useState<number | null>(null);
  const [goodsReceiptPaymentCategoryId, setGoodsReceiptPaymentCategoryId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setInvoicePaymentCategoryId(store.invoicePaymentCategoryId);
      setGoodsReceiptPaymentCategoryId(store.goodsReceiptPaymentCategoryId);
    } else {
      setInvoicePaymentCategoryId(null);
      setGoodsReceiptPaymentCategoryId(null);
    }
  }, [store, currentStoreId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiRequest('PUT', `/api/stores/${currentStoreId}`, {
        invoicePaymentCategoryId,
        goodsReceiptPaymentCategoryId
      });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}`] });
      toast({
        title: "Berhasil",
        description: "Pengaturan auto transaction berhasil disimpan",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan pengaturan",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto Transaction Settings</CardTitle>
        <CardDescription>
          Pengaturan untuk membuat transaksi otomatis saat menerima pembayaran invoice atau melakukan pembayaran ke supplier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoicePaymentCategory">
              Kategori untuk Pembayaran Invoice (Inflow)
            </Label>
            <p className="text-sm text-muted-foreground">
              Setiap pembayaran invoice dari customer akan otomatis tercatat sebagai transaksi dengan kategori ini
            </p>
            <select
              id="invoicePaymentCategory"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={invoicePaymentCategoryId || ""}
              onChange={(e) => setInvoicePaymentCategoryId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">-- Tidak aktif --</option>
              {inflowCategories?.filter(c => c.isActive).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="goodsReceiptPaymentCategory">
              Kategori untuk Pembayaran Supplier (Outflow)
            </Label>
            <p className="text-sm text-muted-foreground">
              Setiap pembayaran ke supplier (Goods Receipt) akan otomatis tercatat sebagai transaksi dengan kategori ini
            </p>
            <select
              id="goodsReceiptPaymentCategory"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={goodsReceiptPaymentCategoryId || ""}
              onChange={(e) => setGoodsReceiptPaymentCategoryId(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">-- Tidak aktif --</option>
              {outflowCategories?.filter(c => c.isActive).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { currentStoreId } = useStore();

  const [activeTab, setActiveTab] = useState("company");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isInflowCategoryDialogOpen, setIsInflowCategoryDialogOpen] = useState(false);
  const [editingInflowCategory, setEditingInflowCategory] = useState<InflowCategory | null>(null);
  const [deletingInflowCategory, setDeletingInflowCategory] = useState<InflowCategory | null>(null);
  const [isOutflowCategoryDialogOpen, setIsOutflowCategoryDialogOpen] = useState(false);
  const [editingOutflowCategory, setEditingOutflowCategory] = useState<OutflowCategory | null>(null);
  const [deletingOutflowCategory, setDeletingOutflowCategory] = useState<OutflowCategory | null>(null);
  const [editingCashAccount, setEditingCashAccount] = useState<CashAccountWithBalance | null>(null);
  const [deletingCashAccount, setDeletingCashAccount] = useState<CashAccountWithBalance | null>(null);
  const [cashAccountDialogOpen, setCashAccountDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [deletingTransfer, setDeletingTransfer] = useState<AccountTransfer | null>(null);
  const [returnWindowDays, setReturnWindowDays] = useState<string>("30");
  const [requirePaymentBeforePrint, setRequirePaymentBeforePrint] = useState<boolean>(false);
  const [lockPaidInvoices, setLockPaidInvoices] = useState<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasInitialized = useRef(false);

  // Fetch user data
  const { data: userData, isLoading } = useQuery<UserData>({
    queryKey: ['/api/user'],
  });

  // Fetch store data for defaults
  const { data: storeData } = useQuery<Store>({
    queryKey: [`/api/stores/${currentStoreId}`],
  });

  // Fetch payment types and terms
  const { data: paymentTypes } = useQuery<PaymentType[]>({
    queryKey: [`/api/stores/${currentStoreId}/payment-types`],
  });

  const { data: paymentTerms } = useQuery<PaymentTerm[]>({
    queryKey: [`/api/stores/${currentStoreId}/payment-terms`],
  });

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  // Fetch inflow categories
  const { data: inflowCategories, isLoading: inflowCategoriesLoading } = useQuery<InflowCategory[]>({
    queryKey: [`/api/stores/${currentStoreId}/inflow-categories`],
  });

  // Fetch outflow categories
  const { data: outflowCategories, isLoading: outflowCategoriesLoading } = useQuery<OutflowCategory[]>({
    queryKey: [`/api/stores/${currentStoreId}/outflow-categories`],
  });

  // Fetch cash accounts
  const { data: cashAccounts, isLoading: cashAccountsLoading } = useQuery<CashAccountWithBalance[]>({
    queryKey: [`/api/stores/${currentStoreId}/cash-accounts`],
    enabled: !!currentStoreId,
  });

  // Fetch account transfers
  const { data: accountTransfers, isLoading: transfersLoading } = useQuery<AccountTransfer[]>({
    queryKey: [`/api/stores/${currentStoreId}/account-transfers`],
    enabled: !!currentStoreId,
  });

  // Fetch store settings (key-value)
  const { data: storeSettings } = useQuery<Record<string, string>>({
    queryKey: [`/api/stores/${currentStoreId}/settings`],
  });

  // Fetch store-specific print settings (for per-branch document notes)
  const { data: storePrintSettings } = useQuery<PrintSettings>({
    queryKey: [`/api/stores/${currentStoreId}/print-settings`],
  });

  // Initialize returnWindowDays and business rules from store settings
  useEffect(() => {
    if (storeSettings) {
      if (storeSettings['return_window_days'] !== undefined) {
        setReturnWindowDays(storeSettings['return_window_days']);
      }
      setRequirePaymentBeforePrint(storeSettings['require_payment_before_delivery_print'] === 'true');
      setLockPaidInvoices(storeSettings['lock_paid_invoices'] === 'true');
    }
  }, [storeSettings]);

  // Fetch global company settings (for login page branding)
  const { data: globalCompanySettings } = useQuery<{ companyName: string; logoUrl: string | null }>({
    queryKey: ['/api/company-settings'],
  });

  // Global company settings state
  const [globalCompanyName, setGlobalCompanyName] = useState("");
  const [globalLogoUrl, setGlobalLogoUrl] = useState("");
  const [isSavingGlobalSettings, setIsSavingGlobalSettings] = useState(false);

  // Profile form setup
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      companyName: "",
      address: "",
      phone: "",
    }
  });

  // Company form setup
  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      companyName: "",
      companyTagline: "",
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      taxNumber: "",
      defaultTaxRate: "11",
      logoUrl: "",
    }
  });

  // Notes form setup (per branch)
  const notesForm = useForm<NotesFormValues>({
    resolver: zodResolver(notesSchema),
    defaultValues: {
      quotationNotes: "",
      invoiceNotes: "",
      deliveryNoteNotes: "",
    }
  });

  useEffect(() => {
    if (storePrintSettings) {
      notesForm.reset({
        quotationNotes: storePrintSettings.quotationNotes || "",
        invoiceNotes: storePrintSettings.invoiceNotes || "",
        deliveryNoteNotes: storePrintSettings.deliveryNoteNotes || "",
      });
    }
  }, [storePrintSettings, currentStoreId]);

  // Payment form setup
  const paymentForm = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      accountName: "",
      accountNumber: "",
      bank: "",
      routingNumber: "",
      swiftCode: "",
      paypalEmail: "",
    }
  });

  // Security form setup
  const securityForm = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }
  });

  // Payment type form setup
  const typeForm = useForm<PaymentTypeFormData>({
    resolver: zodResolver(paymentTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      cashAccountId: null,
      deductionPercentage: null,
      isActive: true,
      storeId: currentStoreId
    }
  });

  // Payment term form setup
  const termForm = useForm<PaymentTermFormData>({
    resolver: zodResolver(paymentTermSchema),
    defaultValues: {
      name: "",
      days: 0,
      description: "",
      isActive: true,
      storeId: currentStoreId
    }
  });

  // Category form setup
  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      description: "",
    }
  });

  const inflowCategoryForm = useForm<InflowCategoryFormData>({
    resolver: zodResolver(inflowCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      storeId: currentStoreId,
      isActive: true,
    }
  });

  const outflowCategoryForm = useForm<OutflowCategoryFormData>({
    resolver: zodResolver(outflowCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      storeId: currentStoreId,
      isActive: true,
    }
  });

  // Cash account form setup
  const cashAccountForm = useForm<CashAccountFormData>({
    resolver: zodResolver(cashAccountSchema),
    defaultValues: {
      name: "",
      accountType: "cash",
      initialBalance: "0",
      description: "",
      isActive: true,
      storeId: currentStoreId
    }
  });

  // Account transfer form setup
  const transferForm = useForm<AccountTransferFormData>({
    resolver: zodResolver(accountTransferSchema),
    defaultValues: {
      fromAccountId: 0,
      toAccountId: 0,
      amount: "",
      date: new Date().toISOString().split('T')[0],
      notes: "",
      reference: "",
      storeId: currentStoreId
    }
  });

  // Update user profile mutation
  const profileMutation = useMutation({
    mutationFn: async (data: Partial<ProfileFormValues>) => {
      return apiRequest('PUT', '/api/user', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update profile: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update company details mutation (now store identity)
  const companyMutation = useMutation({
    mutationFn: async (data: CompanyFormValues) => {
      return apiRequest('PUT', `/api/stores/${currentStoreId}/identity`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}`] });
      toast({
        title: "Store identity updated",
        description: "Branch details have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update store details: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update document notes mutation (per branch)
  const notesMutation = useMutation({
    mutationFn: async (data: NotesFormValues) => {
      return apiRequest('PUT', `/api/stores/${currentStoreId}/print-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/print-settings`] });
      toast({
        title: "Notes saved",
        description: "Document notes updated for this branch.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to save notes: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update payment settings mutation
  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormValues) => {
      return apiRequest('PUT', '/api/user/payment', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Payment settings updated",
        description: "Your payment settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update payment settings: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update password mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: SecurityFormValues) => {
      return apiRequest('PUT', '/api/user/password', data);
    },
    onSuccess: () => {
      securityForm.reset();
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update password: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Payment Type Mutations
  const createTypeMutation = useMutation({
    mutationFn: async (data: PaymentTypeFormData) => {
      return apiRequest('POST', '/api/payment-types', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/payment-types`] });
      toast({ title: "Success", description: "Payment type created successfully" });
      setIsTypeDialogOpen(false);
      typeForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create payment type", variant: "destructive" });
    }
  });

  const updateTypeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentTypeFormData> }) => {
      return apiRequest('PUT', `/api/payment-types/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/payment-types`] });
      toast({ title: "Success", description: "Payment type updated successfully" });
      setIsTypeDialogOpen(false);
      setEditingTypeId(null);
      typeForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update payment type", variant: "destructive" });
    }
  });

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/payment-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/payment-types`] });
      toast({ title: "Success", description: "Payment type deleted successfully" });
      setSelectedTypeId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete payment type", variant: "destructive" });
    }
  });

  // Payment Term Mutations
  const createTermMutation = useMutation({
    mutationFn: async (data: PaymentTermFormData) => {
      return apiRequest('POST', '/api/payment-terms', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/payment-terms`] });
      toast({ title: "Success", description: "Payment term created successfully" });
      setIsTermDialogOpen(false);
      termForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create payment term", variant: "destructive" });
    }
  });

  const updateTermMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentTermFormData> }) => {
      return apiRequest('PUT', `/api/payment-terms/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/payment-terms`] });
      toast({ title: "Success", description: "Payment term updated successfully" });
      setIsTermDialogOpen(false);
      setEditingTermId(null);
      termForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update payment term", variant: "destructive" });
    }
  });

  const deleteTermMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/payment-terms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/payment-terms`] });
      toast({ title: "Success", description: "Payment term deleted successfully" });
      setSelectedTermId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete payment term", variant: "destructive" });
    }
  });

  // Set default payment type/term mutations
  const setDefaultPaymentTypeMutation = useMutation({
    mutationFn: async (paymentTypeId: number | null) => {
      return apiRequest('PUT', `/api/stores/${currentStoreId}`, { defaultPaymentTypeId: paymentTypeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}`] });
      toast({ title: "Success", description: "Default payment type updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update default payment type", variant: "destructive" });
    }
  });

  const setDefaultPaymentTermMutation = useMutation({
    mutationFn: async (paymentTermId: number | null) => {
      return apiRequest('PUT', `/api/stores/${currentStoreId}`, { defaultPaymentTermId: paymentTermId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}`] });
      toast({ title: "Success", description: "Default payment term updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update default payment term", variant: "destructive" });
    }
  });

  // Category mutations
  const categoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number, data: CategoryFormData }) => {
      if (id) {
        return apiRequest('PUT', `/api/categories/${id}`, data);
      } else {
        return apiRequest('POST', '/api/categories', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
      toast({
        title: editingCategory ? "Category updated" : "Category created",
        description: editingCategory 
          ? "The category has been updated successfully." 
          : "The category has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setDeletingCategory(null);
      toast({
        title: "Category deleted",
        description: "The category has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Inflow category mutations
  const inflowCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number, data: InflowCategoryFormData }) => {
      if (id) {
        return apiRequest('PUT', `/api/inflow-categories/${id}`, data);
      } else {
        return apiRequest('POST', '/api/inflow-categories', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/inflow-categories`] });
      setIsInflowCategoryDialogOpen(false);
      setEditingInflowCategory(null);
      inflowCategoryForm.reset();
      toast({
        title: editingInflowCategory ? "Inflow category updated" : "Inflow category created",
        description: editingInflowCategory 
          ? "The inflow category has been updated successfully." 
          : "The inflow category has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteInflowCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/inflow-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/inflow-categories`] });
      setDeletingInflowCategory(null);
      toast({
        title: "Inflow category deleted",
        description: "The inflow category has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Outflow category mutations
  const outflowCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number, data: OutflowCategoryFormData }) => {
      if (id) {
        return apiRequest('PUT', `/api/outflow-categories/${id}`, data);
      } else {
        return apiRequest('POST', '/api/outflow-categories', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/outflow-categories`] });
      setIsOutflowCategoryDialogOpen(false);
      setEditingOutflowCategory(null);
      outflowCategoryForm.reset();
      toast({
        title: editingOutflowCategory ? "Outflow category updated" : "Outflow category created",
        description: editingOutflowCategory 
          ? "The outflow category has been updated successfully." 
          : "The outflow category has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteOutflowCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/outflow-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/outflow-categories`] });
      setDeletingOutflowCategory(null);
      toast({
        title: "Outflow category deleted",
        description: "The outflow category has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cash account mutation
  const cashAccountMutation = useMutation({
    mutationFn: async (data: CashAccountFormData & { id?: number }) => {
      const { id, ...payload } = data;
      if (id) {
        return apiRequest('PUT', `/api/cash-accounts/${id}`, payload);
      }
      return apiRequest('POST', `/api/stores/${currentStoreId}/cash-accounts`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/cash-accounts`] });
      setEditingCashAccount(null);
      setCashAccountDialogOpen(false);
      cashAccountForm.reset();
      toast({
        title: "Cash account saved",
        description: "The cash account has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCashAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/cash-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/cash-accounts`] });
      setDeletingCashAccount(null);
      toast({
        title: "Cash account deleted",
        description: "The cash account has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Account transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (data: AccountTransferFormData) => {
      return apiRequest('POST', `/api/stores/${currentStoreId}/account-transfers`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/account-transfers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/cash-accounts`] });
      setTransferDialogOpen(false);
      transferForm.reset();
      toast({
        title: "Transfer completed",
        description: "The transfer has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/account-transfers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/account-transfers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/cash-accounts`] });
      setDeletingTransfer(null);
      toast({
        title: "Transfer deleted",
        description: "The transfer has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset forms and selection states on store change to avoid showing stale data from previous store while loading
  useEffect(() => {
    // Clear selections
    setSelectedTypeId(null);
    setSelectedTermId(null);
    setEditingTypeId(null);
    setEditingTermId(null);
    setEditingCategory(null);
    setDeletingCategory(null);
    setEditingInflowCategory(null);
    setDeletingInflowCategory(null);
    setEditingOutflowCategory(null);
    setDeletingOutflowCategory(null);
    setEditingCashAccount(null);
    setDeletingCashAccount(null);
    setDeletingTransfer(null);
    
    // Reset forms to their initial default empty states
    companyForm.reset();
    notesForm.reset();
    inflowCategoryForm.reset();
    outflowCategoryForm.reset();
    cashAccountForm.reset();
    transferForm.reset();
    typeForm.reset();
    termForm.reset();
  }, [currentStoreId, companyForm, notesForm, inflowCategoryForm, outflowCategoryForm, cashAccountForm, transferForm, typeForm, termForm]);

  // Reset hasInitialized when component unmounts (so it reinitializes when user navigates back)
  useEffect(() => {
    return () => {
      hasInitialized.current = false;
    };
  }, []);

  // Set form values when user data is loaded (only once per mount)
  useEffect(() => {
    if (userData && !hasInitialized.current) {
      profileForm.reset({
        fullName: userData.fullName || "",
        email: userData.email || "",
        username: userData.username || "",
      });
      hasInitialized.current = true;
    }
  }, [userData, profileForm]);

  // Sync store data to company form
  useEffect(() => {
    if (storeData) {
      companyForm.reset({
        companyName: storeData.name || "",
        companyTagline: storeData.tagline || "",
        companyAddress: storeData.address || "",
        companyPhone: storeData.phone || "",
        companyEmail: storeData.email || "",
        taxNumber: storeData.taxNumber || "",
        defaultTaxRate: storeData.defaultTaxRate || "11",
        logoUrl: storeData.logoUrl || "",
        quotationNotes: storeData.quotationNotes || "",
        invoiceNotes: storeData.invoiceNotes || "",
        deliveryNoteNotes: storeData.deliveryNoteNotes || "",
        defaultNotes: storeData.defaultNotes || "Items checked and verified upon delivery. Items cannot be returned.",
      });
    }
  }, [storeData, companyForm, currentStoreId]);

  // Load global company settings
  useEffect(() => {
    if (globalCompanySettings) {
      setGlobalCompanyName(globalCompanySettings.companyName || "Mitra Indo Aluminium");
      setGlobalLogoUrl(globalCompanySettings.logoUrl || "");
    }
  }, [globalCompanySettings]);

  // Save global company settings handler
  const handleSaveGlobalSettings = async () => {
    try {
      setIsSavingGlobalSettings(true);
      const res = await apiRequest('PUT', '/api/company-settings', {
        companyName: globalCompanyName,
        logoUrl: globalLogoUrl || null,
      });
      if (res.ok) {
        toast({
          title: "Success",
          description: "Global company settings saved successfully",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      } else {
        const err = await res.json();
        toast({
          title: "Error",
          description: err.error || "Failed to save settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save global settings",
        variant: "destructive",
      });
    } finally {
      setIsSavingGlobalSettings(false);
    }
  };

  // Form submission handlers
  const onProfileSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate(data);
  };

  const onCompanySubmit = (data: CompanyFormValues) => {
    companyMutation.mutate(data);
  };

  const onNotesSubmit = (data: NotesFormValues) => {
    notesMutation.mutate(data);
  };

  const onPaymentSubmit = (data: PaymentFormValues) => {
    paymentMutation.mutate(data);
  };

  const onSecuritySubmit = (data: SecurityFormValues) => {
    passwordMutation.mutate(data);
  };

  // Handlers for Payment Types
  const handleAddType = () => {
    setEditingTypeId(null);
    typeForm.reset({
      name: "",
      description: "",
      cashAccountId: null,
      deductionPercentage: null,
      isActive: true,
      storeId: currentStoreId
    });
    setIsTypeDialogOpen(true);
  };

  const handleEditType = () => {
    if (!selectedTypeId || !paymentTypes) return;
    const type = paymentTypes.find((t: any) => t.id === selectedTypeId);
    if (type) {
      setEditingTypeId(type.id);
      typeForm.reset({
        name: type.name,
        description: type.description || "",
        cashAccountId: type.cashAccountId || null,
        deductionPercentage: type.deductionPercentage || null,
        isActive: type.isActive,
        storeId: type.storeId
      });
      setIsTypeDialogOpen(true);
    }
  };

  const handleDeleteType = () => {
    if (!selectedTypeId) return;
    if (confirm("Are you sure you want to delete this payment type?")) {
      deleteTypeMutation.mutate(selectedTypeId);
    }
  };

  const onSubmitType = (data: PaymentTypeFormData) => {
    if (editingTypeId) {
      updateTypeMutation.mutate({ id: editingTypeId, data });
    } else {
      createTypeMutation.mutate(data);
    }
  };

  // Handlers for Payment Terms
  const handleAddTerm = () => {
    setEditingTermId(null);
    termForm.reset();
    setIsTermDialogOpen(true);
  };

  const handleEditTerm = () => {
    if (!selectedTermId || !paymentTerms) return;
    const term = paymentTerms.find((t: any) => t.id === selectedTermId);
    if (term) {
      setEditingTermId(term.id);
      termForm.reset({
        name: term.name,
        days: term.days,
        description: term.description || "",
        isActive: term.isActive,
        storeId: term.storeId
      });
      setIsTermDialogOpen(true);
    }
  };

  const handleDeleteTerm = () => {
    if (!selectedTermId) return;
    if (confirm("Are you sure you want to delete this payment term?")) {
      deleteTermMutation.mutate(selectedTermId);
    }
  };

  const onSubmitTerm = (data: PaymentTermFormData) => {
    if (editingTermId) {
      updateTermMutation.mutate({ id: editingTermId, data });
    } else {
      createTermMutation.mutate(data);
    }
  };

  // Category handlers
  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      description: category.description || "",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    categoryForm.reset({
      name: "",
      description: "",
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSubmitCategory = (data: CategoryFormData) => {
    categoryMutation.mutate({
      id: editingCategory?.id,
      data,
    });
  };

  const handleDeleteCategory = () => {
    if (deletingCategory) {
      deleteCategoryMutation.mutate(deletingCategory.id);
    }
  };

  // Inflow category handlers
  const handleEditInflowCategory = (category: InflowCategory) => {
    setEditingInflowCategory(category);
    inflowCategoryForm.reset({
      name: category.name,
      description: category.description || "",
      storeId: category.storeId,
      isActive: category.isActive,
    });
    setIsInflowCategoryDialogOpen(true);
  };

  const handleAddInflowCategory = () => {
    setEditingInflowCategory(null);
    inflowCategoryForm.reset({
      name: "",
      description: "",
      storeId: currentStoreId,
      isActive: true,
    });
    setIsInflowCategoryDialogOpen(true);
  };

  const handleSubmitInflowCategory = (data: InflowCategoryFormData) => {
    inflowCategoryMutation.mutate({
      id: editingInflowCategory?.id,
      data,
    });
  };

  const handleDeleteInflowCategory = () => {
    if (deletingInflowCategory) {
      deleteInflowCategoryMutation.mutate(deletingInflowCategory.id);
    }
  };

  // Outflow category handlers
  const handleEditOutflowCategory = (category: OutflowCategory) => {
    setEditingOutflowCategory(category);
    outflowCategoryForm.reset({
      name: category.name,
      description: category.description || "",
      storeId: category.storeId,
      isActive: category.isActive,
    });
    setIsOutflowCategoryDialogOpen(true);
  };

  const handleAddOutflowCategory = () => {
    setEditingOutflowCategory(null);
    outflowCategoryForm.reset({
      name: "",
      description: "",
      storeId: currentStoreId,
      isActive: true,
    });
    setIsOutflowCategoryDialogOpen(true);
  };

  const handleSubmitOutflowCategory = (data: OutflowCategoryFormData) => {
    outflowCategoryMutation.mutate({
      id: editingOutflowCategory?.id,
      data,
    });
  };

  const handleDeleteOutflowCategory = () => {
    if (deletingOutflowCategory) {
      deleteOutflowCategoryMutation.mutate(deletingOutflowCategory.id);
    }
  };

  // Export backup mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/backup/export?storeId=${currentStoreId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export backup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return true;
    },
    onSuccess: () => {
      toast({
        title: "Backup exported",
        description: "Your database backup has been downloaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: `Failed to export backup: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Import backup mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const response = await apiRequest('POST', '/api/backup/import', {
        data: backupData.data,
        storeId: currentStoreId
      });
      return response.json() as Promise<{ message: string }>;
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: data.message,
      });
      setImportFile(null);
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: `Failed to import backup: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const saveReturnWindowMutation = useMutation({
    mutationFn: async (days: string) => {
      const response = await apiRequest('POST', `/api/stores/${currentStoreId}/settings`, {
        key: 'return_window_days',
        value: days
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Pengaturan berhasil disimpan", description: "Batas hari retur telah diperbarui." });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/settings`] });
    },
    onError: (error: any) => {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    }
  });

  const saveBusinessRuleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await apiRequest('POST', `/api/stores/${currentStoreId}/settings`, { key, value });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/settings`] });
    },
    onError: (error: any) => {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setImportFile(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a valid JSON backup file.",
        variant: "destructive",
      });
    }
  };

  const handleImport = () => {
    if (importFile) {
      importMutation.mutate(importFile);
    }
  };

  // Get user initials for avatar
  const getUserInitials = (name: string = "") => {
    return name
      .split(" ")
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
  };

  // Show loading spinner if user data is loading
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      <Tabs 
        defaultValue="company" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <div className="border-b">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="company" className="gap-2">
              <Building className="h-4 w-4" />
              <span>Company</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText className="h-4 w-4" />
              <span>Notes</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span>Payment</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <Database className="h-4 w-4" />
              <span>Backup</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              <span>Categories</span>
            </TabsTrigger>
            <TabsTrigger value="returns" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              <span>Retur</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="company" className="space-y-6">
          {/* Global Company Settings - Only visible to owner */}
          {userData?.role === 'owner' && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Application Branding
                </CardTitle>
                <CardDescription>
                  Configure the company name and logo that appears on the login page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="globalCompanyName">Application Name</Label>
                  <Input
                    id="globalCompanyName"
                    value={globalCompanyName}
                    onChange={(e) => setGlobalCompanyName(e.target.value)}
                    placeholder="Mitra Indo Aluminium"
                  />
                  <p className="text-sm text-muted-foreground">
                    This name will be displayed on the login page
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="globalLogoUrl">Login Page Logo URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="globalLogoUrl"
                      value={globalLogoUrl}
                      onChange={(e) => setGlobalLogoUrl(e.target.value)}
                      placeholder="Enter logo URL or upload using button"
                      className="flex-1"
                    />
                     <ObjectUploader
                       maxNumberOfFiles={1}
                       maxFileSize={5242880}
                       onGetUploadParameters={async (file) => {
                         const responseObj = await apiRequest('POST', '/api/objects/upload', {});
                         const response = await responseObj.json();
                         if (!response.uploadURL) {
                           throw new Error("No upload URL received from server");
                         }
                         return {
                           method: 'PUT' as const,
                           url: response.uploadURL,
                         };
                       }}
                       onComplete={async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                         if (result.failed && result.failed.length > 0) {
                           toast({
                             title: "Upload failed",
                             description: result.failed[0]?.error?.message || "Unknown error",
                             variant: "destructive",
                           });
                           return;
                         }
                         if (result.successful && result.successful.length > 0) {
                           const uploadedFile = result.successful[0];
                           const uploadURL = (uploadedFile as any)?.uploadURL;
                           
                           if (uploadURL) {
                             try {
                               // Call /api/logo to set ACL and get public path
                               const responseObj = await apiRequest('PUT', '/api/logo', { logoURL: uploadURL });
                               const responseData = await responseObj.json();
                               
                               const logoUrl = responseData.logoPath || responseData.logoURL || uploadURL;
                               setGlobalLogoUrl(logoUrl);
                               
                               toast({
                                 title: "Logo uploaded",
                                 description: "Logo berhasil diupload. Klik 'Save Branding Settings' untuk menyimpan.",
                               });
                             } catch (error) {
                               console.error("Error setting logo ACL:", error);
                               // Fallback: use the upload URL without query params
                               const urlParts = uploadURL.split('?');
                               if (urlParts[0]) {
                                 setGlobalLogoUrl(urlParts[0]);
                                 toast({
                                   title: "Logo uploaded",
                                   description: "Logo berhasil diupload. Klik 'Save Branding Settings' untuk menyimpan.",
                                 });
                               }
                             }
                           }
                         }
                       }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </ObjectUploader>
                  </div>
                  {globalLogoUrl && (
                    <div className="flex items-center gap-4 p-4 border rounded-lg mt-2">
                      <img 
                        src={globalLogoUrl} 
                        alt="Login Logo" 
                        className="h-16 w-16 object-contain border rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Current Logo</p>
                        <p className="text-xs text-muted-foreground break-all">{globalLogoUrl}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setGlobalLogoUrl("")}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleSaveGlobalSettings}
                  disabled={isSavingGlobalSettings}
                >
                  {isSavingGlobalSettings ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Branding Settings
                </Button>
              </CardFooter>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Update your company details which will appear on your invoices and quotations</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...companyForm}>
                <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-6">
                  <FormField
                    control={companyForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Company Name" {...field} data-testid="input-company-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={companyForm.control}
                    name="companyTagline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagline / Subtitle</FormLabel>
                        <FormControl>
                          <Input placeholder="DISTRIBUTOR ALUMINUM & ACCESSORIES" {...field} data-testid="input-company-tagline" />
                        </FormControl>
                        <FormDescription>
                          A short description of your business
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={companyForm.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Logo</FormLabel>
                        <div className="space-y-4">
                          {field.value && (
                            <div className="flex items-center gap-4 p-4 border rounded-lg">
                              <img 
                                src={field.value} 
                                alt="Company Logo" 
                                className="h-20 w-20 object-contain border rounded"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">Current Logo</p>
                                <p className="text-xs text-muted-foreground break-all">{field.value}</p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => field.onChange("")}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="Or enter logo URL manually" 
                                data-testid="input-logo-url" 
                              />
                            </FormControl>
                            <ObjectUploader
                              maxNumberOfFiles={1}
                              maxFileSize={5242880}
                              onGetUploadParameters={async (file) => {
                                console.log("Getting upload parameters for file:", file?.name);
                                const responseObj = await apiRequest('POST', '/api/objects/upload', {});
                                const response = await responseObj.json();
                                console.log("Upload parameters response:", response);
                                if (!response.uploadURL) {
                                  throw new Error("No upload URL received from server");
                                }
                                return {
                                  method: 'PUT' as const,
                                  url: response.uploadURL,
                                };
                              }}
                              onComplete={async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
                                console.log("Upload complete, result:", result);
                                
                                // Check for failed uploads first
                                if (result.failed && result.failed.length > 0) {
                                  const failedFile = result.failed[0];
                                  console.error("Upload failed:", failedFile);
                                  toast({
                                    title: "Upload gagal",
                                    description: `Gagal upload file: ${failedFile.error || 'Error tidak diketahui'}`,
                                    variant: "destructive",
                                  });
                                  return;
                                }

                                if (result.successful && result.successful.length > 0) {
                                  const uploadedFile = result.successful[0];
                                  const uploadURL = uploadedFile.uploadURL;

                                  console.log("File berhasil diupload ke:", uploadURL);

                                  try {
                                    const responseObj = await apiRequest('PUT', '/api/logo', { logoURL: uploadURL });
                                    const responseData = await responseObj.json();

                                    console.log("Logo API response:", responseData);

                                    // Update the form field with the uploaded URL
                                    const logoUrl = responseData.logoPath || responseData.logoURL || uploadURL;
                                    field.onChange(logoUrl);

                                    // Mark form as dirty so save button is enabled
                                    companyForm.setValue('logoUrl', logoUrl, { 
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true
                                    });

                                    toast({
                                      title: "Logo berhasil diupload",
                                      description: "Logo perusahaan Anda berhasil diupload. Klik 'Save Company Details' untuk menyimpan perubahan.",
                                    });
                                  } catch (error: any) {
                                    console.error("Logo API error:", error);
                                    toast({
                                      title: "Error",
                                      description: error.message || "Gagal menyimpan logo. Silakan coba lagi.",
                                      variant: "destructive",
                                    });
                                  }
                                } else {
                                  console.warn("No successful uploads");
                                  toast({
                                    title: "Tidak ada file yang diupload",
                                    description: "Silakan pilih file untuk diupload.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Logo
                            </ObjectUploader>
                          </div>
                        </div>
                        <FormDescription>
                          Upload an image or enter a URL (max 5MB, images only)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <FormField
                    control={companyForm.control}
                    name="companyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Street address, city, postal code" rows={3} {...field} data-testid="input-company-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={companyForm.control}
                      name="companyPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(XXX) XXXX-XXXX" {...field} data-testid="input-company-phone" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={companyForm.control}
                      name="companyEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="company@email.com" {...field} data-testid="input-company-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={companyForm.control}
                      name="taxNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Number / VAT ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter tax number" {...field} data-testid="input-tax-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={companyForm.control}
                      name="defaultTaxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01"
                              min="0"
                              max="100"
                              placeholder="11" 
                              {...field} 
                              data-testid="input-tax-rate" 
                            />
                          </FormControl>
                          <FormDescription>
                            Tarif pajak yang akan digunakan untuk dokumen dengan faktur pajak (PPN)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={companyMutation.isPending || !companyForm.formState.isDirty}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      <span>Save Company Details</span>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          <Form {...notesForm}>
            <form onSubmit={notesForm.handleSubmit(onNotesSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Document Notes</CardTitle>
                  <CardDescription>Configure default notes for this branch. Each branch can have different notes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={notesForm.control}
                      name="quotationNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quotation Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Default notes for quotations" 
                              className="min-h-[100px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Standard terms for quotations</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={notesForm.control}
                      name="invoiceNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Default notes for invoices" 
                              className="min-h-[100px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Standard terms for invoices</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={notesForm.control}
                      name="deliveryNoteNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Note Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Default notes for delivery notes" 
                              className="min-h-[100px]" 
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>Standard terms for delivery notes</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end border-t p-6">
                  <Button type="submit" disabled={notesMutation.isPending || !notesForm.formState.isDirty} className="gap-2">
                    <Save className="h-4 w-4" />
                    <span>{notesMutation.isPending ? "Saving..." : "Save Notes"}</span>
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Payment Types Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Payment Types</CardTitle>
                <CardDescription>Manage payment methods (e.g., Cash, Bank Transfer, Credit Card)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-md min-h-[300px] max-h-[400px] overflow-y-auto bg-background">
                  {paymentTypes && paymentTypes.length > 0 ? (
                    <div className="divide-y">
                      {paymentTypes.map((type: any) => (
                        <div
                          key={type.id}
                          onClick={() => setSelectedTypeId(type.id)}
                          className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                            selectedTypeId === type.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span>{type.name}</span>
                          {storeData?.defaultPaymentTypeId === type.id && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                      No payment types found
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedTypeId) {
                        const isAlreadyDefault = storeData?.defaultPaymentTypeId === selectedTypeId;
                        setDefaultPaymentTypeMutation.mutate(isAlreadyDefault ? null : selectedTypeId);
                      }
                    }}
                    disabled={!selectedTypeId}
                    className="gap-2"
                  >
                    <Star className={`h-4 w-4 ${storeData?.defaultPaymentTypeId === selectedTypeId ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-600'}`} />
                    {storeData?.defaultPaymentTypeId === selectedTypeId ? 'Unset Default' : 'Set as Default'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddType}
                    className="gap-2"
                  >
                    <FolderPlus className="h-4 w-4 text-green-600" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditType}
                    disabled={!selectedTypeId}
                    className="gap-2"
                  >
                    <FolderEdit className="h-4 w-4 text-yellow-600" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteType}
                    disabled={!selectedTypeId}
                    className="gap-2"
                  >
                    <FolderMinus className="h-4 w-4 text-red-600" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Payment Terms Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Payment Terms</CardTitle>
                <CardDescription>Define payment terms for invoices (e.g., Net 30, COD)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-md min-h-[300px] max-h-[400px] overflow-y-auto bg-background">
                  {paymentTerms && paymentTerms.length > 0 ? (
                    <div className="divide-y">
                      {paymentTerms.map((term: any) => (
                        <div
                          key={term.id}
                          onClick={() => setSelectedTermId(term.id)}
                          className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between ${
                            selectedTermId === term.id
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span>{term.name}</span>
                          {storeData?.defaultPaymentTermId === term.id && (
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                      No payment terms found
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedTermId) {
                        const isAlreadyDefault = storeData?.defaultPaymentTermId === selectedTermId;
                        setDefaultPaymentTermMutation.mutate(isAlreadyDefault ? null : selectedTermId);
                      }
                    }}
                    disabled={!selectedTermId}
                    className="gap-2"
                  >
                    <Star className={`h-4 w-4 ${storeData?.defaultPaymentTermId === selectedTermId ? 'fill-yellow-400 text-yellow-400' : 'text-yellow-600'}`} />
                    {storeData?.defaultPaymentTermId === selectedTermId ? 'Unset Default' : 'Set as Default'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddTerm}
                    className="gap-2"
                  >
                    <FolderPlus className="h-4 w-4 text-green-600" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEditTerm}
                    disabled={!selectedTermId}
                    className="gap-2"
                  >
                    <FolderEdit className="h-4 w-4 text-yellow-600" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteTerm}
                    disabled={!selectedTermId}
                    className="gap-2"
                  >
                    <FolderMinus className="h-4 w-4 text-red-600" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cash Accounts Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cash Accounts</CardTitle>
                <CardDescription>Manage your cash accounts and track balances</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => {
                  transferForm.reset({
                    fromAccountId: 0,
                    toAccountId: 0,
                    amount: "",
                    date: new Date().toISOString().split('T')[0],
                    notes: "",
                    reference: "",
                    storeId: currentStoreId
                  });
                  setTransferDialogOpen(true);
                }} variant="outline" className="gap-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  Transfer
                </Button>
                <Button onClick={() => {
                  cashAccountForm.reset({
                    name: "",
                    accountType: "cash",
                    initialBalance: "0",
                    description: "",
                    isActive: true,
                    storeId: currentStoreId
                  });
                  setEditingCashAccount(null);
                  setCashAccountDialogOpen(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Account
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {cashAccountsLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : !cashAccounts?.length ? (
                <div className="text-center py-4 text-muted-foreground">No cash accounts yet</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {cashAccounts.map((account) => (
                      <Card key={account.id} className="relative">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{account.name}</CardTitle>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingCashAccount(account);
                                  cashAccountForm.reset({
                                    name: account.name,
                                    accountType: account.accountType as "cash" | "bank_company" | "bank_personal" | "other",
                                    initialBalance: account.initialBalance,
                                    description: account.description || "",
                                    isActive: account.isActive,
                                    storeId: currentStoreId
                                  });
                                  setCashAccountDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingCashAccount(account)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                          <CardDescription>
                            {account.accountType === 'cash' && 'Cash'}
                            {account.accountType === 'bank_company' && 'Company Bank Account'}
                            {account.accountType === 'bank_personal' && 'Personal Bank Account'}
                            {account.accountType === 'other' && 'Other'}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            Rp {account.currentBalance.toLocaleString('id-ID')}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 space-y-1">
                            <div className="flex justify-between">
                              <span>Initial Balance:</span>
                              <span>Rp {parseFloat(account.initialBalance).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-green-600">
                              <span>Income:</span>
                              <span>+Rp {account.totalIncome.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Expense:</span>
                              <span>-Rp {account.totalExpense.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-blue-600">
                              <span>Transfers In:</span>
                              <span>+Rp {account.totalTransfersIn.toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex justify-between text-orange-600">
                              <span>Transfers Out:</span>
                              <span>-Rp {account.totalTransfersOut.toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                          {!account.isActive && (
                            <div className="mt-2 text-xs text-red-500">Inactive</div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Auto Transaction Section */}
          <AutoTransactionSettings />
        </TabsContent>

        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Database Backup
              </CardTitle>
              <CardDescription>
                Export and import your data for backup and migration purposes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Export Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Label>
                <p className="text-sm text-gray-600">
                  Download a complete backup of your invoices, clients, products, and other data as a JSON file.
                </p>
                <Button 
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-export-backup"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exportMutation.isPending ? "Exporting..." : "Export Backup"}
                </Button>
              </div>

              <Separator />

              {/* Import Section */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import Data
                </Label>
                <p className="text-sm text-gray-600">
                  Import data from a previously exported backup file. This will add the data to your existing records.
                </p>
                <div className="space-y-3">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      data-testid="input-backup-file"
                    />
                  </div>
                  {importFile && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Selected: {importFile.name}</span>
                    </div>
                  )}
                  <Button 
                    onClick={handleImport}
                    disabled={!importFile || importMutation.isPending}
                    variant="outline"
                    className="w-full sm:w-auto"
                    data-testid="button-import-backup"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {importMutation.isPending ? "Importing..." : "Import Backup"}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Security Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Backup Guidelines</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Regular backups help protect against data loss</li>
                  <li>• Store backup files in a secure location</li>
                  <li>• Test backup restoration periodically</li>
                  <li>• Backup files contain sensitive business data</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 mb-2">Import Warning</h4>
                <p className="text-sm text-amber-800">
                  Importing data will add records to your existing database. Make sure to create a backup before importing if you want to preserve your current state.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Product Categories</CardTitle>
                <CardDescription>Manage product categories for better organization</CardDescription>
              </div>
              <Button 
                onClick={handleAddCategory}
                data-testid="button-add-category"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !categories || categories.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No categories</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating a new category.
                  </p>
                  <div className="mt-6">
                    <Button onClick={handleAddCategory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Category
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                        <TableCell className="font-medium" data-testid={`text-category-name-${category.id}`}>
                          {category.name}
                        </TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400" data-testid={`text-category-description-${category.id}`}>
                          {category.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingCategory(category)}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Inflow Categories Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Inflow Categories</CardTitle>
                <CardDescription>Manage categories for income/revenue tracking</CardDescription>
              </div>
              <Button onClick={handleAddInflowCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Add Inflow Category
              </Button>
            </CardHeader>
            <CardContent>
              {inflowCategoriesLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !inflowCategories || inflowCategories.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No inflow categories</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating a new inflow category.
                  </p>
                  <div className="mt-6">
                    <Button onClick={handleAddInflowCategory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Inflow Category
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inflowCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditInflowCategory(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingInflowCategory(category)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Outflow Categories Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Outflow Categories</CardTitle>
                <CardDescription>Manage categories for expenses/costs tracking</CardDescription>
              </div>
              <Button onClick={handleAddOutflowCategory}>
                <Plus className="h-4 w-4 mr-2" />
                Add Outflow Category
              </Button>
            </CardHeader>
            <CardContent>
              {outflowCategoriesLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !outflowCategories || outflowCategories.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No outflow categories</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating a new outflow category.
                  </p>
                  <div className="mt-6">
                    <Button onClick={handleAddOutflowCategory}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Outflow Category
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outflowCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-gray-500 dark:text-gray-400">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditOutflowCategory(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingOutflowCategory(category)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="returns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                Pengaturan Retur
              </CardTitle>
              <CardDescription>
                Konfigurasi aturan retur barang
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-xs">
                <Label htmlFor="returnWindowDays">Batas Hari Retur</Label>
                <Input
                  id="returnWindowDays"
                  type="number"
                  min={0}
                  value={returnWindowDays}
                  onChange={(e) => setReturnWindowDays(e.target.value)}
                  placeholder="30"
                />
                <p className="text-sm text-muted-foreground">
                  Berapa hari setelah tanggal bayar terakhir invoice masih bisa diretur. Isi <strong>0</strong> untuk tanpa batasan waktu. Default: 30 hari.
                </p>
              </div>
              <Button
                onClick={() => saveReturnWindowMutation.mutate(returnWindowDays)}
                disabled={saveReturnWindowMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Simpan
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Aturan Bisnis
              </CardTitle>
              <CardDescription>
                Aturan operasional yang dapat dinyalakan atau dimatikan sesuai kebutuhan bisnis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between gap-4 py-3 border-b">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Wajib Bayar Sebelum Print Surat Jalan</Label>
                  <p className="text-sm text-muted-foreground">
                    Surat jalan hanya bisa diprint setelah invoice memiliki setidaknya satu pembayaran. Berguna untuk memastikan customer membayar sebelum barang disiapkan.
                  </p>
                </div>
                <Switch
                  checked={requirePaymentBeforePrint}
                  onCheckedChange={(checked) => {
                    setRequirePaymentBeforePrint(checked);
                    saveBusinessRuleMutation.mutate({ key: 'require_payment_before_delivery_print', value: checked ? 'true' : 'false' });
                  }}
                />
              </div>
              <div className="flex items-start justify-between gap-4 py-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Kunci Invoice Setelah Paid</Label>
                  <p className="text-sm text-muted-foreground">
                    Invoice tidak dapat diedit setelah status pembayaran menjadi Paid. Owner tetap dapat mengedit. Berguna untuk menjaga integritas data keuangan.
                  </p>
                </div>
                <Switch
                  checked={lockPaidInvoices}
                  onCheckedChange={(checked) => {
                    setLockPaidInvoices(checked);
                    saveBusinessRuleMutation.mutate({ key: 'lock_paid_invoices', value: checked ? 'true' : 'false' });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Cash Account Add/Edit Dialog */}
      <Dialog open={cashAccountDialogOpen} onOpenChange={setCashAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCashAccount ? "Edit Cash Account" : "Add Cash Account"}</DialogTitle>
          </DialogHeader>
          <Form {...cashAccountForm}>
            <form onSubmit={cashAccountForm.handleSubmit((data) => {
              cashAccountMutation.mutate({ ...data, id: editingCashAccount?.id });
            })} className="space-y-4">
              <FormField
                control={cashAccountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Cash, Rekening PT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cashAccountForm.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        {...field}
                      >
                        <option value="cash">Cash</option>
                        <option value="bank_company">Company Bank Account</option>
                        <option value="bank_personal">Personal Bank Account</option>
                        <option value="other">Other</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cashAccountForm.control}
                name="initialBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Balance</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cashAccountForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={cashAccountForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">Enable this account</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCashAccountDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={cashAccountMutation.isPending}>
                  {cashAccountMutation.isPending ? "Saving..." : (editingCashAccount ? "Update" : "Create")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Cash Account Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCashAccount} onOpenChange={() => setDeletingCashAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the cash account "{deletingCashAccount?.name}". 
              Transactions linked to this account will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCashAccount && deleteCashAccountMutation.mutate(deletingCashAccount.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCashAccountMutation.isPending}
            >
              {deleteCashAccountMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Between Accounts</DialogTitle>
          </DialogHeader>
          <Form {...transferForm}>
            <form onSubmit={transferForm.handleSubmit((data) => {
              if (data.fromAccountId === data.toAccountId) {
                toast({
                  title: "Error",
                  description: "Source and destination accounts must be different",
                  variant: "destructive",
                });
                return;
              }
              transferMutation.mutate(data);
            })} className="space-y-4">
              <FormField
                control={transferForm.control}
                name="fromAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Account *</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      >
                        <option value="">Select account</option>
                        {cashAccounts?.filter(a => a.isActive).map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} (Rp {account.currentBalance.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="toAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Account *</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      >
                        <option value="">Select account</option>
                        {cashAccounts?.filter(a => a.isActive).map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} (Rp {account.currentBalance.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional notes" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={transferForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional reference" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={transferMutation.isPending}>
                  {transferMutation.isPending ? "Transferring..." : "Transfer"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Category Add/Edit Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(handleSubmitCategory)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., Aluminum Profiles" 
                        {...field} 
                        data-testid="input-category-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter category description..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-category-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCategoryDialogOpen(false)}
                  data-testid="button-cancel-category"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={categoryMutation.isPending}
                  data-testid="button-submit-category"
                >
                  {categoryMutation.isPending ? "Saving..." : (editingCategory ? "Update" : "Create")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Category Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category "{deletingCategory?.name}". 
              Products in this category will not be deleted but will have no category assigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCategoryMutation.isPending}
              data-testid="button-confirm-delete-category"
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inflow Category Dialog */}
      <Dialog open={isInflowCategoryDialogOpen} onOpenChange={setIsInflowCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInflowCategory ? "Edit Inflow Category" : "Add Inflow Category"}</DialogTitle>
          </DialogHeader>
          <Form {...inflowCategoryForm}>
            <form onSubmit={inflowCategoryForm.handleSubmit(handleSubmitInflowCategory)} className="space-y-4">
              <FormField
                control={inflowCategoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sales Revenue, Service Income" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inflowCategoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter category description..." 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInflowCategoryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inflowCategoryMutation.isPending}>
                  {inflowCategoryMutation.isPending ? "Saving..." : (editingInflowCategory ? "Update" : "Create")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Inflow Category Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingInflowCategory} onOpenChange={() => setDeletingInflowCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the inflow category "{deletingInflowCategory?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInflowCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteInflowCategoryMutation.isPending}
            >
              {deleteInflowCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Outflow Category Dialog */}
      <Dialog open={isOutflowCategoryDialogOpen} onOpenChange={setIsOutflowCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOutflowCategory ? "Edit Outflow Category" : "Add Outflow Category"}</DialogTitle>
          </DialogHeader>
          <Form {...outflowCategoryForm}>
            <form onSubmit={outflowCategoryForm.handleSubmit(handleSubmitOutflowCategory)} className="space-y-4">
              <FormField
                control={outflowCategoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Operating Expenses, Material Costs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={outflowCategoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter category description..." 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOutflowCategoryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={outflowCategoryMutation.isPending}>
                  {outflowCategoryMutation.isPending ? "Saving..." : (editingOutflowCategory ? "Update" : "Create")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Outflow Category Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingOutflowCategory} onOpenChange={() => setDeletingOutflowCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the outflow category "{deletingOutflowCategory?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOutflowCategory}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteOutflowCategoryMutation.isPending}
            >
              {deleteOutflowCategoryMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Type Dialog */}
      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTypeId ? "Edit Payment Type" : "Add Payment Type"}</DialogTitle>
          </DialogHeader>
          <Form {...typeForm}>
            <form onSubmit={typeForm.handleSubmit(onSubmitType)} className="space-y-4">
              <FormField
                control={typeForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Cash, Cheque, Credit Card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={typeForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={typeForm.control}
                name="cashAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash Account</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      >
                        <option value="">No account linked</option>
                        {cashAccounts?.filter(a => a.isActive).map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Select which account this payment type flows into</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={typeForm.control}
                name="deductionPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deduction Percentage (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="e.g., 0.15 for EDC fees" 
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Optional bank/processing fee percentage</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={typeForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">Enable this payment type</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsTypeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTypeMutation.isPending || updateTypeMutation.isPending}>
                  {editingTypeId ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Term Dialog */}
      <Dialog open={isTermDialogOpen} onOpenChange={setIsTermDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTermId ? "Edit Payment Term" : "Add Payment Term"}</DialogTitle>
          </DialogHeader>
          <Form {...termForm}>
            <form onSubmit={termForm.handleSubmit(onSubmitTerm)} className="space-y-4">
              <FormField
                control={termForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 1st Month, Before Delivery, COD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={termForm.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 30, 60, 0 for immediate" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={termForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={termForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <p className="text-sm text-muted-foreground">Enable this payment term</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsTermDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTermMutation.isPending || updateTermMutation.isPending}>
                  {editingTermId ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}