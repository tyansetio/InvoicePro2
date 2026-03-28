import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Edit, Ban, FileDown, Send, X, AlertTriangle, ArrowLeft, Plus, Trash2, Printer, Truck, Package, Pencil, CheckCircle, DollarSign, ExternalLink, RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generatePDF } from "@/lib/pdf-generator";
import { logPrint } from "@/lib/activity-log";
import { formatDate, formatCurrency, formatCurrencyAccounting, formatQuantity } from "@/lib/utils";
import type { Invoice, InvoiceItem, Client, PaymentType, DeliveryNote, Return, PrintSettings } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from '@/lib/store-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InvoiceDetailProps {
  id: number;
}

interface InvoiceDetailResponse {
  invoice: Invoice;
  items: InvoiceItem[];
  client?: Client;
}

export default function InvoiceDetailPage({
 id }: InvoiceDetailProps) {
  const { currentStoreId } = useStore();

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentType: 'Cash',
    amount: '',
    notes: '',
    creditNoteId: null as number | null,
  });

  const { data: invoiceData, isLoading, error } = useQuery<InvoiceDetailResponse>({
    queryKey: ['/api/invoices', id],
  });

  const { data: paymentsData } = useQuery<any[]>({
    queryKey: ['/api/invoices', id, 'payments'],
  });

  // Fetch store-specific print settings (for document notes)
  const { data: storePrintSettings } = useQuery<PrintSettings>({
    queryKey: [`/api/stores/${currentStoreId}/print-settings`],
  });

  // Fetch current user for company information
  const { data: currentUser } = useQuery<{
    companyName?: string;
    companyTagline?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    taxNumber?: string;
    logoUrl?: string;
    quotationNotes?: string;
    invoiceNotes?: string;
    deliveryNoteNotes?: string;
    defaultNotes?: string;
    role?: string;
    permissions?: string[];
  }>({
    queryKey: ['/api/user'],
  });

  // Fetch payment types from settings
  const { data: paymentTypes } = useQuery<PaymentType[]>({
    queryKey: [`/api/stores/${currentStoreId}/payment-types`],
  });

  // Fetch client credit notes for payment options
  type CreditNoteWithBalance = Return & { remainingBalance: number };
  const clientId = invoiceData?.invoice?.clientId;
  const { data: clientCreditNotes = [], refetch: refetchCreditNotes } = useQuery<CreditNoteWithBalance[]>({
    queryKey: ['/api/clients', clientId, 'credit-notes'],
    enabled: !!clientId && clientId !== 0,
    staleTime: 0, // Always refetch to get latest credit notes
  });

  const { data: clientDepositData } = useQuery<{ balance: number }>({
    queryKey: ['/api/clients', clientId, 'deposit-balance'],
    enabled: !!clientId && clientId !== 0,
    staleTime: 0,
  });
  const clientDepositBalance = clientDepositData?.balance || 0;

  // Fetch delivery notes for this invoice
  const { data: deliveryNotes } = useQuery<DeliveryNote[]>({
    queryKey: ['/api/invoices', id, 'delivery-notes'],
  });

  // Fetch delivery status for this invoice
  const { data: deliveryStatus } = useQuery<{
    orderedItems: { invoiceItemId: number; description: string; quantity: number; delivered: number; remaining: number }[];
    fullyDelivered: boolean;
  }>({
    queryKey: ['/api/invoices', id, 'delivery-status'],
  });

  // Fetch returns related to this invoice
  const { data: relatedReturns = [] } = useQuery<any[]>({
    queryKey: ['/api/invoices', id, 'returns'],
  });

  // Business rule settings
  const { data: storeSettings } = useQuery<Record<string, string>>({
    queryKey: [`/api/stores/${currentStoreId}/settings`],
  });
  const requirePaymentBeforePrint = storeSettings?.require_payment_before_delivery_print === 'true';
  const lockPaidInvoices = storeSettings?.lock_paid_invoices === 'true';

  // Fetch store details (name, address, tagline, etc.)
  const { data: currentStore } = useQuery<any>({
    queryKey: [`/api/stores/${currentStoreId}`],
    enabled: !!currentStoreId,
  });

  // Permission helpers
  const isOwner = currentUser?.role === 'owner';
  const canManagePayments = isOwner || (currentUser?.permissions?.includes('payments.manage') ?? false);
  const canPrintDelivery = isOwner || (currentUser?.permissions?.includes('delivery_notes.print') ?? false);
  const canUpdateDeliveryStatus = isOwner || (currentUser?.permissions?.includes('delivery_notes.update_status') ?? false);

  // State for delivery note dialog
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryDate: format(new Date(), 'yyyy-MM-dd'),
    deliveryType: 'delivered' as 'delivered' | 'self_pickup',
    vehicleInfo: '',
    driverName: '',
    recipientName: '',
    notes: '',
    items: [] as { invoiceItemId: number; deliveredQuantity: string; remarks: string }[]
  });

  // State for editing delivery note
  const [editDeliveryDialogOpen, setEditDeliveryDialogOpen] = useState(false);
  const [editingDeliveryNote, setEditingDeliveryNote] = useState<DeliveryNote | null>(null);
  const [editDeliveryItems, setEditDeliveryItems] = useState<{ invoiceItemId: number; description: string; deliveredQuantity: string; maxQuantity: number }[]>([]);
  const [editDeliveryForm, setEditDeliveryForm] = useState({
    deliveryDate: '',
    deliveryType: 'delivered' as 'delivered' | 'self_pickup',
    vehicleInfo: '',
    driverName: '',
    recipientName: '',
    notes: ''
  });

  const invoice = invoiceData?.invoice;
  const items = invoiceData?.items || [];
  const client = invoiceData?.client;
  const invoicePayments = paymentsData || [];

  // ==================== PRINT PAGINATION LOGIC ====================
  // All measurements in cm, based on print template CSS
  // These values are calibrated for 24cm x 14cm landscape paper (PRS half-size)
  const PRINT_CONSTANTS = {
    PAGE_HEIGHT: 14,           // Total page height in cm
    PAGE_PADDING_TOP: 0.5,     // Top padding
    PAGE_PADDING_BOTTOM: 0.3,  // Bottom padding
    HEADER_HEIGHT: 3.8,        // Header section (logo 2.2cm + company info + bill to with address)
    TABLE_HEADER_HEIGHT: 0.7,  // Table thead height
    ITEM_ROW_HEIGHT: 0.7,      // Height per item row
    FOOTER_BASE_HEIGHT: 2.8,   // Base footer height (notes + subtotal + total with borders)
    FOOTER_ROW_HEIGHT: 0.4,    // Additional height per extra footer row (discount, shipping, tax)
    TABLE_MARGIN: 0.3,         // Margin between table and footer
    SAFETY_MARGIN: 0.3,        // Safety buffer to prevent footer from being cut off
  };

  // Calculate dynamic footer height based on invoice data
  const calculateFooterHeight = useMemo(() => {
    if (!invoice) return PRINT_CONSTANTS.FOOTER_BASE_HEIGHT;
    
    let height = PRINT_CONSTANTS.FOOTER_BASE_HEIGHT;
    
    // Add height for discount row if present
    if (parseFloat(invoice.discount || '0') > 0) {
      height += PRINT_CONSTANTS.FOOTER_ROW_HEIGHT;
    }
    
    // Add height for shipping row if present
    if ((invoice as any).shipping && parseFloat((invoice as any).shipping) > 0) {
      height += PRINT_CONSTANTS.FOOTER_ROW_HEIGHT;
    }
    
    return height;
  }, [invoice]);

  // Calculate max items per page
  const calculateMaxItems = (hasFooter: boolean) => {
    const contentHeight = PRINT_CONSTANTS.PAGE_HEIGHT - PRINT_CONSTANTS.PAGE_PADDING_TOP - PRINT_CONSTANTS.PAGE_PADDING_BOTTOM;
    const headerSpace = PRINT_CONSTANTS.HEADER_HEIGHT + PRINT_CONSTANTS.TABLE_HEADER_HEIGHT;
    
    let availableSpace = contentHeight - headerSpace - PRINT_CONSTANTS.SAFETY_MARGIN;
    
    if (hasFooter) {
      availableSpace -= calculateFooterHeight + PRINT_CONSTANTS.TABLE_MARGIN;
    }
    
    return Math.floor(availableSpace / PRINT_CONSTANTS.ITEM_ROW_HEIGHT);
  };

  // Paginate items into pages
  const paginatedItems = useMemo(() => {
    if (!items.length) return [{ items: [], isLastPage: true }];
    
    const maxItemsWithFooter = calculateMaxItems(true);
    const maxItemsWithoutFooter = calculateMaxItems(false);
    
    // Special case: all items fit on one page with footer
    if (items.length <= maxItemsWithFooter) {
      return [{ items: [...items], isLastPage: true }];
    }
    
    // Multiple pages needed - maximize items on earlier pages (without footer)
    // Last page has footer with remaining items
    const pages: { items: typeof items; isLastPage: boolean }[] = [];
    let remainingItems = [...items];
    
    while (remainingItems.length > 0) {
      // Check if remaining items fit on one page with footer (this becomes the last page)
      if (remainingItems.length <= maxItemsWithFooter) {
        pages.push({ items: remainingItems, isLastPage: true });
        break;
      }
      
      // Not the last page yet - maximize items on this page (no footer)
      // But ensure at least 1 item remains for the last page with footer
      const itemsToTake = Math.min(maxItemsWithoutFooter, remainingItems.length - 1);
      pages.push({ 
        items: remainingItems.slice(0, itemsToTake), 
        isLastPage: false 
      });
      remainingItems = remainingItems.slice(itemsToTake);
    }
    
    return pages;
  }, [items, calculateFooterHeight]);

  const totalPages = paginatedItems.length;
  // ==================== END PRINT PAGINATION LOGIC ====================

  // Helper function to get default payment type from settings
  const getDefaultPaymentType = () => {
    const activePaymentTypes = paymentTypes?.filter(pt => pt.isActive) || [];
    return activePaymentTypes.length > 0 ? activePaymentTypes[0].name : 'Cash';
  };

  // Void invoice mutation (replaces delete - invoices should never be deleted, only voided)
  const voidMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/invoices/${id}/void`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || 'Gagal void invoice');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`] });
      toast({
        title: "Invoice di-void",
        description: "Invoice berhasil di-void.",
      });
    },
    onError: (error: Error) => {
      let msg = error.message || '';
      try {
        const jsonPart = msg.substring(msg.indexOf('{'));
        const parsed = JSON.parse(jsonPart);
        msg = parsed.message || parsed.error || msg;
      } catch {}
      toast({
        title: "Tidak dapat void invoice",
        description: msg,
        variant: "destructive",
      });
    }
  });

  // Update invoice status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest('PATCH', `/api/invoices/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`] });
      toast({
        title: "Status updated",
        description: "The invoice status has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update status: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update invoice delivery type mutation
  const updateDeliveryTypeMutation = useMutation({
    mutationFn: async (deliveryType: string) => {
      return apiRequest('PUT', `/api/invoices/${id}/delivery-type`, { deliveryType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      toast({
        title: "Tipe pengiriman diperbarui",
        description: "Tipe pengiriman invoice berhasil diubah.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal mengubah tipe pengiriman",
        variant: "destructive",
      });
    }
  });

  // Generate PDF
  const handleDownloadPDF = async () => {
    if (!invoice) return;
    
      try {
      await generatePDF({
        invoice: {
          ...invoice,
          issueDate: formatDate(invoice.issueDate),
          dueDate: formatDate(invoice.dueDate),
          tax: invoice.taxAmount || '0',
          total: invoice.totalAmount,
          discount: invoice.discount || '0'
        },
        items: items.map(item => ({
          ...item,
          price: item.unitPrice
        })) as any,
        client: client as any,
        company: currentStore,
        defaultNotes: storePrintSettings?.invoiceNotes || storePrintSettings?.defaultNotes
      });
      
      toast({
        title: "Success",
        description: "Invoice PDF has been generated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  // Send invoice (change status to sent)
  const handleSendInvoice = () => {
    updateStatusMutation.mutate('sent');
  };

  // Void invoice
  const handleVoidInvoice = () => {
    updateStatusMutation.mutate('void');
  };

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/invoices/${id}/payments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'payments'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`], refetchType: 'all' });
      if (invoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/stores/${invoice.storeId}/transactions`], refetchType: 'all' });
      }
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'deposit-balance'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'deposits'], refetchType: 'all' });
      }
      setPaymentDialogOpen(false);
      setPaymentForm({
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        paymentType: getDefaultPaymentType(),
        amount: '',
        notes: '',
        creditNoteId: null,
      });
      refetchCreditNotes();
      toast({
        title: "Success",
        description: "Payment added successfully.",
      });
    },
    onError: (error) => {
      let errorMsg = error.message;
      try {
        const jsonPart = errorMsg.substring(errorMsg.indexOf('{'));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) errorMsg = parsed.error;
      } catch {}
      toast({
        title: "Pembayaran Gagal",
        description: errorMsg,
        variant: "destructive",
      });
    }
  });

  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/invoices/${id}/payments/${editingPayment.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'payments'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`], refetchType: 'all' });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      setPaymentForm({
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        paymentType: getDefaultPaymentType(),
        amount: '',
        notes: '',
        creditNoteId: null,
      });
      // Refetch credit notes to update balances
      refetchCreditNotes();
      toast({
        title: "Success",
        description: "Payment updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update payment: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      return apiRequest('DELETE', `/api/invoices/${id}/payments/${paymentId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'payments'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`], refetchType: 'all' });
      if (invoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/stores/${invoice.storeId}/transactions`], refetchType: 'all' });
      }
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'deposit-balance'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'deposits'], refetchType: 'all' });
      }
      toast({
        title: "Success",
        description: "Payment deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete payment: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Refund overpayment state
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAction, setRefundAction] = useState<'refund' | 'deposit'>('refund');
  const [refundForm, setRefundForm] = useState({
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentType: 'Cash',
    amount: '',
    notes: '',
  });

  const refundMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = refundAction === 'deposit' 
        ? `/api/invoices/${id}/deposit` 
        : `/api/invoices/${id}/refund`;
      return apiRequest('POST', endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'payments'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`], refetchType: 'all' });
      if (invoice) {
        queryClient.invalidateQueries({ queryKey: [`/api/stores/${invoice.storeId}/transactions`], refetchType: 'all' });
      }
      if (invoice?.clientId) {
        queryClient.invalidateQueries({ queryKey: ['/api/clients', invoice.clientId, 'deposit-balance'], refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', invoice.clientId, 'deposits'], refetchType: 'all' });
      }
      setRefundDialogOpen(false);
      toast({
        title: "Success",
        description: refundAction === 'deposit' 
          ? "Overpayment deposited to client balance successfully."
          : "Refund processed successfully. An expense transaction has been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to process: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Create delivery note mutation
  const createDeliveryNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/invoices/${id}/delivery-notes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-status'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/delivery-notes`] });
      setDeliveryDialogOpen(false);
      resetDeliveryForm();
      toast({
        title: "Success",
        description: "Delivery note created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create delivery note: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Delete delivery note mutation
  const deleteDeliveryNoteMutation = useMutation({
    mutationFn: async (deliveryNoteId: number) => {
      return apiRequest('DELETE', `/api/delivery-notes/${deliveryNoteId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-status'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/delivery-notes`] });
      toast({
        title: "Success",
        description: "Delivery note deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete delivery note: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const markDeliveredMutation = useMutation({
    mutationFn: async (deliveryNoteId: number) => {
      return apiRequest('PATCH', `/api/delivery-notes/${deliveryNoteId}/status`, { status: 'delivered' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/delivery-notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      toast({
        title: "Status diperbarui",
        description: "Surat jalan berhasil ditandai sebagai Delivered.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Gagal mengubah status: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update delivery note mutation
  const updateDeliveryNoteMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<typeof editDeliveryForm> }) => {
      return apiRequest('PUT', `/api/delivery-notes/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-status'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/delivery-notes`] });
      setEditDeliveryDialogOpen(false);
      setEditingDeliveryNote(null);
      toast({
        title: "Success",
        description: "Delivery note updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update delivery note: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Update delivery note items mutation (for pending delivery notes)
  const updateDeliveryNoteItemsMutation = useMutation({
    mutationFn: async (data: { id: number; items: { invoiceItemId: number; deliveredQuantity: number }[] }) => {
      return apiRequest('PUT', `/api/delivery-notes/${data.id}/items`, { items: data.items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-status'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/delivery-notes`] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update delivery note items: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const resetDeliveryForm = () => {
    setDeliveryForm({
      deliveryDate: format(new Date(), 'yyyy-MM-dd'),
      deliveryType: 'delivered',
      vehicleInfo: '',
      driverName: '',
      recipientName: '',
      notes: '',
      items: []
    });
  };

  const initializeDeliveryForm = () => {
    if (deliveryStatus?.orderedItems) {
      const itemsWithRemaining = deliveryStatus.orderedItems
        .filter(item => item.remaining > 0)
        .map(item => ({
          invoiceItemId: item.invoiceItemId,
          deliveredQuantity: item.remaining.toString(),
          remarks: ''
        }));
      setDeliveryForm(prev => ({
        ...prev,
        deliveryType: 'delivered',
        items: itemsWithRemaining
      }));
    }
    setDeliveryDialogOpen(true);
  };

  const handleDeliverySubmit = () => {
    const itemsToDeliver = deliveryForm.items.filter(
      item => parseFloat(item.deliveredQuantity) > 0
    );

    if (itemsToDeliver.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one item to deliver",
        variant: "destructive",
      });
      return;
    }

    const data = {
      deliveryNote: {
        storeId: invoice?.storeId || 1,
        invoiceId: id,
        deliveryDate: deliveryForm.deliveryDate,
        deliveryType: deliveryForm.deliveryType,
        vehicleInfo: deliveryForm.vehicleInfo || null,
        driverName: deliveryForm.driverName || null,
        recipientName: deliveryForm.recipientName || null,
        notes: deliveryForm.notes || null,
      },
      items: itemsToDeliver.map(item => ({
        invoiceItemId: item.invoiceItemId,
        deliveredQuantity: item.deliveredQuantity,
        remarks: item.remarks || null
      }))
    };

    createDeliveryNoteMutation.mutate(data);
  };

  const handleEditDeliveryNote = async (dn: DeliveryNote) => {
    setEditingDeliveryNote(dn);
    setEditDeliveryForm({
      deliveryDate: format(new Date(dn.deliveryDate), 'yyyy-MM-dd'),
      deliveryType: (dn.deliveryType as 'delivered' | 'self_pickup') || 'delivered',
      vehicleInfo: dn.vehicleInfo || '',
      driverName: dn.driverName || '',
      recipientName: dn.recipientName || '',
      notes: dn.notes || ''
    });

    // If status is pending, fetch items for editing
    if (dn.status === 'pending') {
      try {
        const response = await fetch(`/api/delivery-notes/${dn.id}`, { credentials: 'include' });
        const data = await response.json();
        if (data.items) {
          // Build list of all invoice items with their current delivery quantities
          const allItems = items.map(item => {
            const dnItem = data.items.find((di: any) => di.invoiceItemId === item.id);
            const statusItem = deliveryStatus?.orderedItems.find(oi => oi.invoiceItemId === item.id);
            // Max quantity is: remaining (not yet delivered) + current delivery quantity
            const currentDeliveredQty = dnItem ? parseFloat(dnItem.deliveredQuantity) : 0;
            const remainingFromOtherDN = statusItem?.remaining || 0;
            return {
              invoiceItemId: item.id,
              description: item.description,
              deliveredQuantity: currentDeliveredQty.toString(),
              maxQuantity: remainingFromOtherDN + currentDeliveredQty
            };
          });
          setEditDeliveryItems(allItems);
        }
      } catch (error) {
        console.error('Error fetching delivery note items:', error);
      }
    } else {
      setEditDeliveryItems([]);
    }

    setEditDeliveryDialogOpen(true);
  };

  const handleUpdateDeliveryNote = async () => {
    if (!editingDeliveryNote) return;
    
    try {
      // Update metadata first
      await apiRequest('PUT', `/api/delivery-notes/${editingDeliveryNote.id}`, editDeliveryForm);
      
      // If pending and items have been edited, update items
      if (editingDeliveryNote.status === 'pending' && editDeliveryItems.length > 0) {
        const itemsToUpdate = editDeliveryItems
          .filter(item => parseFloat(item.deliveredQuantity) > 0)
          .map(item => ({
            invoiceItemId: item.invoiceItemId,
            deliveredQuantity: parseFloat(item.deliveredQuantity)
          }));
        
        if (itemsToUpdate.length > 0) {
          await apiRequest('PUT', `/api/delivery-notes/${editingDeliveryNote.id}/items`, { items: itemsToUpdate });
        }
      }
      
      // Both succeeded - invalidate and close
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', id, 'delivery-status'] });
      setEditDeliveryDialogOpen(false);
      setEditingDeliveryNote(null);
      toast({
        title: "Success",
        description: "Delivery note updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update delivery note: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handlePrintDeliveryNote = async (deliveryNote: DeliveryNote) => {
    // Check payment requirement before printing
    if (requirePaymentBeforePrint && invoicePayments.length === 0) {
      toast({
        title: "Tidak dapat mencetak",
        description: "Harus ada setidaknya satu pembayaran sebelum mencetak surat jalan.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await fetch(`/api/delivery-notes/${deliveryNote.id}`, {
        credentials: 'include'
      });
      const dnData = await response.json();
      
      // Create hidden iframe for printing
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      printFrame.style.left = '-9999px';
      document.body.appendChild(printFrame);

      const accentColor = '#000';
      const items = dnData.items || [];
      
      // Pagination constants for 24cm x 14cm paper
      const MAX_ITEMS_WITHOUT_FOOTER = 13;
      const MAX_ITEMS_WITH_FOOTER = 8;
      
      // Calculate pages using similar logic to invoice template
      const pages: { items: any[], isLastPage: boolean, startIndex: number }[] = [];
      const totalItems = items.length;
      
      if (totalItems === 0) {
        pages.push({ items: [], isLastPage: true, startIndex: 0 });
      } else if (totalItems <= MAX_ITEMS_WITH_FOOTER) {
        // All items fit on one page with footer
        pages.push({ items: [...items], isLastPage: true, startIndex: 0 });
      } else {
        // Need multiple pages - maximize items on early pages, reserve space for footer on last page
        let remaining = [...items];
        let runningIndex = 0;
        
        while (remaining.length > 0) {
          if (remaining.length <= MAX_ITEMS_WITH_FOOTER) {
            // Last page with footer
            pages.push({ 
              items: remaining, 
              isLastPage: true, 
              startIndex: runningIndex 
            });
            break;
          } else if (remaining.length <= MAX_ITEMS_WITHOUT_FOOTER) {
            // Items fit on this page but need to check if footer fits
            // Put all on this page without footer, then empty page with footer
            pages.push({ 
              items: remaining, 
              isLastPage: true, 
              startIndex: runningIndex 
            });
            break;
          } else {
            // Fill this page with max items (no footer)
            const pageItems = remaining.slice(0, MAX_ITEMS_WITHOUT_FOOTER);
            pages.push({ 
              items: pageItems, 
              isLastPage: false, 
              startIndex: runningIndex 
            });
            runningIndex += pageItems.length;
            remaining = remaining.slice(MAX_ITEMS_WITHOUT_FOOTER);
          }
        }
      }
      
      const totalPages = pages.length;
      
      // Generate header HTML function
      const generateHeader = (pageIdx: number) => `
        <div class="print-header">
          <div class="print-header-left">
            <div class="print-logo">
              ${currentStore?.logoUrl 
                ? `<img src="${currentStore.logoUrl}" alt="Logo" class="print-logo-image" />`
                : `<div class="print-logo-circle">${(currentStore?.name || 'CO').substring(0, 2).toUpperCase()}</div>`
              }
            </div>
            <div class="print-bill-to">
              <div class="print-bill-to-label">Kepada</div>
              <div class="print-bill-to-name">${client?.name || 'N/A'}</div>
              <div class="print-bill-to-details">
                ${invoice?.deliveryAddress 
                  ? `<div>${invoice.deliveryAddress}</div>` 
                  : (client?.address ? `<div>${client.address}</div>` : '')}
                ${client?.phone ? `<div>Phone: ${client.phone}</div>` : ''}
              </div>
            </div>
          </div>
          
          <div class="print-header-center">
            <div class="print-company-name">${currentStore?.name || 'YOUR COMPANY NAME'}</div>
            ${currentStore?.tagline ? `<div class="print-company-tagline">${currentStore.tagline}</div>` : ''}
            <div class="print-company-row2">
              <span class="print-company-address">${currentStore?.address || 'Your Company Address'}</span>
              ${currentStore?.phone ? `<span>Phone: ${currentStore.phone}</span>` : ''}
            </div>
          </div>
          
          <div class="print-header-right">
            <div class="print-doc-type">SURAT JALAN</div>
            <div class="print-doc-details">
              <div class="print-doc-row">
                <span class="print-doc-label">No.</span>
                <span>${deliveryNote.deliveryNumber}</span>
              </div>
              <div class="print-doc-row">
                <span class="print-doc-label">Tanggal</span>
                <span>${formatDate(deliveryNote.deliveryDate)}</span>
              </div>
              <div class="print-doc-row">
                <span class="print-doc-label">Invoice</span>
                <span>${invoice?.invoiceNumber || '-'}</span>
              </div>
              <div class="print-doc-row">
                <span class="print-doc-label">Page</span>
                <span>${pageIdx + 1}/${totalPages}</span>
              </div>
              <div class="print-doc-row" style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #ccc;">
                <span class="print-doc-label">Tipe</span>
                <span style="font-weight: bold;">${deliveryNote.deliveryType === 'self_pickup' ? 'Self Pickup' : 'Delivery'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Generate table HTML for a page
      const generateTable = (pageItems: any[], startIdx: number) => `
        <table>
          <thead>
            <tr>
              <th style="width: 5%;" class="text-center">No.</th>
              <th style="width: 15%;" class="text-center">Kode Item</th>
              <th style="width: 50%;" class="text-center">Nama Produk</th>
              <th style="width: 10%;" class="text-center">QTY</th>
              <th style="width: 10%;" class="text-center">Unit</th>
              <th style="width: 10%;" class="text-center">Check</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map((item: any, idx: number) => `
              <tr>
                <td class="text-center"><div class="cell-clip">${startIdx + idx + 1}</div></td>
                <td class="text-center"><div class="cell-clip" style="font-size:7pt">${item.invoiceItem?.product?.sku || '-'}</div></td>
                <td class="text-left"><div class="cell-clip">${item.invoiceItem?.product?.name || item.invoiceItem?.description || ''}</div></td>
                <td class="text-center"><div class="cell-clip">${item.deliveredQuantity}</div></td>
                <td class="text-center"><div class="cell-clip">${item.invoiceItem?.unitLabel || '-'}</div></td>
                <td class="text-center"><span class="check-box"></span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      // Generate footer HTML
      const generateFooter = () => `
        <div class="print-footer">
          ${deliveryNote.notes || storePrintSettings?.deliveryNoteNotes ? `
            <div class="print-notes-label">Catatan:</div>
            <div class="print-notes-text">
              ${storePrintSettings?.deliveryNoteNotes ? `<div>${storePrintSettings.deliveryNoteNotes}</div>` : ''}
              ${deliveryNote.notes ? `<div>${deliveryNote.notes}</div>` : ''}
            </div>
          ` : ''}
          
          ${deliveryNote.vehicleInfo || deliveryNote.driverName ? `
            <div style="font-size: 9pt; margin-top: 5px;">
              ${deliveryNote.vehicleInfo ? `Kendaraan: ${deliveryNote.vehicleInfo}` : ''}
              ${deliveryNote.vehicleInfo && deliveryNote.driverName ? ' | ' : ''}
              ${deliveryNote.driverName ? `Pengirim: ${deliveryNote.driverName}` : ''}
            </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-label">Checked By</div>
              <div class="signature-line">( _______________ )</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Pengirim</div>
              <div class="signature-line">( ${deliveryNote.driverName || '_______________'} )</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Received By</div>
              <div class="signature-line">( ${deliveryNote.recipientName || '_______________'} )</div>
            </div>
          </div>
        </div>
      `;

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Delivery Note - ${deliveryNote.deliveryNumber}</title>
          <style>
            @page {
              size: 24cm 14cm landscape;
              margin: 0.4cm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 10pt;
            }
            .page {
              width: 23cm;
              height: 13.2cm;
              padding: 0.3cm;
              position: relative;
              page-break-after: always;
            }
            .page:last-child {
              page-break-after: auto;
            }
            .print-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 0.3cm;
              gap: 0.3cm;
            }
            .print-header-left {
              display: flex;
              flex-direction: column;
              gap: 0.2cm;
              min-width: 5.5cm;
            }
            .print-logo-circle {
              width: 1.5cm;
              height: 1.5cm;
              border: 2px solid ${accentColor};
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 12pt;
            }
            .print-logo-image {
              max-height: 1.5cm;
              max-width: 2.5cm;
              object-fit: contain;
            }
            .print-bill-to-label {
              font-size: 9pt;
              font-weight: bold;
              border-bottom: 2px solid ${accentColor};
              padding-bottom: 2px;
              margin-bottom: 3px;
              display: inline-block;
            }
            .print-bill-to-name {
              font-weight: bold;
              font-size: 11pt;
            }
            .print-bill-to-details {
              font-size: 9pt;
              line-height: 1.25;
            }
            .print-header-center {
              text-align: center;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 2px;
              margin-left: -1.5cm;
            }
            .print-company-row2 {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              gap: 2px;
              font-size: 10pt;
            }
            .print-company-name {
              font-size: 15pt;
              font-weight: bold;
              margin-bottom: 1px;
            }
            .print-company-tagline {
              font-size: 11pt;
              font-weight: bold;
              white-space: nowrap;
              margin-bottom: 2px;
            }
            .print-company-address {
              font-size: 10pt;
              white-space: nowrap;
            }
            .print-company-separator {
              color: #999;
              font-weight: normal;
            }
            .print-header-right {
              display: flex;
              flex-direction: column;
              align-items: stretch;
              min-width: 5cm;
            }
            .print-doc-type {
              font-size: 14pt;
              font-weight: bold;
              text-align: center;
              padding: 4px 10px;
              border: 2px solid ${accentColor};
              margin-bottom: 5px;
            }
            .print-doc-details {
              font-size: 9pt;
            }
            .print-doc-row {
              display: flex;
              justify-content: space-between;
              padding: 1px 0;
            }
            .print-doc-label {
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 10pt;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #333;
              padding: 0;
              overflow: hidden;
            }
            th {
              padding: 4px 6px;
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .cell-clip {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              width: 100%;
              max-width: 100%;
              padding: 4px 6px;
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .check-box {
              width: 14px;
              height: 14px;
              border: 1.5px solid #333;
              display: inline-block;
            }
            .print-footer {
              margin-top: 0.3cm;
            }
            .print-notes-label {
              font-weight: bold;
              font-size: 9pt;
              margin-bottom: 3px;
            }
            .print-notes-text {
              font-size: 9pt;
              line-height: 1.3;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 0.5cm;
            }
            .signature-box {
              width: 30%;
              text-align: center;
            }
            .signature-label {
              font-weight: bold;
              font-size: 10pt;
              margin-bottom: 0.8cm;
            }
            .signature-line {
              border-top: 1px solid #333;
              padding-top: 5px;
              font-size: 9pt;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${pages.map((page, pageIdx) => `
            <div class="page">
              ${generateHeader(pageIdx)}
              ${generateTable(page.items, page.startIndex)}
              ${page.isLastPage ? generateFooter() : ''}
            </div>
          `).join('')}
        </body>
        </html>
      `;

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(printContent);
        frameDoc.close();
        
        printFrame.onload = async () => {
          const images = Array.from(printFrame.contentDocument?.images || []);
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 3000);
            });
          }));
          logPrint('delivery_note', deliveryNote.id, deliveryNote.deliveryNumber, `Mencetak Surat Jalan ${deliveryNote.deliveryNumber}`);
          printFrame.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 1000);
        };
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load delivery note for printing",
        variant: "destructive",
      });
    }
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentForm({
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      paymentType: getDefaultPaymentType(),
      amount: '',
      notes: '',
    });
    setPaymentDialogOpen(true);
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setPaymentForm({
      paymentDate: format(new Date(payment.paymentDate), 'yyyy-MM-dd'),
      paymentType: payment.paymentType,
      amount: payment.amount,
      notes: payment.notes || '',
    });
    setPaymentDialogOpen(true);
  };

  const handleDeletePayment = (paymentId: number) => {
    deletePaymentMutation.mutate(paymentId);
  };

  // Calculate total payments made
  const totalPaymentsMade = invoicePayments.reduce((sum: number, payment: any) => {
    return sum + parseFloat(payment.amount || 0);
  }, 0);

  const invoiceTotal = invoice ? parseFloat(invoice.totalAmount) : 0;
  const canAddPayment = true;

  const handlePaymentSubmit = () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({
        title: "Jumlah tidak valid",
        description: "Jumlah pembayaran harus lebih dari 0.",
        variant: "destructive",
      });
      return;
    }

    const data: any = {
      invoiceId: id,
      paymentDate: paymentForm.paymentDate,
      paymentType: paymentForm.paymentType,
      amount: paymentForm.amount,
      notes: paymentForm.notes,
    };
    
    // Include creditNoteId if using credit note payment
    if (paymentForm.paymentType === 'Credit Note' && paymentForm.creditNoteId) {
      data.creditNoteId = paymentForm.creditNoteId;
    }

    if (editingPayment) {
      updatePaymentMutation.mutate(data);
    } else {
      createPaymentMutation.mutate(data);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Draft</Badge>;
      case 'sent':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      case 'void':
        return <Badge variant="outline" className="bg-slate-200 text-slate-600 line-through">Void</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-20" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Details</h1>
          <Button onClick={() => navigate("/invoices")}>Back to Invoices</Button>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="rounded-full bg-red-100 p-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Invoice Not Found</h3>
              <p className="text-sm text-gray-500 mb-4">
                The invoice you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <Button onClick={() => navigate("/invoices")}>Back to Invoices</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLockedByPaymentRule = lockPaidInvoices && invoice.paymentStatus === 'paid' && !isOwner;
  const isEditable = invoice.status !== 'void' && !isLockedByPaymentRule;

  // Helper to get running item number across pages
  const getRunningItemNumber = (pageIndex: number, itemIndex: number): number => {
    let count = 0;
    for (let i = 0; i < pageIndex; i++) {
      count += paginatedItems[i].items.length;
    }
    return count + itemIndex + 1;
  };

  return (
    <>
      {/* Print-only template - Multi-page support */}
      <div className="print-only" style={{ display: 'none' }}>
        {paginatedItems.map((page, pageIndex) => (
          <div 
            key={pageIndex} 
            className="print-invoice-template"
            style={{ pageBreakAfter: page.isLastPage ? 'auto' : 'always' }}
          >
            {/* Header - 3 columns: Logo+BillTo | Company Info | Doc Details */}
            <div className="print-header">
              {/* Left column: Logo + Bill To */}
              <div className="print-header-left" style={{ flexDirection: 'column' }}>
                <div className="print-logo">
                  {currentStore?.logoUrl ? (
                    <img src={currentStore.logoUrl} alt="Company Logo" className="print-logo-image" />
                  ) : (
                    <div className="print-logo-circle" style={{ borderColor: '#000' }}>
                      {currentStore?.name?.substring(0, 2).toUpperCase() || 'CO'}
                    </div>
                  )}
                </div>
                <div className="print-bill-to">
                  <div className="print-bill-to-label" style={{ borderColor: '#000' }}>Bill To</div>
                  <div className="print-bill-to-name">{client?.name || 'N/A'}</div>
                  {client && (
                    <div className="print-bill-to-details">
                      {client.address && <div>{client.address}</div>}
                      {client.phone && <div>Phone: {client.phone}</div>}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Center column: Company Info */}
              <div className="print-header-center">
                <div className="print-company-name">{currentStore?.name || "YOUR COMPANY NAME"}</div>
                {currentStore?.tagline && (
                  <div className="print-company-tagline">{currentStore.tagline}</div>
                )}
                <div className="print-company-row2">
                  <span className="print-company-address">{currentStore?.address || "Your Company Address"}</span>
                  {currentStore?.phone && (
                    <span>Phone: {currentStore.phone}</span>
                  )}
                  {currentStore?.email && (
                    <span>Email: {currentStore.email}</span>
                  )}
                </div>
              </div>
              
              {/* Right column: Document Details */}
              <div className="print-header-right">
                <div className="print-doc-type" style={{ borderColor: '#000' }}>INVOICE</div>
                <div className="print-doc-details">
                  <div className="print-doc-row">
                    <span className="print-doc-label">No.</span>
                    <span className="print-doc-value">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="print-doc-row">
                    <span className="print-doc-label">Date</span>
                    <span className="print-doc-value">{formatDate(invoice.issueDate)}</span>
                  </div>
                  {/* Due Date only shown for non-cash payment terms (net_7, net_14, net_30, custom) */}
                  {invoice.paymentTerms !== 'cod' && (
                    <div className="print-doc-row">
                      <span className="print-doc-label">Due Date</span>
                      <span className="print-doc-value">{formatDate(invoice.dueDate)}</span>
                    </div>
                  )}
                  {/* Created By */}
                  {invoice.createdByName && (
                    <div className="print-doc-row">
                      <span className="print-doc-label">Created By</span>
                      <span className="print-doc-value">{invoice.createdByName}</span>
                    </div>
                  )}
                  {/* Page indicator */}
                  <div className="print-doc-row">
                    <span className="print-doc-label">Page</span>
                    <span className="print-doc-value">{pageIndex + 1}/{totalPages}</span>
                  </div>
                  {invoice.deliveryAddress && invoice.deliveryAddress !== client?.address && (
                    <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ccc', fontSize: '8pt', lineHeight: '1.3' }}>
                      <span style={{ fontWeight: 'bold' }}>Alamat Pengiriman:</span>
                      <div>{invoice.deliveryAddress}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table - Column order: No, Kode Item, Products, QTY, Unit, Price, Total */}
            <table className="print-items-table">
              <thead>
                <tr>
                  <th style={{ width: '4%', textAlign: 'center' }}>No.</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Kode Item</th>
                  <th style={{ width: '44%', textAlign: 'center' }}>Products</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>QTY</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Unit</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Price</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item, itemIndex) => (
                  <tr key={itemIndex}>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{getRunningItemNumber(pageIndex, itemIndex)}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip" style={{ fontSize: '7pt' }}>{(item as any).productCode || (item as any).productSku || '-'}</div></td>
                    <td style={{ textAlign: 'left' }}><div className="print-cell-clip">{item.description}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatQuantity(item.quantity)}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{(item as any).unitLabel || '-'}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatCurrencyAccounting(item.unitPrice)}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatCurrencyAccounting(item.totalAmount)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer - Only shown on last page */}
            {page.isLastPage && (
              <div className="print-footer">
                <div className="print-footer-left">
                  <div className="print-notes-label">Notes / Terms & Conditions:</div>
                  <div className="print-notes-text">
                    {(storePrintSettings?.invoiceNotes || storePrintSettings?.defaultNotes) && (
                      <div>{storePrintSettings?.invoiceNotes || storePrintSettings?.defaultNotes}</div>
                    )}
                    {invoice.notes && (
                      <div style={{ marginTop: (storePrintSettings?.invoiceNotes || storePrintSettings?.defaultNotes) ? '8px' : '0' }}>{invoice.notes}</div>
                    )}
                    {!invoice.notes && !(storePrintSettings?.invoiceNotes || storePrintSettings?.defaultNotes) && (
                      <div>Items checked and verified upon delivery. Items cannot be returned.</div>
                    )}
                  </div>
                </div>
                
                <div className="print-footer-right">
                  {(parseFloat(invoice.discount || '0') > 0 || parseFloat((invoice as any).shipping || '0') > 0) && (
                    <div className="print-total-row">
                      <span className="print-total-label">Subtotal</span>
                      <span className="print-total-value">{formatCurrencyAccounting(invoice.subtotal)}</span>
                    </div>
                  )}
                  {parseFloat(invoice.discount || '0') > 0 && (
                    <div className="print-total-row">
                      <span className="print-total-label">Discount</span>
                      <span className="print-total-value">-{formatCurrencyAccounting(invoice.discount || '0')}</span>
                    </div>
                  )}
                  {(invoice as any).shipping && parseFloat((invoice as any).shipping) > 0 && (
                    <div className="print-total-row">
                      <span className="print-total-label">Shipping</span>
                      <span className="print-total-value">{formatCurrencyAccounting((invoice as any).shipping)}</span>
                    </div>
                  )}
                  <div className="print-total-row print-total-final" style={{ backgroundColor: '#e8e8e8' }}>
                    <span className="print-total-label">TOTAL</span>
                    <span className="print-total-value">{formatCurrencyAccounting(invoice.totalAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Screen view */}
      <div className="space-y-6 screen-only">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/invoices">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              Invoice {invoice.invoiceNumber}
              <span className="ml-3">{getStatusBadge(invoice.status)}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {format(new Date(invoice.issueDate), 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Action buttons based on status */}
          {invoice.status === 'draft' && (
            <Button
              variant="outline"
              className="gap-1"
              onClick={handleSendInvoice}
            >
              <Send className="h-4 w-4" />
              <span>Send</span>
            </Button>
          )}
          
          <Button
            variant="outline"
            className="gap-1"
            onClick={handleDownloadPDF}
          >
            <FileDown className="h-4 w-4" />
            <span>Download PDF</span>
          </Button>
          
          <Button
            variant="outline"
            className="gap-1"
            onClick={async () => { logPrint('invoice', invoice?.id ?? null, invoice?.invoiceNumber ?? '', `Mencetak Invoice ${invoice?.invoiceNumber}`); const logoImg = document.querySelector('.print-only .print-logo-image') as HTMLImageElement | null; if (logoImg && !logoImg.complete) { await new Promise<void>((resolve) => { logoImg.onload = () => resolve(); logoImg.onerror = () => resolve(); setTimeout(resolve, 3000); }); } window.print(); }}
            data-testid="button-print-invoice"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </Button>
          
          {isEditable && (
            <>
              <Button
                variant="outline"
                className="gap-1"
                onClick={() => {
                  const hasActive = deliveryNotes?.some(dn => dn.status !== 'cancelled');
                  if (hasActive) {
                    setShowEditWarning(true);
                  } else {
                    navigate(`/invoices/${id}/edit`);
                  }
                }}
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Button>

              <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Invoice Tidak Dapat Diedit</AlertDialogTitle>
                    <AlertDialogDescription>
                      Invoice ini sudah memiliki surat jalan aktif. Hapus atau batalkan semua surat jalan terlebih dahulu sebelum mengedit invoice ini.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Tutup</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          
          {invoice.status !== 'void' && isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  data-testid="button-void-invoice"
                >
                  <Ban className="h-4 w-4" />
                  <span>Void</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Void Invoice</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin void invoice {invoice.invoiceNumber}? Invoice akan dinonaktifkan dan tidak bisa diedit lagi. Invoice tetap tersimpan untuk keperluan pencatatan. Pastikan semua payment dan surat jalan sudah dihapus terlebih dahulu.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => voidMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                    data-testid="button-confirm-void"
                  >
                    Ya, Void Invoice
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      
      {/* Invoice Content */}
      <Card>
        <Tabs defaultValue="details" className="w-full">
          <div className="border-b px-6 pt-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Invoice Details</TabsTrigger>
              <TabsTrigger value="payments">
                Payments {invoicePayments.length > 0 && `(${invoicePayments.length})`}
              </TabsTrigger>
              <TabsTrigger value="delivery">
                Delivery {(deliveryNotes?.length || 0) > 0 && `(${deliveryNotes?.length})`}
              </TabsTrigger>
              <TabsTrigger value="returns">
                Retur {relatedReturns.length > 0 && `(${relatedReturns.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="details" className="m-0">
            <CardHeader className="border-b">
              <div className="flex flex-col md:flex-row justify-between">
                <div>
                  <CardTitle className="text-xl mb-2">Client Information</CardTitle>
                  <div className="space-y-1">
                    <p className="font-medium">{client?.name}</p>
                    <p className="text-sm text-gray-600">{client?.email}</p>
                    {client?.phone && (
                      <p className="text-sm text-gray-600">{client?.phone}</p>
                    )}
                    {client?.address && (
                      <p className="text-sm text-gray-600 whitespace-pre-line">{client?.address}</p>
                    )}
                    {invoice.deliveryAddress && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Alamat Pengiriman:</p>
                        <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.deliveryAddress}</p>
                        {invoice.deliveryAddressLink && (
                          <a 
                            href={invoice.deliveryAddressLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                          >
                            Lihat di Google Maps
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 md:mt-0 md:text-right">
                  <div className="space-y-1">
                    <div className="flex justify-between md:justify-end md:flex-col">
                      <span className="text-sm font-medium text-gray-500 md:mb-1">Invoice Number:</span>
                      <span className="text-sm">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between md:justify-end md:flex-col">
                      <span className="text-sm font-medium text-gray-500 md:mb-1">Invoice Date:</span>
                      <span className="text-sm">{formatDate(invoice.issueDate)}</span>
                    </div>
                    <div className="flex justify-between md:justify-end md:flex-col">
                      <span className="text-sm font-medium text-gray-500 md:mb-1">Due Date:</span>
                      <span className="text-sm">{formatDate(invoice.dueDate)}</span>
                    </div>
                    <div className="flex justify-between md:justify-end md:flex-col">
                      <span className="text-sm font-medium text-gray-500 md:mb-1">Payment Terms:</span>
                      <span className="text-sm">
                        {invoice.paymentTerms === 'cod' ? 'COD (Cash on Delivery)' :
                         invoice.paymentTerms === 'net_7' ? 'Net 7 Days' : 
                         invoice.paymentTerms === 'net_14' ? 'Net 14 Days' : 
                         invoice.paymentTerms === 'net_30' ? 'Net 30 Days' : 
                         invoice.paymentTerms === 'custom' ? 'Custom' :
                         invoice.paymentTerms || 'Custom'}
                      </span>
                    </div>
                    {invoice.createdByName && (
                      <div className="flex justify-between md:justify-end md:flex-col">
                        <span className="text-sm font-medium text-gray-500 md:mb-1">Created By:</span>
                        <span className="text-sm">{invoice.createdByName}</span>
                      </div>
                    )}
                    {invoice.createdAt && (
                      <div className="flex justify-between md:justify-end md:flex-col">
                        <span className="text-sm font-medium text-gray-500 md:mb-1">Dibuat:</span>
                        <span className="text-sm">{format(new Date(invoice.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                      </div>
                    )}
                    {invoice.updatedAt && invoice.createdAt &&
                      Math.abs(new Date(invoice.updatedAt).getTime() - new Date(invoice.createdAt).getTime()) > 60000 && (
                      <div className="flex justify-between md:justify-end md:flex-col">
                        <span className="text-sm font-medium text-gray-500 md:mb-1">Terakhir diubah:</span>
                        <span className="text-sm">{format(new Date(invoice.updatedAt), 'dd MMM yyyy, HH:mm')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-normal text-sm text-gray-900">
                          {item.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {parseFloat(item.quantity).toString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            
            <CardFooter className="flex-col items-end p-6 border-t">
              <div className="w-full sm:w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(invoice.subtotal || '0')}</span>
                </div>
                {parseFloat(invoice.discount || '0') > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Discount:</span>
                    <span className="text-gray-900">-{formatCurrency(invoice.discount || '0')}</span>
                  </div>
                )}
                {parseFloat((invoice as any).shipping || '0') > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Biaya Pengiriman:</span>
                    <span className="text-gray-900">+{formatCurrency((invoice as any).shipping || '0')}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Total:</span>
                  <span className="font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
              
              {invoice.notes && (
                <div className="w-full mt-6 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
            </CardFooter>
          </TabsContent>

          <TabsContent value="payments" className="m-0 p-6">
            {/* Payment Summary Infographic */}
            {(() => {
              const remaining = invoiceTotal - totalPaymentsMade;
              const overpayment = totalPaymentsMade - invoiceTotal;
              const paymentProgress = invoiceTotal > 0 ? (totalPaymentsMade / invoiceTotal) * 100 : 0;
              const isOverpaid = overpayment > 0.001;
              const isFullyPaid = remaining <= 0;
              
              return (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h4 className="text-lg font-medium mb-3">Payment Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Invoice Total</span>
                      <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Paid</span>
                      <span className="font-medium text-green-600">{formatCurrency(totalPaymentsMade)}</span>
                    </div>
                    {isOverpaid ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Overpayment</span>
                        <span className="font-semibold text-purple-600">{formatCurrency(overpayment)}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Remaining</span>
                        <span className={`font-semibold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.max(0, remaining))}
                        </span>
                      </div>
                    )}
                    <Progress value={Math.min(100, paymentProgress)} className="h-2 mt-2" />
                  </div>
                  {isOverpaid ? (
                    <div className="mt-3 space-y-2">
                      <div className="p-2 bg-purple-100 text-purple-800 rounded text-sm text-center">
                        <AlertTriangle className="h-4 w-4 inline mr-2" />
                        Overpaid by {formatCurrency(overpayment)}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                        onClick={() => {
                          setRefundForm({
                            paymentDate: format(new Date(), 'yyyy-MM-dd'),
                            paymentType: paymentTypes?.[0]?.name || 'Cash',
                            amount: overpayment.toFixed(2),
                            notes: '',
                          });
                          setRefundDialogOpen(true);
                        }}
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Refund Overpayment
                      </Button>
                    </div>
                  ) : isFullyPaid ? (
                    <div className="mt-3 p-2 bg-green-100 text-green-800 rounded text-sm text-center">
                      <CheckCircle className="h-4 w-4 inline mr-2" />
                      Fully Paid
                    </div>
                  ) : totalPaymentsMade > 0 ? (
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
              <div>
                <h3 className="text-lg font-medium">Payment Records</h3>
              </div>
              {canManagePayments && (
              <Button
                size="sm"
                onClick={handleAddPayment}
                disabled={!canAddPayment}
                data-testid="button-add-payment"
                title={!canAddPayment ? "Invoice is fully paid. No more payments can be added unless the invoice total is increased." : ""}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
              )}
            </div>

            {invoicePayments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No payments recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Notes
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoicePayments.map((payment: any) => {
                      const isNegative = parseFloat(payment.amount) < 0;
                      const isDeposit = isNegative && payment.paymentType === 'Client Deposit';
                      const isRefund = isNegative && !isDeposit;
                      const rowClass = isDeposit ? 'bg-blue-50' : isRefund ? 'bg-purple-50' : '';
                      const textClass = isDeposit ? 'text-blue-700' : isRefund ? 'text-purple-700' : 'text-gray-900';
                      return (
                      <tr key={payment.id} className={rowClass}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {isDeposit ? <span className="text-blue-700">Deposited to Balance</span> 
                            : isRefund ? <span className="text-purple-700">Refund ({payment.paymentType})</span> 
                            : payment.paymentType}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${textClass}`}>
                          {isNegative ? `(${formatCurrency(Math.abs(parseFloat(payment.amount)))})` : formatCurrency(parseFloat(payment.amount))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.notes || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          {canManagePayments && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditPayment(payment)}
                                className="mr-1"
                                data-testid={`button-edit-payment-${payment.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePayment(payment.id)}
                                className="text-red-600 hover:text-red-700"
                                data-testid={`button-delete-payment-${payment.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                      );
                    })}
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
                        {paymentTypes && paymentTypes.filter(pt => pt.isActive).length > 0 ? (
                          paymentTypes.filter(pt => pt.isActive).map((pt) => (
                            <SelectItem key={pt.id} value={pt.name}>{pt.name}</SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="Card">Card</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </>
                        )}
                        {clientCreditNotes.length > 0 && (
                          <SelectItem value="Credit Note">Credit Note</SelectItem>
                        )}
                        {clientDepositBalance > 0 && (
                          <SelectItem value="Client Deposit">Client Deposit (Bal: {formatCurrency(clientDepositBalance)})</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentForm.paymentType === 'Client Deposit' && (
                    <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                      Available deposit balance: <span className="font-semibold">{formatCurrency(clientDepositBalance)}</span>
                    </div>
                  )}
                  {paymentForm.paymentType === 'Credit Note' && clientCreditNotes.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Credit Note</label>
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
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        placeholder="0.00"
                        data-testid="input-payment-amount"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPaymentForm({ ...paymentForm, amount: invoice!.totalAmount.toString() })}
                        data-testid="button-fill-amount"
                      >
                        Fill
                      </Button>
                    </div>
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

            {/* Refund Overpayment Dialog */}
            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Handle Overpayment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRefundAction('refund')}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          refundAction === 'refund' 
                            ? 'border-purple-500 bg-purple-50 text-purple-800' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">Refund</div>
                        <div className="text-xs text-gray-500 mt-0.5">Return money to customer</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefundAction('deposit')}
                        disabled={!invoice?.clientId}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          refundAction === 'deposit' 
                            ? 'border-blue-500 bg-blue-50 text-blue-800' 
                            : !invoice?.clientId 
                              ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-sm">Deposit</div>
                        <div className="text-xs text-gray-500 mt-0.5">Save as client balance</div>
                      </button>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg text-sm ${
                    refundAction === 'deposit' 
                      ? 'bg-blue-50 text-blue-800' 
                      : 'bg-purple-50 text-purple-800'
                  }`}>
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    {refundAction === 'deposit'
                      ? 'This will save the overpayment as client deposit balance for future invoices.'
                      : 'This will create an expense transaction to record the refund.'}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <Input
                      type="date"
                      value={refundForm.paymentDate}
                      onChange={(e) => setRefundForm({ ...refundForm, paymentDate: e.target.value })}
                    />
                  </div>
                  {refundAction === 'refund' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <Select
                        value={refundForm.paymentType}
                        onValueChange={(value) => setRefundForm({ ...refundForm, paymentType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentTypes && paymentTypes.filter(pt => pt.isActive).length > 0 ? (
                            paymentTypes.filter(pt => pt.isActive).map((pt) => (
                              <SelectItem key={pt.id} value={pt.name}>{pt.name}</SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={refundForm.amount}
                      onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <Textarea
                      value={refundForm.notes}
                      onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRefundDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => refundMutation.mutate(refundForm)}
                    disabled={refundMutation.isPending}
                    className={refundAction === 'deposit' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}
                  >
                    {refundMutation.isPending ? 'Processing...' : refundAction === 'deposit' ? 'Deposit to Balance' : 'Process Refund'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="delivery" className="m-0 p-6">
            <div className="space-y-6">
              {/* Delivery Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Delivery Summary</h3>
                <div className="space-y-3">
                  {deliveryStatus?.orderedItems.map((item) => {
                    const progress = item.quantity > 0 ? (item.delivered / item.quantity) * 100 : 0;
                    return (
                      <div key={item.invoiceItemId} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium truncate flex-1 mr-4">{item.description}</span>
                          <span className="text-gray-600 whitespace-nowrap">
                            {item.delivered} / {item.quantity}
                            {item.remaining > 0 && (
                              <span className="text-orange-600 ml-2">
                                ({item.remaining} remaining)
                              </span>
                            )}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
                {deliveryStatus?.fullyDelivered ? (
                  <div className="mt-4 p-2 bg-green-100 text-green-800 rounded text-sm text-center">
                    <Package className="h-4 w-4 inline mr-2" />
                    All items have been delivered
                  </div>
                ) : (
                  <div className="mt-4 p-2 bg-orange-100 text-orange-800 rounded text-sm text-center">
                    <Truck className="h-4 w-4 inline mr-2" />
                    Pending delivery
                  </div>
                )}
              </div>

              {/* Delivery Notes List */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Delivery Notes</h3>
                  {!deliveryStatus?.fullyDelivered && (
                    <Button size="sm" onClick={initializeDeliveryForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Delivery Note
                    </Button>
                  )}
                </div>

                {(deliveryNotes?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No delivery notes yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Delivery #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Driver</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryNotes?.map((dn) => (
                          <TableRow key={dn.id}>
                            <TableCell className="font-medium">{dn.deliveryNumber}</TableCell>
                            <TableCell>{formatDate(dn.deliveryDate)}</TableCell>
                            <TableCell>
                              <Badge variant={dn.deliveryType === 'self_pickup' ? 'outline' : 'secondary'}>
                                {dn.deliveryType === 'self_pickup' ? 'Self Pickup' : 'Delivery'}
                              </Badge>
                            </TableCell>
                            <TableCell>{dn.driverName || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={dn.status === 'delivered' ? 'default' : dn.status === 'cancelled' ? 'destructive' : 'secondary'}>
                                {dn.status === 'pending' ? 'Pending' : dn.status === 'delivered' ? 'Delivered' : 'Cancelled'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {dn.status === 'pending' && canUpdateDeliveryStatus && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => markDeliveredMutation.mutate(dn.id)}
                                  disabled={markDeliveredMutation.isPending}
                                  title="Tandai Delivered"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDeliveryNote(dn)}
                                title="Edit Delivery Note"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {canPrintDelivery && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintDeliveryNote(dn)}
                                title={requirePaymentBeforePrint && invoicePayments.length === 0 ? "Harus ada pembayaran sebelum print surat jalan" : "Print Delivery Note"}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteDeliveryNoteMutation.mutate(dn.id)}
                                className="text-red-600 hover:text-red-700"
                                title="Delete Delivery Note"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>

            {/* Create Delivery Note Dialog */}
            <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Delivery Note</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                      <Input
                        type="date"
                        value={deliveryForm.deliveryDate}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, deliveryDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
                      <Input
                        value={deliveryForm.driverName}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, driverName: e.target.value })}
                        placeholder="Driver name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Info</label>
                      <Input
                        value={deliveryForm.vehicleInfo}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, vehicleInfo: e.target.value })}
                        placeholder="Vehicle number/info"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                      <Input
                        value={deliveryForm.recipientName}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, recipientName: e.target.value })}
                        placeholder="Recipient name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Pengiriman</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      value={deliveryForm.deliveryType}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, deliveryType: e.target.value as 'delivered' | 'self_pickup' })}
                    >
                      <option value="delivered">Delivery</option>
                      <option value="self_pickup">Self Pickup</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Items to Deliver</label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right w-24">Remaining</TableHead>
                            <TableHead className="text-right w-24">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliveryStatus?.orderedItems.filter(item => item.remaining > 0).map((item) => {
                            const formItem = deliveryForm.items.find(fi => fi.invoiceItemId === item.invoiceItemId);
                            return (
                              <TableRow key={item.invoiceItemId}>
                                <TableCell className="font-medium">{item.description}</TableCell>
                                <TableCell className="text-right">{item.remaining}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={item.remaining}
                                    step="0.01"
                                    className="w-20 text-right"
                                    value={formItem?.deliveredQuantity || '0'}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setDeliveryForm(prev => ({
                                        ...prev,
                                        items: prev.items.map(fi =>
                                          fi.invoiceItemId === item.invoiceItemId
                                            ? { ...fi, deliveredQuantity: value }
                                            : fi
                                        ).concat(
                                          prev.items.find(fi => fi.invoiceItemId === item.invoiceItemId)
                                            ? []
                                            : [{ invoiceItemId: item.invoiceItemId, deliveredQuantity: value, remarks: '' }]
                                        )
                                      }));
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <Textarea
                      value={deliveryForm.notes}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeliverySubmit}
                    disabled={createDeliveryNoteMutation.isPending}
                  >
                    Create Delivery Note
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Delivery Note Dialog (metadata only) */}
            <Dialog open={editDeliveryDialogOpen} onOpenChange={setEditDeliveryDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Delivery Note</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
                      <Input
                        type="date"
                        value={editDeliveryForm.deliveryDate}
                        onChange={(e) => setEditDeliveryForm({ ...editDeliveryForm, deliveryDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
                      <Input
                        value={editDeliveryForm.driverName}
                        onChange={(e) => setEditDeliveryForm({ ...editDeliveryForm, driverName: e.target.value })}
                        placeholder="Driver name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Info</label>
                      <Input
                        value={editDeliveryForm.vehicleInfo}
                        onChange={(e) => setEditDeliveryForm({ ...editDeliveryForm, vehicleInfo: e.target.value })}
                        placeholder="Vehicle number/info"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                      <Input
                        value={editDeliveryForm.recipientName}
                        onChange={(e) => setEditDeliveryForm({ ...editDeliveryForm, recipientName: e.target.value })}
                        placeholder="Recipient name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Pengiriman</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      value={editDeliveryForm.deliveryType}
                      onChange={(e) => setEditDeliveryForm({ ...editDeliveryForm, deliveryType: e.target.value as 'delivered' | 'self_pickup' })}
                    >
                      <option value="delivered">Delivery</option>
                      <option value="self_pickup">Self Pickup</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <Textarea
                      value={editDeliveryForm.notes}
                      onChange={(e) => setEditDeliveryForm({ ...editDeliveryForm, notes: e.target.value })}
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>

                  {editingDeliveryNote?.status === 'pending' && editDeliveryItems.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Item yang Dikirim</label>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right w-24">Max</TableHead>
                            <TableHead className="text-right w-32">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editDeliveryItems.map((item) => (
                            <TableRow key={item.invoiceItemId}>
                              <TableCell className="font-medium">{item.description}</TableCell>
                              <TableCell className="text-right">{item.maxQuantity}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  max={item.maxQuantity}
                                  step="0.01"
                                  className="w-24 text-right"
                                  value={item.deliveredQuantity}
                                  onChange={(e) => {
                                    const newItems = editDeliveryItems.map(i => 
                                      i.invoiceItemId === item.invoiceItemId 
                                        ? { ...i, deliveredQuantity: e.target.value }
                                        : i
                                    );
                                    setEditDeliveryItems(newItems);
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Note: Item quantities cannot be edited on delivered notes. Use "Kembalikan ke Pending" first.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditDeliveryDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateDeliveryNote}
                    disabled={updateDeliveryNoteMutation.isPending}
                  >
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Retur Tab */}
          <TabsContent value="returns" className="m-0 p-6">
            {relatedReturns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                <RotateCcw className="h-10 w-10 mb-3 text-gray-300" />
                <p className="font-medium">Tidak ada retur untuk invoice ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {relatedReturns.map((ret: any) => {
                  const remainingBalance = Number(ret.totalAmount) - Number(ret.usedAmount || 0);
                  const isCreditNote = ret.returnType === 'credit_note';
                  return (
                    <Card key={ret.id} className="border">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <div className="flex items-center gap-2">
                            <Link href={`/returns/${ret.id}`}>
                              <span className="font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                                {ret.returnNumber}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </span>
                            </Link>
                            <Badge variant={isCreditNote ? "secondary" : "outline"}>
                              {isCreditNote ? "Credit Note" : "Refund"}
                            </Badge>
                            <Badge variant={
                              ret.status === 'completed' ? 'default' :
                              ret.status === 'cancelled' ? 'destructive' : 'secondary'
                            }>
                              {ret.status === 'completed' ? 'Selesai' :
                               ret.status === 'cancelled' ? 'Dibatalkan' : 'Pending'}
                            </Badge>
                          </div>
                          <span className="text-sm text-gray-500">{formatDate(ret.returnDate)}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b text-gray-500">
                              <th className="text-left py-2 pr-4 font-medium">Produk</th>
                              <th className="text-right py-2 pr-4 font-medium">Qty</th>
                              <th className="text-right py-2 pr-4 font-medium">Harga</th>
                              <th className="text-right py-2 pr-4 font-medium">Subtotal</th>
                              <th className="text-left py-2 font-medium">Alasan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ret.items.map((item: any) => (
                              <tr key={item.id} className="border-b last:border-0">
                                <td className="py-2 pr-4">{item.productName}</td>
                                <td className="py-2 pr-4 text-right">{formatQuantity(item.quantity)}</td>
                                <td className="py-2 pr-4 text-right">{formatCurrency(item.unitPrice)}</td>
                                <td className="py-2 pr-4 text-right">{formatCurrency(Number(item.quantity) * Number(item.unitPrice))}</td>
                                <td className="py-2 text-gray-500">{item.reason || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                      <CardFooter className="border-t pt-3 flex flex-wrap gap-4 justify-between items-center">
                        <div className="flex flex-wrap gap-4 text-sm">
                          {isCreditNote && (
                            <span className={remainingBalance > 0 ? "text-green-700 font-medium" : "text-gray-400"}>
                              Sisa Saldo Credit Note: {formatCurrency(remainingBalance)}
                            </span>
                          )}
                          {ret.notes && (
                            <span className="text-gray-500">Catatan: {ret.notes}</span>
                          )}
                        </div>
                        <div className="text-sm font-semibold">
                          Total: {formatCurrency(ret.totalAmount)}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
      </div>
    </>
  );
}
