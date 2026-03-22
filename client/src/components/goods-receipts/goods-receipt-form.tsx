import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { X, Save, Plus, Trash2, ArrowLeft, DollarSign, Edit, ChevronsUpDown, Check, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useStore } from "@/lib/store-context";
import { insertGoodsReceiptSchema } from "@shared/schema";
import type { GoodsReceiptPayment, PurchaseOrder, Product, Supplier, CashAccount } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const extendedGoodsReceiptSchema = insertGoodsReceiptSchema.extend({
  receiptDate: z.coerce.date(),
  dueDate: z.coerce.date().nullable().optional(),
  subtotal: z.string().optional(),
  taxRate: z.string().optional(),
  taxAmount: z.string().optional(),
  discount: z.string().optional(),
  totalAmount: z.string().optional(),
});

const goodsReceiptItemSchema = z.object({
  id: z.number().optional(),
  productId: z.number(),
  purchaseOrderId: z.number().nullable().optional(),
  purchaseOrderItemId: z.number().nullable().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unitCost: z.string().min(1, "Unit cost is required"),
  baseCost: z.string().nullable().optional(),
  baseQuantity: z.string().nullable().optional(),
  conversionFactor: z.string().optional(),
  taxRate: z.string().optional(),
  taxAmount: z.string().optional(),
  discount: z.string().optional(),
  subtotal: z.string().optional(),
  totalAmount: z.string().optional(),
  returnQuantity: z.string().optional(),
  returnReason: z.string().optional(),
  returnStatus: z.enum(['none', 'pending', 'returned']).optional(),
  returnedQuantity: z.string().optional(),
  isTaxInclusive: z.boolean().optional(),
});

type GoodsReceiptItem = z.infer<typeof goodsReceiptItemSchema>;

interface PurchaseOrderWithItems {
  id: number;
  purchaseOrderNumber: string;
  supplierId: number | null;
  status: string;
  useFakturPajak?: boolean;
  isPrepaid?: boolean;
  totalAmount?: string;
  items?: { 
    id: number;
    productId: number; 
    description: string; 
    quantity: string; 
    unitCost: string; 
    baseCost?: string | null; 
    baseQuantity?: string | null;
    productUnitId?: number | null;
    receivedQuantity?: string;
  }[];
}

interface POPaymentSummary {
  totalPaid: number;
  totalAmount: number;
  isFullyPaid: boolean;
}

interface GoodsReceiptData {
  goodsReceipt: {
    storeId: number;
    supplierId: number | null;
    supplierName: string;
    supplierEmail: string | null;
    supplierPhone: string | null;
    supplierAddress: string | null;
    supplierDocNumber: string | null;
    receiptNumber: string;
    receiptDate: string;
    dueDate: string | null;
    status: string;
    subtotal: string;
    taxRate: string | null;
    taxAmount: string | null;
    discount: string | null;
    totalAmount: string;
    notes: string | null;
  };
  items: any[];
}

interface GoodsReceiptFormProps {
  goodsReceiptId?: number;
  onSuccess?: () => void;
  mode?: 'create' | 'edit' | 'view';
}

export default function GoodsReceiptForm({ goodsReceiptId, onSuccess, mode = goodsReceiptId ? 'edit' : 'create' }: GoodsReceiptFormProps) {
  const { currentStoreId } = useStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isEditing = mode === 'edit';
  const isViewOnly = mode === 'view';
  
  const [items, setItems] = useState<GoodsReceiptItem[]>([{
    productId: 0,
    purchaseOrderId: null,
    description: "",
    quantity: "1",
    unitCost: "0",
    baseCost: null,
    baseQuantity: null,
    conversionFactor: "1",
    taxRate: "0",
    taxAmount: "0",
    discount: "0",
    subtotal: "0",
    totalAmount: "0",
    returnQuantity: "0",
    returnReason: "",
    returnStatus: 'none',
    returnedQuantity: "0"
  }]);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<GoodsReceiptPayment | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentType: '',
    cashAccountId: null as number | null,
    amount: '',
    reference: '',
    notes: ''
  });
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productOpen, setProductOpen] = useState<number | null>(null);
  const [poOpen, setPOOpen] = useState<number | null>(null);
  const [poSearchQuery, setPOSearchQuery] = useState("");
  const [prepaidPOPaymentStatus, setPrepaidPOPaymentStatus] = useState<Record<number, POPaymentSummary>>({});

  const form = useForm({
    resolver: zodResolver(extendedGoodsReceiptSchema),
    defaultValues: {
      storeId: currentStoreId,
      supplierId: null as number | null,
      supplierName: "",
      supplierEmail: "",
      supplierPhone: "",
      supplierAddress: "",
      supplierDocNumber: "",
      receiptDate: new Date(),
      dueDate: null as Date | null,
      status: "confirmed" as "draft" | "confirmed" | "partial_paid" | "paid" | "cancelled",
      subtotal: "0",
      taxRate: "0",
      taxAmount: "0",
      discount: "0",
      totalAmount: "0",
      notes: "",
    }
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: [`/api/stores/${currentStoreId}/suppliers`],
    enabled: !!currentStoreId,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: [`/api/products`, { storeId: currentStoreId }],
    queryFn: async () => {
      const res = await fetch(`/api/products?storeId=${currentStoreId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!currentStoreId,
  });

  const { data: purchaseOrders } = useQuery<PurchaseOrderWithItems[]>({
    queryKey: [`/api/stores/${currentStoreId}/purchase-orders`],
    enabled: !!currentStoreId,
  });

  const { data: cashAccounts } = useQuery<CashAccount[]>({
    queryKey: [`/api/stores/${currentStoreId}/cash-accounts`],
  });

  const hasExistingId = !!goodsReceiptId;

  const { data: existingReceipt } = useQuery<GoodsReceiptData>({
    queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId],
    enabled: hasExistingId && !!currentStoreId,
  });

  const { data: nextReceiptNumberData } = useQuery<{ receiptNumber: string }>({
    queryKey: [`/api/stores/${currentStoreId}/goods-receipts/next-number`],
    enabled: !hasExistingId && !!currentStoreId,
  });

  const { data: receiptPayments, refetch: refetchPayments } = useQuery<GoodsReceiptPayment[]>({
    queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId, 'payments'],
    enabled: hasExistingId && !!currentStoreId,
  });

  // Fetch payment status for all prepaid POs (for dropdown and selected items)
  useEffect(() => {
    const fetchPrepaidPOStatus = async () => {
      if (!purchaseOrders) return;
      
      // Get all prepaid PO IDs
      const prepaidPOIds = purchaseOrders
        .filter(po => po.isPrepaid === true)
        .map(po => po.id);
      
      if (prepaidPOIds.length === 0) return;
      
      // Fetch payment status for each prepaid PO that hasn't been fetched
      const statusMap: Record<number, POPaymentSummary> = {};
      for (const poId of prepaidPOIds) {
        if (prepaidPOPaymentStatus[poId]) continue; // Already fetched
        try {
          const response = await fetch(`/api/stores/${currentStoreId}/purchase-orders/${poId}/payments`);
          if (response.ok) {
            const payments = await response.json();
            const po = purchaseOrders.find(p => p.id === poId);
            const totalAmount = parseFloat(po?.totalAmount || '0');
            const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
            statusMap[poId] = {
              totalPaid,
              totalAmount,
              isFullyPaid: totalPaid >= totalAmount && totalAmount > 0
            };
          }
        } catch (error) {
          console.error(`Failed to fetch payments for PO ${poId}:`, error);
        }
      }
      
      if (Object.keys(statusMap).length > 0) {
        setPrepaidPOPaymentStatus(prev => ({ ...prev, ...statusMap }));
      }
    };
    
    fetchPrepaidPOStatus();
  }, [purchaseOrders]);

  useEffect(() => {
    if (existingReceipt) {
      const receipt = existingReceipt.goodsReceipt;
      form.reset({
        storeId: receipt.storeId,
        supplierId: receipt.supplierId,
        supplierName: receipt.supplierName,
        supplierEmail: receipt.supplierEmail || "",
        supplierPhone: receipt.supplierPhone || "",
        supplierAddress: receipt.supplierAddress || "",
        supplierDocNumber: receipt.supplierDocNumber || "",
        receiptDate: new Date(receipt.receiptDate),
        dueDate: receipt.dueDate ? new Date(receipt.dueDate) : null,
        status: receipt.status as "draft" | "confirmed" | "partial_paid" | "paid" | "cancelled",
        subtotal: receipt.subtotal,
        taxRate: receipt.taxRate || "0",
        taxAmount: receipt.taxAmount || "0",
        discount: receipt.discount || "0",
        totalAmount: receipt.totalAmount,
        notes: receipt.notes || "",
      });

      if (existingReceipt.items && existingReceipt.items.length > 0) {
        setItems(existingReceipt.items.map((item: any) => {
          const linkedPO = purchaseOrders?.find((po: any) => po.id === item.purchaseOrderId);
          return {
            id: item.id,
            productId: item.productId,
            purchaseOrderId: item.purchaseOrderId,
            description: item.description,
            quantity: String(item.quantity),
            unitCost: String(item.unitCost),
            taxRate: String(item.taxRate || 0),
            taxAmount: String(item.taxAmount || 0),
            discount: String(item.discount || 0),
            subtotal: String(item.subtotal),
            totalAmount: String(item.totalAmount),
            returnQuantity: String(item.returnQuantity || 0),
            returnReason: item.returnReason || "",
            returnStatus: item.returnStatus || 'none',
            returnedQuantity: String(item.returnedQuantity || 0),
            isTaxInclusive: linkedPO?.useFakturPajak || false,
          };
        }));
      }
    }
  }, [existingReceipt, form]);

  useEffect(() => {
    if (purchaseOrders && purchaseOrders.length > 0 && items.length > 0) {
      let changed = false;
      const updatedItems = items.map(item => {
        if (item.purchaseOrderId) {
          const linkedPO = purchaseOrders.find((po: any) => po.id === item.purchaseOrderId);
          const shouldBeTaxInclusive = !!linkedPO?.useFakturPajak;
          if (item.isTaxInclusive !== shouldBeTaxInclusive) {
            changed = true;
            const updated = { ...item, isTaxInclusive: shouldBeTaxInclusive };
            return calculateItemTotals(updated);
          }
        }
        return item;
      });
      if (changed) {
        setItems(updatedItems);
        updateFormTotals(updatedItems);
      }
    }
  }, [purchaseOrders]);

  const calculateItemTotals = (item: GoodsReceiptItem): GoodsReceiptItem => {
    const qty = parseFloat(item.quantity) || 0;
    const cost = parseFloat(item.unitCost) || 0;
    const taxRate = parseFloat(item.taxRate || "0") || 0;
    const discount = parseFloat(item.discount || "0") || 0;
    
    let subtotal: number;
    let taxAmount: number;
    
    if (item.isTaxInclusive && taxRate > 0) {
      const totalBeforeDiscount = qty * cost;
      const baseCostPerUnit = cost / (1 + taxRate / 100);
      subtotal = qty * baseCostPerUnit;
      taxAmount = totalBeforeDiscount - subtotal;
    } else {
      subtotal = qty * cost;
      taxAmount = subtotal * (taxRate / 100);
    }
    
    const total = subtotal + taxAmount - discount;

    return {
      ...item,
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: total.toFixed(2)
    };
  };

  const updateFormTotals = (updatedItems: GoodsReceiptItem[]) => {
    const subtotal = updatedItems.reduce((sum, item) => sum + parseFloat(item.subtotal || "0"), 0);
    const taxAmount = updatedItems.reduce((sum, item) => sum + parseFloat(item.taxAmount || "0"), 0);
    const discount = updatedItems.reduce((sum, item) => sum + parseFloat(item.discount || "0"), 0);
    const totalAmount = subtotal + taxAmount - discount;

    form.setValue("subtotal", subtotal.toFixed(2));
    form.setValue("taxAmount", taxAmount.toFixed(2));
    form.setValue("discount", discount.toFixed(2));
    form.setValue("totalAmount", totalAmount.toFixed(2));
  };

  const updateItem = (index: number, field: keyof GoodsReceiptItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (['quantity', 'unitCost', 'taxRate', 'discount'].includes(field)) {
      updatedItems[index] = calculateItemTotals(updatedItems[index]);
    }
    
    // Recalculate baseQuantity when quantity changes (using stored conversionFactor)
    if (field === 'quantity') {
      const conversionFactor = parseFloat(updatedItems[index].conversionFactor || '1') || 1;
      const quantity = parseFloat(value || '1') || 1;
      const baseQuantity = quantity * conversionFactor;
      updatedItems[index].baseQuantity = baseQuantity.toFixed(2);
    }
    
    setItems(updatedItems);
    updateFormTotals(updatedItems);
  };

  const addItem = () => {
    setItems([...items, {
      productId: 0,
      purchaseOrderId: null,
      description: "",
      quantity: "1",
      unitCost: "0",
      baseCost: null,
      baseQuantity: null,
      conversionFactor: "1",
      taxRate: "0",
      taxAmount: "0",
      discount: "0",
      subtotal: "0",
      totalAmount: "0",
      returnQuantity: "0",
      returnReason: "",
      returnStatus: 'none',
      returnedQuantity: "0"
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      const updatedItems = items.filter((_, i) => i !== index);
      setItems(updatedItems);
      updateFormTotals(updatedItems);
    }
  };

  const selectSupplier = (supplier: Supplier) => {
    form.setValue("supplierId", supplier.id);
    form.setValue("supplierName", supplier.name);
    form.setValue("supplierEmail", supplier.email || "");
    form.setValue("supplierPhone", supplier.phone || "");
    form.setValue("supplierAddress", supplier.address || "");
    setSupplierOpen(false);
  };

  const selectProduct = (index: number, product: Product) => {
    const updatedItems = [...items];
    updatedItems[index] = {
      ...updatedItems[index],
      productId: product.id,
      description: product.name,
      unitCost: String(product.costPrice || 0),
      purchaseOrderId: null, // Reset PO when product changes
      taxRate: "0" // Reset tax when product changes
    };
    updatedItems[index] = calculateItemTotals(updatedItems[index]);
    setItems(updatedItems);
    updateFormTotals(updatedItems);
    setProductOpen(null);
  };

  const getFilteredPOs = (productId: number) => {
    const supplierId = form.watch("supplierId");
    if (!supplierId || !productId) return [];
    
    return (purchaseOrders || []).filter(po => {
      // Filter by supplier
      if (po.supplierId !== supplierId) return false;
      
      // Filter by status - include pending, sent, and partial (not received or cancelled)
      if (!['pending', 'sent', 'partial'].includes(po.status)) return false;
      
      // Filter by product - PO must contain the selected product with remaining unreceived quantity
      const hasUnreceivedProduct = po.items?.some(item => 
        item.productId === productId && 
        parseFloat(item.receivedQuantity || '0') < parseFloat(item.quantity)
      );
      if (!hasUnreceivedProduct) return false;
      
      // Filter by search query
      if (poSearchQuery && !po.purchaseOrderNumber.toLowerCase().includes(poSearchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  };

  const selectPO = (index: number, po: PurchaseOrderWithItems | null) => {
    const updatedItems = [...items];
    if (po) {
      // Find the unit cost and base cost for this product from the PO items
      const productId = updatedItems[index].productId;
      const poItem = po.items?.find(item => item.productId === productId);
      const poUnitCost = poItem ? poItem.unitCost : updatedItems[index].unitCost;
      const poBaseCost = poItem?.baseCost || poUnitCost; // Use baseCost if available, otherwise use unitCost
      
      // Calculate conversion factor from PO item: baseQuantity / quantity
      // This allows us to calculate the base quantity for received items
      const poQuantity = parseFloat(poItem?.quantity || '1') || 1;
      const poBaseQuantity = parseFloat(poItem?.baseQuantity || poItem?.quantity || '1') || 1;
      const conversionFactor = poBaseQuantity / poQuantity;
      
      // Calculate base quantity for this GR item
      const receivedQuantity = parseFloat(updatedItems[index].quantity || '1') || 1;
      const baseQuantity = receivedQuantity * conversionFactor;
      
      updatedItems[index] = {
        ...updatedItems[index],
        purchaseOrderId: po.id,
        purchaseOrderItemId: poItem?.id || null,
        unitCost: poUnitCost,
        baseCost: poBaseCost,
        baseQuantity: baseQuantity.toFixed(2),
        conversionFactor: conversionFactor.toString(),
        taxRate: po.useFakturPajak ? "11" : "0",
        isTaxInclusive: !!po.useFakturPajak,
      };
    } else {
      updatedItems[index] = {
        ...updatedItems[index],
        purchaseOrderId: null,
        purchaseOrderItemId: null,
        baseCost: null,
        baseQuantity: null,
        conversionFactor: "1",
        taxRate: "0",
        isTaxInclusive: false,
      };
    }
    updatedItems[index] = calculateItemTotals(updatedItems[index]);
    setItems(updatedItems);
    updateFormTotals(updatedItems);
    setPOOpen(null);
    setPOSearchQuery("");
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/stores/${currentStoreId}/goods-receipts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`] });
      toast({ title: "Success", description: "Goods receipt created successfully." });
      navigate('/goods-receipts');
    },
    onError: (error) => {
      let msg = error.message;
      try {
        const jsonPart = msg.substring(msg.indexOf('{'));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PUT', `/api/stores/${currentStoreId}/goods-receipts/${goodsReceiptId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId] });
      toast({ title: "Success", description: "Goods receipt updated successfully." });
    },
    onError: (error) => {
      let msg = error.message;
      try {
        const jsonPart = msg.substring(msg.indexOf('{'));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) msg = parsed.error;
      } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  });

  const { showDialog: showNavGuardDialog, confirmNavigation, cancelNavigation } = useUnsavedChangesGuard({
    isDirty: () => {
      if (isViewOnly) return false;
      const hasSupplier = !!form.getValues('supplierName');
      const hasNonEmptyItems = items.some(item => item.description && item.description.trim() !== '');
      return hasSupplier || hasNonEmptyItems;
    },
    isSubmitting: createMutation.isPending || updateMutation.isPending,
  });

  const invalidateTransactions = () => {
    const storeId = form.getValues('storeId');
    if (storeId) {
      const transactionKey = `/api/stores/${storeId}/transactions`;
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          typeof query.queryKey[0] === 'string' && 
          query.queryKey[0] === transactionKey
      });
    }
  };

  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', `/api/stores/${currentStoreId}/goods-receipts/${goodsReceiptId}/payments`, data);
    },
    onSuccess: () => {
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId] });
      invalidateTransactions();
      setPaymentDialogOpen(false);
      resetPaymentForm();
      toast({ title: "Success", description: "Payment added successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to add payment: ${error.message}`, variant: "destructive" });
    }
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ paymentId, data }: { paymentId: number, data: any }) => {
      return apiRequest('PUT', `/api/stores/${currentStoreId}/goods-receipts/${goodsReceiptId}/payments/${paymentId}`, data);
    },
    onSuccess: () => {
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId] });
      invalidateTransactions();
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      resetPaymentForm();
      toast({ title: "Success", description: "Payment updated successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to update payment: ${error.message}`, variant: "destructive" });
    }
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: number) => {
      return apiRequest('DELETE', `/api/stores/${currentStoreId}/goods-receipts/${goodsReceiptId}/payments/${paymentId}`, undefined);
    },
    onSuccess: () => {
      refetchPayments();
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId, 'payments'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`, goodsReceiptId] });
      invalidateTransactions();
      toast({ title: "Success", description: "Payment deleted successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to delete payment: ${error.message}`, variant: "destructive" });
    }
  });

  const resetPaymentForm = () => {
    setPaymentForm({
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      paymentType: '',
      cashAccountId: null,
      amount: '',
      reference: '',
      notes: ''
    });
  };

  const handlePaymentSubmit = () => {
    if (editingPayment) {
      updatePaymentMutation.mutate({ paymentId: editingPayment.id, data: paymentForm });
    } else {
      createPaymentMutation.mutate(paymentForm);
    }
  };

  const openEditPayment = (payment: GoodsReceiptPayment) => {
    setEditingPayment(payment);
    setPaymentForm({
      paymentDate: payment.paymentDate,
      paymentType: payment.paymentType,
      cashAccountId: payment.cashAccountId || null,
      amount: String(payment.amount),
      reference: payment.reference || '',
      notes: payment.notes || ''
    });
    setPaymentDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    const formattedData = {
      goodsReceipt: {
        ...data,
        receiptDate: format(data.receiptDate, 'yyyy-MM-dd'),
        dueDate: data.dueDate ? format(data.dueDate, 'yyyy-MM-dd') : null,
      },
      items: items.map(item => ({
        ...item,
        purchaseOrderId: item.purchaseOrderId || null,
      }))
    };

    if (isEditing) {
      updateMutation.mutate(formattedData);
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const totalPaid = (receiptPayments || []).reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
  const totalAmount = parseFloat(form.watch("totalAmount") || "0");

  const getPOName = (poId: number | null | undefined) => {
    if (!poId) return null;
    return purchaseOrders?.find(po => po.id === poId)?.purchaseOrderNumber || null;
  };

  const isPOPrepaid = (poId: number | null | undefined) => {
    if (!poId) return false;
    return purchaseOrders?.find(po => po.id === poId)?.isPrepaid || false;
  };

  const getPrepaidStatus = (poId: number | null | undefined): { isPrepaid: boolean; isFullyPaid: boolean } => {
    if (!poId) return { isPrepaid: false, isFullyPaid: false };
    const po = purchaseOrders?.find(p => p.id === poId);
    if (!po?.isPrepaid) return { isPrepaid: false, isFullyPaid: false };
    const status = prepaidPOPaymentStatus[poId];
    return {
      isPrepaid: true,
      isFullyPaid: status?.isFullyPaid || false
    };
  };

  // Calculate prepaid amounts from PO payments for items from prepaid POs
  const prepaidAmount = items.reduce((sum, item) => {
    if (!item.purchaseOrderId) return sum;
    const status = getPrepaidStatus(item.purchaseOrderId);
    if (status.isPrepaid && status.isFullyPaid) {
      return sum + parseFloat(item.totalAmount || "0");
    }
    return sum;
  }, 0);
  
  const totalPaidIncludingPrepaid = totalPaid + prepaidAmount;
  const remainingBalance = totalAmount - totalPaidIncludingPrepaid;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/goods-receipts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isViewOnly 
              ? `Goods Receipt` 
              : isEditing 
                ? `Edit Goods Receipt` 
                : 'New Goods Receipt'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isViewOnly
              ? existingReceipt?.goodsReceipt?.receiptNumber || ''
              : isEditing 
                ? `Editing receipt ${existingReceipt?.goodsReceipt?.receiptNumber}` 
                : `Receipt Number: ${nextReceiptNumberData?.receiptNumber || '...'}`}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              {isViewOnly && (
                <TabsTrigger value="payments">
                  Payments {receiptPayments && receiptPayments.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{receiptPayments.length}</Badge>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="details">
              <fieldset disabled={isViewOnly} className="disabled:opacity-100">
              <Card>
                <CardHeader>
                  <CardTitle>Receipt Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="supplierName"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Supplier *</FormLabel>
                            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                    {field.value || "Select supplier"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command>
                                  <CommandInput placeholder="Search suppliers..." />
                                  <CommandList>
                                    <CommandEmpty>No supplier found.</CommandEmpty>
                                    <CommandGroup>
                                      {suppliers?.map((supplier) => (
                                        <CommandItem key={supplier.id} value={supplier.name} onSelect={() => selectSupplier(supplier)}>
                                          <Check className={cn("mr-2 h-4 w-4", form.watch("supplierId") === supplier.id ? "opacity-100" : "opacity-0")} />
                                          <div>
                                            <div className="font-medium">{supplier.name}</div>
                                            <div className="text-xs text-gray-500">{supplier.phone}</div>
                                          </div>
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

                      <FormField
                        control={form.control}
                        name="supplierDocNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supplier Doc Number (Invoice/DN)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., INV-2024-001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="supplierAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Supplier Address</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Supplier address..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="receiptDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt Date *</FormLabel>
                            <FormControl>
                              <Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(new Date(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Date</FormLabel>
                            <FormControl>
                              <Input type="date" value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Payment Status - Calculated automatically */}
                      {hasExistingId && (
                        <div>
                          <FormLabel>Status Pembayaran</FormLabel>
                          <div className="mt-2">
                            {totalPaid >= totalAmount && totalAmount > 0 ? (
                              <Badge className="bg-green-500 text-white">Terbayar</Badge>
                            ) : totalPaid > 0 ? (
                              <Badge className="bg-yellow-500 text-white">Terbayar Sebagian</Badge>
                            ) : (
                              <Badge variant="destructive">Belum Terbayar</Badge>
                            )}
                          </div>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Additional notes..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              </fieldset>
            </TabsContent>

            <TabsContent value="items">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Items</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" /> Add Row
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[200px]">Product</TableHead>
                          <TableHead className="w-[150px]">Linked PO</TableHead>
                          <TableHead className="w-[80px] text-right">Qty</TableHead>
                          <TableHead className="w-[100px] text-right">Unit Cost</TableHead>
                          <TableHead className="w-[70px] text-right">Tax %</TableHead>
                          <TableHead className="w-[80px] text-right">Discount</TableHead>
                          <TableHead className="w-[100px] text-right">Subtotal</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="p-1">
                              <Popover open={productOpen === index} onOpenChange={(open) => setProductOpen(open ? index : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" role="combobox" className="w-full justify-start h-8 px-2 font-normal text-left">
                                    {item.description || <span className="text-muted-foreground">Select...</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search products..." />
                                    <CommandList>
                                      <CommandEmpty>No product found.</CommandEmpty>
                                      <CommandGroup>
                                        {products?.map((product) => (
                                          <CommandItem key={product.id} value={product.name} onSelect={() => selectProduct(index, product)}>
                                            <Check className={cn("mr-2 h-4 w-4", item.productId === product.id ? "opacity-100" : "opacity-0")} />
                                            <div>
                                              <div className="font-medium">{product.name}</div>
                                              <div className="text-xs text-gray-500">{formatCurrency(product.costPrice || 0)}</div>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="p-1">
                              <Popover open={poOpen === index} onOpenChange={(open) => { setPOOpen(open ? index : null); if (!open) setPOSearchQuery(""); }}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" role="combobox" className="w-full justify-start h-8 px-2 font-normal text-left" disabled={!item.productId || !form.watch("supplierId")}>
                                    {item.purchaseOrderId ? (
                                      <div className="flex items-center gap-1">
                                        <span>{getPOName(item.purchaseOrderId)}</span>
                                        {(() => {
                                          const status = getPrepaidStatus(item.purchaseOrderId);
                                          if (status.isPrepaid && status.isFullyPaid) {
                                            return <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-green-100 text-green-700">Lunas</Badge>;
                                          } else if (status.isPrepaid) {
                                            return <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700">PP</Badge>;
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search PO..." value={poSearchQuery} onValueChange={setPOSearchQuery} />
                                    <CommandList>
                                      <CommandEmpty>No PO found.</CommandEmpty>
                                      <CommandGroup>
                                        <CommandItem onSelect={() => selectPO(index, null)}>
                                          <Check className={cn("mr-2 h-4 w-4", !item.purchaseOrderId ? "opacity-100" : "opacity-0")} />
                                          No PO Link
                                        </CommandItem>
                                        {getFilteredPOs(item.productId).map((po) => {
                                          const poStatus = getPrepaidStatus(po.id);
                                          return (
                                            <CommandItem key={po.id} value={po.purchaseOrderNumber} onSelect={() => selectPO(index, po)}>
                                              <Check className={cn("mr-2 h-4 w-4", item.purchaseOrderId === po.id ? "opacity-100" : "opacity-0")} />
                                              <div className="flex flex-wrap items-center gap-1">
                                                <span>{po.purchaseOrderNumber}</span>
                                                {po.useFakturPajak && <Badge variant="outline" className="text-xs">PPN</Badge>}
                                                {poStatus.isPrepaid && poStatus.isFullyPaid && (
                                                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Lunas</Badge>
                                                )}
                                                {poStatus.isPrepaid && !poStatus.isFullyPaid && (
                                                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Prepaid</Badge>
                                                )}
                                              </div>
                                            </CommandItem>
                                          );
                                        })}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="p-1 min-w-[80px]">
                              <Input 
                                type="number" 
                                step="1"
                                min="1"
                                value={(() => {
                                  const num = parseFloat(item.quantity) || 0;
                                  return Number.isInteger(num) ? String(num) : item.quantity;
                                })()} 
                                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value) || 1;
                                  if (Number.isInteger(num)) {
                                    updateItem(index, 'quantity', String(num));
                                  }
                                }}
                                className="h-8 text-center font-medium" 
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              {item.isTaxInclusive && parseFloat(item.taxRate || "0") > 0 ? (
                                <div className="h-8 flex items-center justify-end px-3 text-sm font-medium bg-muted rounded-md">
                                  {formatCurrency((parseFloat(item.unitCost) / (1 + parseFloat(item.taxRate || "0") / 100)).toFixed(2))}
                                </div>
                              ) : (
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={item.unitCost} 
                                  onChange={(e) => updateItem(index, 'unitCost', e.target.value)} 
                                  className={`h-8 text-right ${item.purchaseOrderId ? 'bg-muted' : ''}`}
                                  readOnly={!!item.purchaseOrderId}
                                />
                              )}
                            </TableCell>
                            <TableCell className="p-1">
                              <Input 
                                type="number" 
                                step="0.01" 
                                value={item.taxRate} 
                                onChange={(e) => updateItem(index, 'taxRate', e.target.value)} 
                                className="h-8 text-right" 
                                readOnly={!!item.purchaseOrderId}
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input 
                                type="number" 
                                step="0.01" 
                                value={item.discount} 
                                onChange={(e) => updateItem(index, 'discount', e.target.value)} 
                                className="h-8 text-right" 
                              />
                            </TableCell>
                            <TableCell className="p-1 text-right font-medium">
                              {formatCurrency(item.subtotal || "0")}
                            </TableCell>
                            <TableCell className="p-1">
                              {items.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeItem(index)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Return/Damage Section */}
                  {items.some(item => parseFloat(item.returnQuantity || "0") > 0) && (
                    <div className="mt-4 border rounded-lg p-4 bg-orange-50">
                      <h4 className="font-medium text-orange-800 mb-3">Return/Damage Items</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="w-[80px] text-right">Return Qty</TableHead>
                            <TableHead className="w-[100px]">Status</TableHead>
                            <TableHead className="w-[80px] text-right">Returned</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.filter(item => parseFloat(item.returnQuantity || "0") > 0).map((item, idx) => {
                            const originalIndex = items.findIndex(i => i === item);
                            const returnQty = parseFloat(item.returnQuantity || "0");
                            const returnedQty = parseFloat(item.returnedQuantity || "0");
                            const autoStatus = returnedQty >= returnQty ? "Returned" : "Return Pending";
                            return (
                              <TableRow key={idx}>
                                <TableCell>{item.description}</TableCell>
                                <TableCell className="text-right">{item.returnQuantity}</TableCell>
                                <TableCell>
                                  <span className={`text-xs px-2 py-1 rounded ${returnedQty >= returnQty ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {autoStatus}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Input 
                                    type="number" 
                                    step="1" 
                                    min="0"
                                    max={item.returnQuantity}
                                    value={item.returnedQuantity} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const returned = parseFloat(val || "0");
                                      const rqty = parseFloat(item.returnQuantity || "0");
                                      const newStatus = returned >= rqty ? 'returned' : 'pending';
                                      const updatedItems = [...items];
                                      updatedItems[originalIndex] = { 
                                        ...updatedItems[originalIndex], 
                                        returnedQuantity: val, 
                                        returnStatus: newStatus as any 
                                      };
                                      setItems(updatedItems);
                                    }} 
                                    className="h-8 text-right w-16" 
                                  />
                                </TableCell>
                                <TableCell>{item.returnReason}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Add return fields inline for each item */}
                  <div className="mt-4 space-y-2">
                    {items.map((item, index) => (
                      item.productId > 0 && (
                        <div key={index} className="flex items-center gap-4 text-sm">
                          <span className="w-40 truncate text-gray-600">{item.description}:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Return:</span>
                            <Input 
                              type="number" 
                              step="1" 
                              min="0"
                              value={item.returnQuantity} 
                              onChange={(e) => {
                                updateItem(index, 'returnQuantity', e.target.value);
                                if (parseFloat(e.target.value) > 0 && item.returnStatus === 'none') {
                                  updateItem(index, 'returnStatus', 'pending');
                                }
                              }} 
                              className="h-7 w-16 text-right" 
                              placeholder="0"
                            />
                          </div>
                          {parseFloat(item.returnQuantity || "0") > 0 && (
                            <Input 
                              value={item.returnReason} 
                              onChange={(e) => updateItem(index, 'returnReason', e.target.value)} 
                              className="h-7 w-40" 
                              placeholder="Reason (e.g., Dented)"
                            />
                          )}
                        </div>
                      )
                    ))}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(form.watch("subtotal") || "0")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax:</span>
                        <span className="font-medium">{formatCurrency(form.watch("taxAmount") || "0")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Discount:</span>
                        <span className="font-medium">-{formatCurrency(form.watch("discount") || "0")}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-bold">Total:</span>
                        <span className="font-bold text-lg">{formatCurrency(form.watch("totalAmount") || "0")}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {isViewOnly && (
              <TabsContent value="payments">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Payments</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={() => { resetPaymentForm(); setEditingPayment(null); setPaymentDialogOpen(true); }} disabled={remainingBalance <= 0}>
                      <Plus className="h-4 w-4 mr-2" /> Add Payment
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Total Amount</p>
                          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Payments</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                        </div>
                        {prepaidAmount > 0 && (
                          <div>
                            <p className="text-sm text-gray-600">Prepaid via PO</p>
                            <p className="text-xl font-bold text-blue-600">{formatCurrency(prepaidAmount)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-600">Balance</p>
                          <p className={cn("text-xl font-bold", remainingBalance > 0 ? "text-red-600" : "text-green-600")}>
                            {formatCurrency(remainingBalance)}
                          </p>
                        </div>
                      </div>
                      {prepaidAmount > 0 && (
                        <div className="mt-3 text-center">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            Items from prepaid PO(s) - no additional payment required
                          </Badge>
                        </div>
                      )}
                    </div>

                    {receiptPayments && receiptPayments.length > 0 ? (
                      <div className="space-y-3">
                        {receiptPayments.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-green-100 rounded-full">
                                <DollarSign className="h-5 w-5 text-green-600" />
                              </div>
                              <div>
                                <p className="font-medium">{formatCurrency(payment.amount)}</p>
                                <p className="text-sm text-gray-500">{payment.paymentType} - {format(new Date(payment.paymentDate), 'dd MMM yyyy')}</p>
                                {payment.reference && <p className="text-xs text-gray-400">Ref: {payment.reference}</p>}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => openEditPayment(payment)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => deletePaymentMutation.mutate(payment.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No payments recorded yet</p>
                        <p className="text-sm">Add a payment to track supplier payments</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

          </Tabs>
          <CardFooter className="flex justify-between pt-6">
            <Button type="button" variant="outline" onClick={() => navigate('/goods-receipts')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> {isViewOnly ? 'Back' : 'Cancel'}
            </Button>
            {!isViewOnly && (
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isEditing ? 'Update' : 'Create'} Goods Receipt
              </Button>
            )}
            {isViewOnly && (
              <Button type="button" onClick={() => navigate(`/goods-receipts/${goodsReceiptId}/edit`)}>
                <Save className="mr-2 h-4 w-4" />
                Edit Goods Receipt
              </Button>
            )}
          </CardFooter>
        </form>
      </Form>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
            <DialogDescription>Record a payment for this goods receipt</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Payment Date *</label>
              <Input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Cash Account *</label>
              <Select value={paymentForm.cashAccountId ? String(paymentForm.cashAccountId) : ''} onValueChange={(v) => {
                const accountId = parseInt(v);
                const account = cashAccounts?.find(a => a.id === accountId);
                setPaymentForm({ ...paymentForm, cashAccountId: accountId, paymentType: account?.name || '' });
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select cash account" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts?.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Amount *</label>
              <div className="flex gap-2 mt-1">
                <Input type="number" step="0.01" placeholder="0.00" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => setPaymentForm({ ...paymentForm, amount: remainingBalance.toFixed(2) })} disabled={remainingBalance <= 0}>
                  Full
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Reference</label>
              <Input placeholder="e.g., Transfer #123" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea placeholder="Additional notes..." value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePaymentSubmit} disabled={createPaymentMutation.isPending || updatePaymentMutation.isPending}>
              {editingPayment ? 'Update' : 'Add'} Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog open={showNavGuardDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
}
