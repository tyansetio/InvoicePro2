import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { X, Save, Check, Plus, Trash2, ArrowLeft, DollarSign, Edit, Calendar, ChevronsUpDown, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useStore } from "@/lib/store-context";
import { insertInvoiceSchema, insertInvoicePaymentSchema } from "@shared/schema";
import type { InvoicePayment, Return } from "@shared/schema";
import { InvoiceItemRow } from "@/components/invoices/invoice-item-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { generatePDF } from "@/lib/pdf-generator";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";

// Extend the schema for client-side validation
const extendedInvoiceSchema = insertInvoiceSchema.extend({
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  // Using string representation for numeric fields to work with form inputs
  subtotal: z.string().optional(),
  tax: z.string().optional(),
  discount: z.string().optional(),
  shipping: z.string().optional(),
  total: z.string().optional(),
  useFakturPajak: z.boolean().optional(),
  taxRate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryAddressLink: z.string().optional(),
});

// For editing existing invoices, we need to include the invoice number for display
const editingInvoiceSchema = extendedInvoiceSchema.extend({
  invoiceNumber: z.string(),
});

// Schema for invoice items
const invoiceItemSchema = z.object({
  id: z.number().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.string().min(1, "Price is required"),
  taxRate: z.string().optional(),
  subtotal: z.string().optional(),
  tax: z.string().optional(),
  total: z.string().optional(),
  productId: z.number().nullable().optional(),
  productUnitId: z.number().nullable().optional(),
});

// Schema for the complete form - conditional based on whether editing
const getInvoiceFormSchema = (isEditing: boolean) => z.object({
  invoice: isEditing ? editingInvoiceSchema : extendedInvoiceSchema,
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
});

type InvoiceFormValues = {
  invoice: any;
  items: InvoiceItem[];
};
type InvoiceItem = z.infer<typeof invoiceItemSchema>;

interface InvoiceFormProps {
  invoiceId?: number;
  onSuccess?: (savedInvoiceId: number) => void;
}

const defaultItem: InvoiceItem = {
  id: undefined,
  description: "",
  quantity: "1",
  price: "0",
  taxRate: "0",
  subtotal: "0",
  tax: "0",
  total: "0",
  productId: null,
  productUnitId: null
};

export function InvoiceForm({ invoiceId, onSuccess }: InvoiceFormProps) {
  const { currentStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  // Start with empty array for edit mode (items will be loaded from API)
  // Start with default item for new invoice mode
  const [items, setItems] = useState<InvoiceItem[]>(invoiceId ? [] : [defaultItem]);
  const [itemPriceValidity, setItemPriceValidity] = useState<Record<number, boolean>>({});

  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<InvoicePayment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentType: 'Cash',
    amount: '',
    notes: '',
    creditNoteId: null as number | null
  });
  
  // Client combobox state
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  
  // Track if user has made changes (for back confirmation)
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<number | null>(null);
  
  // Store original loaded data for comparison-based change detection
  // This is more reliable than timing-based approaches
  const originalDataRef = useRef<string | null>(null);
  
  // Helper function to create a comparable snapshot of form data
  const createFormSnapshot = (invoiceValues: any, itemsArray: InvoiceItem[]): string => {
    // Only compare fields that represent actual user changes
    const snapshot = {
      clientId: invoiceValues?.clientId,
      issueDate: invoiceValues?.issueDate?.toISOString?.() || invoiceValues?.issueDate,
      dueDate: invoiceValues?.dueDate?.toISOString?.() || invoiceValues?.dueDate,
      paymentTerms: invoiceValues?.paymentTerms,
      notes: invoiceValues?.notes || '',
      useFakturPajak: invoiceValues?.useFakturPajak || false,
      deliveryAddress: invoiceValues?.deliveryAddress || '',
      deliveryAddressLink: invoiceValues?.deliveryAddressLink || '',
      items: itemsArray.map(item => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
      }))
    };
    return JSON.stringify(snapshot);
  };
  
  // Function to check if there are unsaved changes by comparing with original
  const hasUnsavedChanges = (): boolean => {
    if (!originalDataRef.current) {
      // For new invoices, check if any meaningful data has been entered
      if (!invoiceId) {
        const currentItems = items;
        const hasItems = currentItems.some(item => 
          item.productId || (item.description && item.description.trim() !== '')
        );
        const invoiceValues = form.getValues('invoice');
        const hasClient = !!invoiceValues?.clientId;
        const hasNotes = !!(invoiceValues?.notes && invoiceValues.notes.trim() !== '');
        return hasItems || hasClient || hasNotes;
      }
      return false;
    }
    
    const currentSnapshot = createFormSnapshot(form.getValues('invoice'), items);
    return currentSnapshot !== originalDataRef.current;
  };

  // Fetch clients for the dropdown
  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
  });

  // Fetch all products with stock info for product selection
  const { data: products } = useQuery<(Product & { currentStock?: number })[]>({
    queryKey: ['/api/stores', currentStoreId, 'products', 'stock'],
  });

  // Fetch payment terms from settings
  const { data: paymentTermsData = [] } = useQuery<{ id: number; code: string; name: string; days: number; description?: string; isActive: boolean }[]>({
    queryKey: ['/api/payment-terms'],
  });

  // Fetch invoice payments if editing an existing invoice
  const { data: invoicePayments = [] } = useQuery<InvoicePayment[]>({
    queryKey: ['/api/invoices', invoiceId, 'payments'],
    enabled: !!invoiceId,
  });

  // Fetch delivery notes for this invoice to check if items can be edited
  const { data: deliveryNotes = [] } = useQuery<{ id: number; status: string }[]>({
    queryKey: ['/api/invoices', invoiceId, 'delivery-notes'],
    enabled: !!invoiceId,
  });

  // Check if there are active (non-cancelled) delivery notes
  const hasActiveDeliveryNotes = invoiceId && deliveryNotes.some(dn => dn.status !== 'cancelled');
  
  // Fetch store data for defaults
  const { data: storeData } = useQuery<any>({
    queryKey: ['/api/stores', currentStoreId],
  });

  // Fetch current user for default notes and tax rate
  const { data: currentUser } = useQuery<any>({
    queryKey: ['/api/user'],
  });
  const canOverrideLowestPrice = currentUser?.role === 'owner' ||
    (currentUser?.permissions?.includes('invoices.override_lowest_price') ?? false);

  // Mutation for creating a payment
  const createPaymentMutation = useMutation({
    mutationFn: async (payment: any) => {
      return await apiRequest(`/api/invoices/${invoiceId}/payments`, 'POST', payment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId, 'payments'] });
      toast({ title: "Success", description: "Payment added successfully" });
      setPaymentDialogOpen(false);
      setPaymentForm({ paymentDate: format(new Date(), 'yyyy-MM-dd'), paymentType: 'Cash', amount: '', notes: '', creditNoteId: null });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: `Failed to add payment: ${error.message}`, variant: "destructive" });
    }
  });

  // Mutation for updating a payment
  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, payment }: { id: number; payment: any }) => {
      return await apiRequest(`/api/invoices/${invoiceId}/payments/${id}`, 'PUT', payment);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId, 'payments'] });
      toast({ title: "Success", description: "Payment updated successfully" });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      setPaymentForm({ paymentDate: format(new Date(), 'yyyy-MM-dd'), paymentType: 'Cash', amount: '', notes: '', creditNoteId: null });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: `Failed to update payment: ${error.message}`, variant: "destructive" });
    }
  });

  // Mutation for deleting a payment
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      return await apiRequest(`/api/invoices/${invoiceId}/payments/${paymentId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId, 'payments'] });
      toast({ title: "Success", description: "Payment deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: `Failed to delete payment: ${error.message}`, variant: "destructive" });
    }
  });

  // If editing an existing invoice, fetch its data
  const { data: invoiceData, isLoading: isLoadingInvoice } = useQuery({
    queryKey: ['/api/invoices', invoiceId],
    enabled: !!invoiceId,
  });

  // For new invoices, fetch the next invoice number preview with fallback
  const { data: nextInvoiceNumberData, isError: isNumberError } = useQuery({
    queryKey: ['/api/invoices/next-number'],
    enabled: !invoiceId, // Only for new invoices
  });

  // Generate fallback invoice number if API fails
  const generateFallbackInvoiceNumber = () => {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    return `INV-${year}${month}-0001`;
  };

  const nextInvoiceNumber = nextInvoiceNumberData?.invoiceNumber || 
    (isNumberError ? generateFallbackInvoiceNumber() : null);

  // Form setup with conditional schema
  const invoiceFormSchema = getInvoiceFormSchema(!!invoiceId);
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoice: {
        ...(invoiceId && { invoiceNumber: "" }),
        storeId: currentStoreId,
        clientId: 0,
        paymentTerms: "net_30",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "draft",
        totalAmount: "0",
        subtotal: "0",
        tax: "0",
        discount: "0",
        shipping: "0",
        total: "0",
        notes: "",
        useFakturPajak: false,
        taxRate: "11",
        deliveryAddress: "",
        deliveryAddressLink: ""
      },
      items: items
    }
  });

  // Watch clientId to fetch credit notes
  const watchedClientId = form.watch('invoice.clientId');
  
  // Fetch client credit notes for payment options
  // Always fetch when we have a valid clientId (not just when dialog is open) to ensure cache is populated
  type CreditNoteWithBalance = Return & { remainingBalance: number };
  const { data: clientCreditNotes = [], refetch: refetchCreditNotes } = useQuery<CreditNoteWithBalance[]>({
    queryKey: ['/api/clients', watchedClientId, 'credit-notes'],
    enabled: !!watchedClientId && watchedClientId !== 0,
    staleTime: 0, // Always refetch to get latest credit notes
  });
  
  // Refetch credit notes when payment dialog opens
  useEffect(() => {
    if (paymentDialogOpen && watchedClientId && watchedClientId !== 0) {
      refetchCreditNotes();
    }
  }, [paymentDialogOpen, watchedClientId, refetchCreditNotes]);

  // Helper function to calculate due date based on payment terms
  const calculateDueDate = (issueDate: Date, paymentTermsCode: string): Date => {
    const date = new Date(issueDate);
    
    // Check if it's "custom" - don't auto-calculate
    if (paymentTermsCode === 'custom') {
      return date;
    }
    
    // Find the payment term from API data by code
    const term = paymentTermsData.find(t => t.code === paymentTermsCode);
    
    if (term) {
      date.setDate(date.getDate() + term.days);
    }
    
    return date;
  };

  // Set default payment term from store settings for new invoices
  useEffect(() => {
    if (!invoiceId && storeData?.defaultPaymentTermId && paymentTermsData.length > 0) {
      const defaultTerm = paymentTermsData.find(t => t.id === storeData.defaultPaymentTermId);
      if (defaultTerm) {
        const currentTerms = form.getValues('invoice.paymentTerms');
        if (currentTerms === 'net_30' || !currentTerms) {
          form.setValue('invoice.paymentTerms', defaultTerm.code);
        }
      }
    }
  }, [storeData, paymentTermsData, invoiceId]);

  // Watch for changes to issueDate and paymentTerms to auto-update dueDate
  const watchIssueDate = form.watch('invoice.issueDate');
  const watchPaymentTerms = form.watch('invoice.paymentTerms');

  useEffect(() => {
    // Only auto-calculate if not custom payment terms AND payment terms data is loaded
    if (watchPaymentTerms && watchPaymentTerms !== 'custom' && watchIssueDate && paymentTermsData.length > 0) {
      const term = paymentTermsData.find(t => t.code === watchPaymentTerms);
      if (term) {
        const newDueDate = calculateDueDate(watchIssueDate, watchPaymentTerms);
        form.setValue('invoice.dueDate', newDueDate);
      }
    }
  }, [watchIssueDate, watchPaymentTerms, paymentTermsData]);

  // Create/update invoice mutation (navigates away after success)
  const mutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      // Format dates as ISO strings
      let invoiceData = {
        ...values.invoice,
        issueDate: values.invoice.issueDate.toISOString(),
        dueDate: values.invoice.dueDate.toISOString(),
      };

      const formattedValues = {
        ...values,
        invoice: invoiceData
      };

      const currentId = invoiceId || savedInvoiceId;
      let response: Response;
      if (currentId) {
        response = await apiRequest('PUT', `/api/invoices/${currentId}`, formattedValues);
      } else {
        response = await apiRequest('POST', '/api/invoices', formattedValues);
      }
      // Parse response to get invoice data with ID (handle empty/non-JSON responses)
      let data = {};
      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch (e) {
        console.warn('Could not parse response as JSON:', e);
      }
      return { ...data, existingId: currentId };
    },
    onSuccess: async (result: any) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      await queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-invoices'] });
      toast({
        title: invoiceId ? "Invoice updated" : "Invoice created",
        description: invoiceId ? "Your invoice has been updated successfully." : "Your invoice has been created successfully.",
      });
      // Navigate to the invoice detail page
      const resultId = result.existingId || result.id;
      if (onSuccess && resultId) {
        onSuccess(resultId);
      } else if (onSuccess && invoiceId) {
        onSuccess(invoiceId);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${invoiceId ? "update" : "create"} invoice: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Save draft mutation (stays on page after success)
  const saveDraftMutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      let invoiceData = {
        ...values.invoice,
        issueDate: values.invoice.issueDate.toISOString(),
        dueDate: values.invoice.dueDate.toISOString(),
        status: 'draft'
      };

      const formattedValues = {
        ...values,
        invoice: invoiceData
      };

      const currentId = invoiceId || savedInvoiceId;
      let response: Response;
      if (currentId) {
        response = await apiRequest('PUT', `/api/invoices/${currentId}`, formattedValues);
      } else {
        response = await apiRequest('POST', '/api/invoices', formattedValues);
      }
      // Parse response to get invoice data with ID (handle empty/non-JSON responses)
      let data: any = {};
      try {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch (e) {
        console.warn('Could not parse response as JSON:', e);
      }
      return { ...data, existingId: currentId };
    },
    onSuccess: async (result: any) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      await queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/dashboard/recent-invoices'] });
      // If this was a new invoice, store the ID so subsequent saves update the same invoice
      const newId = result?.id;
      if (!invoiceId && !savedInvoiceId && newId) {
        setSavedInvoiceId(newId);
      }
      
      toast({
        title: "Invoice saved",
        description: "Your invoice has been saved as draft.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to save invoice: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const { showDialog: showNavGuardDialog, confirmNavigation, cancelNavigation } = useUnsavedChangesGuard({
    isDirty: () => {
      const invoiceData = form.getValues('invoice');
      const hasClient = invoiceData.clientId && invoiceData.clientId !== 0;
      const hasNonEmptyItems = items.some(item => item.description && item.description.trim() !== '');
      const hasMeaningfulData = hasClient || hasNonEmptyItems;
      return hasUnsavedChanges() && hasMeaningfulData;
    },
    isSubmitting: mutation.isPending || saveDraftMutation.isPending,
  });

  // Set up the form when data is loaded  
  useEffect(() => {
    if (invoiceData && invoiceId) {
      // API returns { invoice: {...}, items: [...], client: {...} }
      const invoiceRecord = invoiceData.invoice || invoiceData;
      const itemsArray = invoiceData.items || [];

      // Populate form with existing invoice data
      const invoice = {
        ...invoiceRecord,
        paymentTerms: invoiceRecord.paymentTerms || 'custom', // Default to custom for existing invoices without paymentTerms
        issueDate: new Date(invoiceRecord.issueDate),
        dueDate: new Date(invoiceRecord.dueDate),
        subtotal: (invoiceRecord.subtotal ?? 0).toString(),
        tax: (invoiceRecord.taxAmount ?? invoiceRecord.tax ?? 0).toString(),
        discount: Math.floor(parseFloat(invoiceRecord.discount ?? '0')).toString(),
        shipping: Math.floor(parseFloat((invoiceRecord as any).shipping ?? '0')).toString(),
        total: (invoiceRecord.totalAmount ?? invoiceRecord.total ?? 0).toString(),
        useFakturPajak: invoiceRecord.useFakturPajak || false,
        taxRate: invoiceRecord.taxRate?.toString() || currentUser?.defaultTaxRate || "11",
        deliveryAddress: invoiceRecord.deliveryAddress || "",
        deliveryAddressLink: invoiceRecord.deliveryAddressLink || "",
      };

      form.setValue('invoice', invoice);

      if (itemsArray && itemsArray.length > 0) {
        const formattedItems = itemsArray.map((item: any) => ({
          id: item.id,
          description: item.description || "",
          quantity: (item.quantity ?? 1).toString(),
          price: (item.unitPrice ?? item.price ?? 0).toString(),
          taxRate: (item.taxRate ?? 0).toString(),
          subtotal: (item.subtotal ?? 0).toString(),
          tax: (item.taxAmount ?? item.tax ?? 0).toString(),
          total: (item.totalAmount ?? item.total ?? 0).toString(),
          productId: item.productId || null,
          productUnitId: item.productUnitId || null,
        }));

        setItems(formattedItems);
        form.setValue('items', formattedItems);
      } else {
        // Reset to empty default item if no items
        setItems([{ ...defaultItem }]);
        form.setValue('items', [{ ...defaultItem }]);
      }
      
      // Store original data snapshot for comparison-based change detection
      // Create snapshot immediately from the API data (not from state)
      const loadedItems = itemsArray && itemsArray.length > 0 
        ? itemsArray.map((item: any) => ({
            productId: item.productId || null,
            description: item.description || "",
            quantity: (item.quantity ?? 1).toString(),
            price: (item.unitPrice ?? item.price ?? 0).toString(),
          }))
        : [{ productId: null, description: "", quantity: "1", price: "0" }];
      
      originalDataRef.current = createFormSnapshot(invoice, loadedItems as any);
    }
  }, [invoiceData, invoiceId, form]);

  // Watch discount and shipping
  const watchDiscount = form.watch('invoice.discount');
  const watchShipping = form.watch('invoice.shipping');

  // Calculate totals whenever items or settings change
  useEffect(() => {
    if (items.length > 0) {
      // Sum up all item totals
      let itemsTotal = 0;
      items.forEach(item => {
        itemsTotal += parseFloat(item.subtotal || "0");
      });

      // Apply discount and shipping
      const discountValue = parseFloat(watchDiscount || "0");
      const shippingValue = parseFloat(watchShipping || "0");

      // Subtotal equals items total, no separate tax
      const subtotal = itemsTotal;
      const taxAmount = 0;
      const total = subtotal - discountValue + shippingValue;

      // Update form values
      form.setValue('invoice.subtotal', subtotal.toFixed(2));
      form.setValue('invoice.tax', taxAmount.toFixed(2));
      form.setValue('invoice.taxRate', "0");
      form.setValue('invoice.shipping', Math.floor(shippingValue).toString());
      form.setValue('invoice.total', total.toFixed(2));

      // Update items in the form
      form.setValue('items', items);
    }
  }, [items, form, watchDiscount, watchShipping]);

  // Add a new invoice item
  const addItem = () => {
    const newItem: InvoiceItem = {
      id: undefined,
      description: "",
      quantity: "1",
      price: "0",
      taxRate: "0",
      subtotal: "0",
      tax: "0",
      total: "0",
      productId: null,
      productUnitId: null
    };

    setItems([...items, newItem]);
  };

  // Remove an invoice item
  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    } else {
      toast({
        title: "Error",
        description: "At least one item is required",
        variant: "destructive",
      });
    }
  };

  // Update an invoice item
  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };

      // Recalculate totals when quantity, price, or taxRate changes
      if (field === 'quantity' || field === 'price' || field === 'taxRate') {
        const quantity = parseFloat(newItems[index].quantity) || 0;
        const price = parseFloat(newItems[index].price) || 0;

        // When useFakturPajak is enabled, prices are tax-inclusive
        // Don't calculate tax per item - tax is calculated at invoice level
        const subtotal = quantity * price;
        
        // Item-level tax is always 0 when useFakturPajak is enabled
        // Tax calculation happens at invoice level
        newItems[index].subtotal = subtotal.toFixed(2);
        newItems[index].tax = "0";
        newItems[index].total = subtotal.toFixed(2);
      }

      return newItems;
    });
  };

  // Handle product selection
  const handleProductSelect = (index: number, productId: number | null, productUnitId?: number | null) => {
    if (!productId || !products) {
      // If null is passed, clear the item's product-related fields
      if (productId === null) {
        const updatedItem: InvoiceItem = {
          ...items[index],
          description: "",
          price: "0",
          taxRate: "0",
          subtotal: "0",
          tax: "0",
          total: "0",
          productId: null,
          productUnitId: null,
        };
        updateItem(index, 'description', ''); // Clear description too
        setItems(prevItems => {
          const newItems = [...prevItems];
          newItems[index] = updatedItem;
          return newItems;
        });
      }
      return;
    }


    const product = products.find(p => p.id === productId);
    if (!product) {
      console.error(`Product with id ${productId} not found`);
      return;
    }

    try {
      const quantity = items[index].quantity || "1";
      // Use currentSellingPrice if available, otherwise fall back to price
      const price = (product.currentSellingPrice || product.price || "0").toString();
      const taxRate = "0"; // Tax is calculated at invoice level, not per item
      const subtotal = (parseFloat(quantity) * parseFloat(price)).toFixed(2);
      // Item-level tax is always 0 - tax calculation happens at invoice level when useFakturPajak is enabled
      const tax = "0";
      const total = subtotal; // Total = subtotal since tax is calculated at invoice level

      const updatedItem: InvoiceItem = {
        ...items[index],
        description: product.name || `Product ${productId}`,
        price,
        taxRate,
        subtotal,
        tax,
        total,
        productId,
        productUnitId: productUnitId ?? null
      };

      console.log('Setting item at index', index, ':', updatedItem);
      
      // Update the items state with the complete updated item
      setItems(prevItems => {
        const newItems = [...prevItems];
        newItems[index] = updatedItem;
        return newItems;
      });

    } catch (error) {
      console.error("Error updating item:", error);
      toast({
        title: "Error",
        description: "Failed to update item with product data",
        variant: "destructive",
      });
    }
  };

  // Payment handlers
  const handleAddPayment = () => {
    if (!invoiceId) {
      toast({
        title: "Info",
        description: "Please save the invoice first before adding payments",
        variant: "default",
      });
      return;
    }
    setEditingPayment(null);
    setPaymentForm({ paymentDate: format(new Date(), 'yyyy-MM-dd'), paymentType: 'Cash', amount: '', notes: '', creditNoteId: null });
    setPaymentDialogOpen(true);
  };

  const handleEditPayment = (payment: InvoicePayment) => {
    setEditingPayment(payment);
    setPaymentForm({
      paymentDate: payment.paymentDate,
      paymentType: payment.paymentType,
      amount: payment.amount,
      notes: payment.notes || ''
    });
    setPaymentDialogOpen(true);
  };

  const handleDeletePayment = (paymentId: number) => {
    if (confirm('Are you sure you want to delete this payment?')) {
      deletePaymentMutation.mutate(paymentId);
    }
  };

  const handlePaymentSubmit = async () => {
    const paymentData = {
      paymentDate: paymentForm.paymentDate,
      paymentType: paymentForm.paymentType,
      amount: paymentForm.amount,
      notes: paymentForm.notes
    };

    if (editingPayment) {
      updatePaymentMutation.mutate({ id: editingPayment.id, payment: paymentData });
    } else {
      // For credit note payments, we need to also apply the credit note
      if (paymentForm.paymentType === 'Credit Note' && paymentForm.creditNoteId) {
        try {
          // First create the payment
          const paymentResponse = await apiRequest('POST', `/api/invoices/${invoiceId}/payments`, paymentData);
          const newPayment = await paymentResponse.json();
          
          // Then apply the credit note to the payment
          await apiRequest('POST', `/api/returns/${paymentForm.creditNoteId}/apply-to-payment`, {
            invoicePaymentId: newPayment.id,
            amount: parseFloat(paymentForm.amount)
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId, 'payments'] });
          queryClient.invalidateQueries({ queryKey: ['/api/invoices', invoiceId] });
          queryClient.invalidateQueries({ queryKey: ['/api/clients', watchedClientId, 'credit-notes'] });
          toast({ title: "Success", description: "Credit note applied to payment" });
          setPaymentDialogOpen(false);
          setPaymentForm({ paymentDate: format(new Date(), 'yyyy-MM-dd'), paymentType: 'Cash', amount: '', notes: '', creditNoteId: null });
        } catch (error: any) {
          toast({ title: "Error", description: `Failed to apply credit note: ${error.message}`, variant: "destructive" });
        }
      } else {
        createPaymentMutation.mutate(paymentData);
      }
    }
  };

  // Submit the form
  const onSubmit = (values: InvoiceFormValues) => {
    if (!values.invoice.clientId || values.invoice.clientId === 0) {
      toast({
        title: "Client belum dipilih",
        description: "Pilih client terlebih dahulu sebelum menyimpan invoice.",
        variant: "destructive",
      });
      return;
    }
    // Block submit if any item has invalid price (below lowest price without permission)
    const hasInvalidPrice = Object.values(itemPriceValidity).some(v => v === false);
    if (hasInvalidPrice) {
      toast({
        title: "Harga tidak valid",
        description: "Satu atau lebih item memiliki harga di bawah minimum dan Anda tidak memiliki izin untuk menetapkan harga tersebut.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(values);
  };

  // Save as draft or send the invoice
  const saveAsDraft = () => {
    form.setValue('invoice.status', 'draft');
    form.handleSubmit(onSubmit)();
  };

  const saveAndSend = async () => {
    try {
      console.log('=== SAVE AND SEND CALLED ===');

      // Use state items instead of form values since state is updated in real-time
      console.log('Items from state:', JSON.stringify(items, null, 2));
      console.log('Number of items:', items.length);

      // Filter out empty rows (rows with no description)
      const nonEmptyItems = items.filter(item => {
        const hasDescription = item.description && item.description.trim() !== '';
        console.log(`Item description="${item.description}", hasDescription=${hasDescription}`);
        return hasDescription;
      });

      console.log('Non-empty items count:', nonEmptyItems.length);
      console.log('Non-empty items:', JSON.stringify(nonEmptyItems, null, 2));

      // Check if there's at least one item
      if (nonEmptyItems.length === 0) {
        console.log('ERROR: No non-empty items found!');
        toast({
          title: "Please Add Items",
          description: "Add at least one item to the invoice before creating.",
          variant: "destructive",
        });
        return;
      }

      // Validate invoice fields
      const invoiceData = form.getValues('invoice');
      console.log('Client ID:', invoiceData.clientId);

      if (!invoiceData.clientId || invoiceData.clientId === 0) {
        toast({
          title: "Please Select Client",
          description: "Select a client before creating the invoice.",
          variant: "destructive",
        });
        return;
      }

      console.log('Calling mutation directly...');

      // Transform items to match database schema
      const transformedItems = nonEmptyItems.map(item => ({
        productId: item.productId || 0,
        productUnitId: item.productUnitId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.price,
        taxRate: item.taxRate,
        taxAmount: item.tax,
        discount: "0",
        subtotal: item.subtotal,
        totalAmount: item.total
      }));

      // Call mutation directly with validated data
      const formData = {
        invoice: {
          ...invoiceData,
          status: 'sent'
        },
        items: transformedItems
      };

      mutation.mutate(formData);
    } catch (error) {
      console.error('Error in saveAndSend:', error);
      toast({
        title: "Error",
        description: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleBackClick = () => {
    // Check if there are actual meaningful changes (not just empty form)
    const invoiceData = form.getValues('invoice');
    const hasClient = invoiceData.clientId && invoiceData.clientId !== 0;
    const hasNonEmptyItems = items.some(item => item.description && item.description.trim() !== '');
    const hasMeaningfulData = hasClient || hasNonEmptyItems;
    
    // Show confirmation only if there are unsaved changes AND meaningful data entered
    if (hasUnsavedChanges() && hasMeaningfulData) {
      setShowBackConfirmDialog(true);
    } else {
      // Navigate back to invoice list or detail page
      navigate(invoiceId ? `/invoices/${invoiceId}` : '/invoices');
    }
  };

  // Save as draft without navigating away - returns the invoice ID if saved
  const saveDraft = async (): Promise<number | null> => {
    try {
      const invoiceData = form.getValues('invoice');

      // Filter out empty rows (rows with no description)
      const nonEmptyItems = items.filter(item => {
        return item.description && item.description.trim() !== '';
      });

      // For draft, allow saving if there's at least some content (client OR items)
      const hasClient = invoiceData.clientId && invoiceData.clientId !== 0;
      const hasItems = nonEmptyItems.length > 0;

      if (!hasClient && !hasItems) {
        toast({
          title: "Nothing to Save",
          description: "Please add a client or at least one item before saving.",
          variant: "destructive",
        });
        return null;
      }

      // Transform items to match database schema (same as saveAndSend)
      const transformedItems = nonEmptyItems.map(item => ({
        productId: item.productId || 0,
        productUnitId: item.productUnitId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.price,
        taxRate: item.taxRate,
        taxAmount: item.tax,
        discount: "0",
        subtotal: item.subtotal,
        totalAmount: item.total
      }));

      const formData = {
        invoice: {
          ...invoiceData,
          // Use null as clientId if not selected (database allows null for drafts)
          clientId: hasClient ? invoiceData.clientId : null,
          status: 'draft'
        },
        items: transformedItems
      };

      const result = await saveDraftMutation.mutateAsync(formData);
      return result.existingId || result.id || null;
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Error",
        description: `An error occurred while saving: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
      return null;
    }
  };

  // Discard changes and go back
  const discardAndGoBack = () => {
    setShowBackConfirmDialog(false);
    // Navigate back to invoice list or detail page
    navigate(invoiceId ? `/invoices/${invoiceId}` : '/invoices');
  };

  // Save and go back
  const saveAndGoBack = async () => {
    setShowBackConfirmDialog(false);
    const savedId = await saveDraft();
    // Navigate to saved invoice detail or back to list
    if (savedId) {
      navigate(`/invoices/${savedId}`);
    } else {
      navigate('/invoices');
    }
  };

  // Handle invoice PDF generation
  const handleGeneratePDF = async () => {
    if (!form.formState.isValid) {
      form.trigger();
      return;
    }

    const values = form.getValues();

    // Check if clients data is loaded
    if (!clients || !Array.isArray(clients)) {
      toast({
        title: "Error",
        description: "Client data is not available yet. Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    // Find the selected client
    const client = clients.find(c => c.id === values.invoice.clientId);

    if (!client) {
      toast({
        title: "Error",
        description: "Please select a client to generate PDF",
        variant: "destructive",
      });
      return;
    }

    try {
      // Prepare safe data for PDF
      const safeClient = {
        name: client.name || "Client Name",
        email: client.email || "client@example.com",
        phone: client.phone,
        address: client.address,
        taxNumber: client.taxNumber,
      };

      const parseDate = (dateVal: any): Date => {
        if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;
        if (typeof dateVal === 'string' && dateVal) {
          const parsed = new Date(dateVal);
          if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
      };

      const safeInvoice = {
        invoiceNumber: values.invoice.invoiceNumber || `INV-${Date.now()}`,
        issueDate: format(parseDate(values.invoice.issueDate), 'MMM dd, yyyy'),
        dueDate: format(parseDate(values.invoice.dueDate), 'MMM dd, yyyy'),
        status: values.invoice.status || "draft",
        subtotal: values.invoice.subtotal || "0",
        tax: values.invoice.tax || "0",
        discount: values.invoice.discount || "0",
        shipping: values.invoice.shipping || "0",
        total: values.invoice.total || "0",
        notes: values.invoice.notes || '',
        useFakturPajak: values.invoice.useFakturPajak || false,
        taxRate: values.invoice.taxRate || globalTaxRate,
      };

      console.log("Generating PDF with:", { 
        invoice: safeInvoice,
        items: values.items,
        client: safeClient
      });

      await generatePDF({
        invoice: safeInvoice,
        items: values.items || [],
        client: safeClient,
        company: storeData,
        defaultNotes: currentUser?.invoiceNotes || currentUser?.defaultNotes
      });

      toast({
        title: "Success",
        description: "Invoice PDF has been generated",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // If loading invoice data, show loading state
  if (invoiceId && isLoadingInvoice) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="invoice-form">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {invoiceId ? "Edit Invoice" : "Create New Invoice"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {invoiceId ? "Update invoice details" : "Create a new invoice for your client"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleBackClick}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="invoice" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="invoice">Invoice Details</TabsTrigger>
                <TabsTrigger value="payments">
                  Payments {invoiceId && invoicePayments.length > 0 && `(${invoicePayments.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="invoice" className="space-y-6">
                {/* Invoice Details Section */}
                <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Invoice Details</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Invoice Number field - auto-generated for new invoices, display for existing */}
                  <FormItem>
                    <FormLabel>Invoice Number</FormLabel>
                    <FormControl>
                      <Input 
                        value={invoiceId ? (invoiceData?.invoice?.invoiceNumber || "") : (nextInvoiceNumber || generateFallbackInvoiceNumber())}
                        readOnly 
                        className="bg-gray-50 dark:bg-gray-800" 
                        data-testid="input-invoice-number"
                      />
                    </FormControl>
                  </FormItem>

                  <FormField
                    control={form.control}
                    name="invoice.issueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, 'yyyy-MM-dd') : ''} 
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoice.paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Terms</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                          }} 
                          value={field.value || "net_30"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment terms" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentTermsData.filter(term => term.isActive && term.code !== 'custom').map((term) => (
                              <SelectItem key={term.id} value={term.code}>
                                {term.name}{term.days > 0 ? ` (${term.days} Days)` : ''}
                              </SelectItem>
                            ))}
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoice.dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            value={field.value instanceof Date && !isNaN(field.value.getTime()) ? format(field.value, 'yyyy-MM-dd') : ''} 
                            onChange={(e) => {
                              field.onChange(new Date(e.target.value));
                              // If user manually changes due date, switch to custom
                              if (watchPaymentTerms !== 'custom') {
                                form.setValue('invoice.paymentTerms', 'custom');
                              }
                            }}
                            disabled={watchPaymentTerms !== 'custom'}
                            className={watchPaymentTerms !== 'custom' ? 'bg-gray-50 dark:bg-gray-800' : ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Delivery Address Section - auto-filled from client, editable */}
                <div className="mt-4 space-y-4">
                  <FormField
                    control={form.control}
                    name="invoice.deliveryAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alamat Pengiriman</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Alamat pengiriman akan terisi otomatis dari data client..."
                            className="resize-none"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Otomatis dari data client. Ubah jika pengiriman ke alamat berbeda. Pilih ulang client untuk reset.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoice.deliveryAddressLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link Google Maps</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://maps.google.com/..."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Otomatis dari data client. Ubah jika lokasi pengiriman berbeda.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Client Section */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Client Information</h4>

                <div className="mb-4">
                  <FormField
                    control={form.control}
                    name="invoice.clientId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Select Client</FormLabel>
                        <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={clientComboboxOpen}
                                className="w-full justify-between font-normal"
                                data-testid="button-select-client"
                              >
                                {field.value && field.value !== 0
                                  ? (() => {
                                      const client = clients?.find((c: any) => c.id === field.value);
                                      return client ? `${client.clientNumber ? `[${client.clientNumber}] ` : ''}${client.name}` : '';
                                    })()
                                  : "-- Select Client --"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search clients..." data-testid="input-search-client" />
                              <CommandList>
                                <CommandEmpty>No client found.</CommandEmpty>
                                <CommandGroup>
                                  {clients?.map((client: any) => (
                                    <CommandItem
                                      key={client.id}
                                      value={`${client.clientNumber || ''} ${client.name}`}
                                      onSelect={() => {
                                        field.onChange(client.id);
                                        form.setValue('invoice.deliveryAddress', client.address || '');
                                        form.setValue('invoice.deliveryAddressLink', client.addressLink || '');
                                        setClientComboboxOpen(false);
                                      }}
                                      data-testid={`client-option-${client.id}`}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          field.value === client.id ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      {client.clientNumber && <span className="text-gray-500 mr-2">[{client.clientNumber}]</span>}
                                      {client.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Invoice Items</h4>

                <div className="overflow-x-auto mb-4 invoice-table-container">
                  <table className="excel-table min-w-full">
                    <thead>
                      <tr>
                        <th scope="col" className="excel-header-cell text-center" style={{ width: '40px' }}>
                          #
                        </th>
                        <th scope="col" className="excel-header-cell text-left" style={{ width: '40%', minWidth: '220px' }}>
                          Product
                        </th>
                        <th scope="col" className="excel-header-cell text-center" style={{ width: '65px' }}>
                          Unit
                        </th>
                        <th scope="col" className="excel-header-cell text-right" style={{ width: '65px' }}>
                          Qty
                        </th>
                        <th scope="col" className="excel-header-cell text-right" style={{ width: '120px' }}>
                          Unit Price
                        </th>
                        <th scope="col" className="excel-header-cell text-right" style={{ width: '150px' }}>
                          Total
                        </th>
                        <th scope="col" className="excel-header-cell text-center" style={{ width: '50px' }}>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Only render items when not loading in edit mode */}
                      {(invoiceId && isLoadingInvoice) ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                            Loading items...
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                            No items yet. Click "Add New Row" to add items.
                          </td>
                        </tr>
                      ) : items.map((item, index) => (
                        <InvoiceItemRow
                          key={item.id ? `item-${item.id}` : `new-${index}`}
                          index={index}
                          item={item}
                          products={(products || []).filter(p => p.isActive !== false)}
                          updateItem={(idx, updatedItem) => {
                            setItems(prevItems => {
                              const newItems = [...prevItems];
                              newItems[idx] = updatedItem;
                              return newItems;
                            });
                          }}
                          removeItem={removeItem}
                          onProductSelect={handleProductSelect}
                          disabled={!!hasActiveDeliveryNotes}
                          canOverrideLowestPrice={canOverrideLowestPrice}
                          onPriceValidationChange={(idx, isValid) => {
                            setItemPriceValidity(prev => ({ ...prev, [idx]: isValid }));
                          }}
                        />
                      ))}
                      {/* Add row button inside the table */}
                      {!hasActiveDeliveryNotes && (
                        <tr>
                          <td colSpan={7} className="px-3 py-2 border-t border-gray-200">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={addItem}
                              className="w-full text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <Plus className="h-4 w-4 mr-1.5" />
                              <span>Add New Row</span>
                            </Button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Section */}
              <div className="border-t border-gray-200 pt-4">
                <div className="sm:w-1/2 ml-auto">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Subtotal:</span>
                      <span className="text-gray-900">{formatCurrency(parseFloat(form.watch('invoice.subtotal') || '0'))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Discount:</span>
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="invoice.discount"
                          render={({ field }) => (
                            <FormItem className="w-28">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="text-right h-8"
                                  onChange={(e) => {
                                    const value = Math.floor(parseFloat(e.target.value) || 0);
                                    field.onChange(value.toString());
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-gray-900">-{formatCurrency(parseFloat(form.watch('invoice.discount') || '0'))}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Biaya Pengiriman:</span>
                      <div className="flex items-center space-x-2">
                        <FormField
                          control={form.control}
                          name="invoice.shipping"
                          render={({ field }) => (
                            <FormItem className="w-28">
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number"
                                  min="0"
                                  step="1"
                                  className="text-right h-8"
                                  onChange={(e) => {
                                    const value = Math.floor(parseFloat(e.target.value) || 0);
                                    field.onChange(value.toString());
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <span className="text-gray-900">+{formatCurrency(parseFloat(form.watch('invoice.shipping') || '0'))}</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                      <span className="font-semibold text-gray-900">Total:</span>
                      <span className="font-bold text-gray-900">{formatCurrency(parseFloat(form.watch('invoice.total') || '0'))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <FormField
                  control={form.control}
                  name="invoice.notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          rows={3}
                          placeholder="Payment terms, conditions, or additional information..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </TabsContent>

              <TabsContent value="payments" className="space-y-4">
                {!invoiceId ? (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-700 mb-2">Save Invoice First</p>
                    <p className="text-sm">You need to save this invoice before you can record payments.</p>
                    <p className="text-sm">Click "Create Invoice" or "Update Invoice" to save your changes.</p>
                  </div>
                ) : (
                  <>
                    {/* Payment Summary Infographic */}
                    {(() => {
                      const invoiceTotal = parseFloat(form.watch('invoice.total') || '0');
                      const totalPaid = invoicePayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
                      const remaining = invoiceTotal - totalPaid;
                      const paymentProgress = invoiceTotal > 0 ? (totalPaid / invoiceTotal) * 100 : 0;
                      const isFullyPaid = remaining <= 0;
                      
                      return (
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <h4 className="text-lg font-medium mb-3">Payment Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Invoice Total</span>
                              <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Paid</span>
                              <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Remaining</span>
                              <span className={`font-semibold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {formatCurrency(Math.max(0, remaining))}
                              </span>
                            </div>
                            <Progress value={Math.min(100, paymentProgress)} className="h-2 mt-2" />
                          </div>
                          {isFullyPaid ? (
                            <div className="mt-3 p-2 bg-green-100 text-green-800 rounded text-sm text-center">
                              <CheckCircle className="h-4 w-4 inline mr-2" />
                              Fully Paid
                            </div>
                          ) : totalPaid > 0 ? (
                            <div className="mt-3 p-2 bg-orange-100 text-orange-800 rounded text-sm text-center">
                              <DollarSign className="h-4 w-4 inline mr-2" />
                              Partially Paid ({Math.round(paymentProgress)}%)
                            </div>
                          ) : (
                            <div className="mt-3 p-2 bg-red-100 text-red-800 rounded text-sm text-center">
                              <DollarSign className="h-4 w-4 inline mr-2" />
                              Unpaid
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-lg font-medium text-gray-900">Payment Records</h4>
                      <Button
                        type="button"
                        onClick={handleAddPayment}
                        size="sm"
                        data-testid="button-add-payment"
                      >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Payment
                      </Button>
                    </div>

                    {invoicePayments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No payments recorded yet</p>
                        <p className="text-sm">Click "Add Payment" to record a payment</p>
                      </div>
                    ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {invoicePayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {format(new Date(payment.paymentDate), 'MMM dd, yyyy')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{payment.paymentType}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                              {formatCurrency(parseFloat(payment.amount))}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{payment.notes || '-'}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPayment(payment)}
                                className="mr-1"
                                data-testid={`button-edit-payment-${payment.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePayment(payment.id)}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-payment-${payment.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                    {/* Payment Dialog */}
                    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingPayment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                        <Input
                          type="date"
                          value={paymentForm.paymentDate}
                          onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                          data-testid="input-payment-date"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
                        <Select
                          value={paymentForm.paymentType}
                          onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentType: value, creditNoteId: null, amount: '' })}
                        >
                          <SelectTrigger data-testid="select-payment-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            {clientCreditNotes.length > 0 && (
                              <SelectItem value="Credit Note">Credit Note</SelectItem>
                            )}
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {paymentForm.paymentType === 'Credit Note' && clientCreditNotes.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Select Credit Note</label>
                          <Select
                            value={paymentForm.creditNoteId?.toString() || ''}
                            onValueChange={(value) => {
                              const selectedCN = clientCreditNotes.find(cn => cn.id === parseInt(value));
                              setPaymentForm({ 
                                ...paymentForm, 
                                creditNoteId: parseInt(value),
                                amount: selectedCN ? selectedCN.remainingBalance.toString() : ''
                              });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih credit note..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clientCreditNotes.map((cn) => (
                                <SelectItem key={cn.id} value={cn.id.toString()}>
                                  {cn.returnNumber} - Saldo: {formatCurrency(cn.remainingBalance)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          placeholder="0.00"
                          data-testid="input-payment-amount"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <Textarea
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                          rows={2}
                          placeholder="Optional notes..."
                          data-testid="input-payment-notes"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPaymentDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handlePaymentSubmit}
                        disabled={createPaymentMutation.isPending || updatePaymentMutation.isPending}
                        data-testid="button-save-payment"
                      >
                        {editingPayment ? 'Update Payment' : 'Add Payment'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                  </>
                )}
              </TabsContent>
            </Tabs>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                saveAndSend();
              }}
              disabled={mutation.isPending || saveDraftMutation.isPending}
            >
              <Check className="mr-1.5 h-4 w-4" />
              <span>{invoiceId || savedInvoiceId ? 'Update' : 'Create'}</span>
            </Button>
          </div>

          {/* Back confirmation dialog */}
          <AlertDialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Perubahan Belum Disimpan</AlertDialogTitle>
                <AlertDialogDescription>
                  Anda memiliki perubahan yang belum disimpan. Apakah Anda ingin menyimpan sebelum keluar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel onClick={() => setShowBackConfirmDialog(false)}>
                  Batal
                </AlertDialogCancel>
                <Button variant="destructive" onClick={discardAndGoBack}>
                  Buang Perubahan
                </Button>
                <AlertDialogAction onClick={saveAndGoBack}>
                  Simpan & Keluar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </form>
      </Form>
      <UnsavedChangesDialog open={showNavGuardDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
}