import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { X, Save, Plus, Trash2, ArrowLeft, Package, ChevronsUpDown, Check, Edit, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { insertPurchaseOrderSchema } from "@shared/schema";
import type { CashAccount } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { useStore } from '@/lib/store-context';

// Extended schema for the form
const extendedPurchaseOrderSchema = insertPurchaseOrderSchema.extend({
  orderDate: z.coerce.date(),
  expectedDeliveryDate: z.coerce.date().optional(),
});

// Schema for purchase order items
const purchaseOrderItemSchema = z.object({
  id: z.number().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unitCost: z.string().min(1, "Unit cost is required"),
  taxRate: z.string().optional(),
  subtotal: z.string().optional(),
  taxAmount: z.string().optional(),
  totalAmount: z.string().optional(),
  productId: z.number().nullable().optional(),
  productUnitId: z.number().nullable().optional(),
  baseQuantity: z.string().optional(),
  baseCost: z.string().optional(),
  conversionFactor: z.string().optional(),
  unitLabel: z.string().optional(),
});

const purchaseOrderFormSchema = z.object({
  purchaseOrder: extendedPurchaseOrderSchema,
  items: z.array(purchaseOrderItemSchema).min(1, "At least one item is required"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;
type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;

interface PurchaseOrderFormProps {
  purchaseOrderId?: number;
  onSuccess?: () => void;
}

// Purchase Order Item Row Component
interface PurchaseOrderItemRowProps {
  index: number;
  item: PurchaseOrderItem;
  products: any[];
  productUnitsMap: Record<number, any[]>;
  updateItem: (index: number, field: string, value: string) => void;
  updateItemUnit: (index: number, unitId: number | null, unitLabel: string, conversionFactor: string) => void;
  removeItem: (index: number) => void;
  selectProduct: (index: number, productId: number) => void;
  canRemove: boolean;
}

function PurchaseOrderItemRow({
  index,
  item,
  products,
  productUnitsMap,
  updateItem,
  updateItemUnit,
  removeItem,
  selectProduct,
  canRemove
}: PurchaseOrderItemRowProps) {
  const [productOpen, setProductOpen] = useState(false);

  const handleProductSelect = (productId: number) => {
    selectProduct(index, productId);
    setProductOpen(false);
  };

  const selectedProduct = item.productId ? products.find(p => p.id === item.productId) : null;
  const availableUnits = item.productId ? (productUnitsMap[item.productId] || []) : [];
  const hasMultipleUnits = availableUnits.length > 0;
  
  const handleUnitChange = (value: string) => {
    if (value === 'base' || value === '') {
      updateItemUnit(index, null, selectedProduct?.unit || '', '1');
    } else {
      const unitId = parseInt(value);
      const unit = availableUnits.find(u => u.id === unitId);
      if (unit) {
        updateItemUnit(index, unitId, unit.unitLabel, unit.conversionFactor);
      }
    }
  };

  const conversionFactor = parseFloat(item.conversionFactor || '1') || 1;
  const unitCost = parseFloat(item.unitCost || '0') || 0;
  const baseCostValue = conversionFactor > 0 ? unitCost / conversionFactor : 0;

  return (
    <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
      <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
      <td className="px-3 py-2">
        <Popover open={productOpen} onOpenChange={setProductOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={productOpen}
              className="w-full justify-between text-sm h-9 px-2 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            >
              <span className="truncate text-left">
                {selectedProduct ? selectedProduct.name : (item.description || "Select product...")}
              </span>
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search products..." />
              <CommandList>
                <CommandEmpty>No product found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="manual"
                    onSelect={() => {
                      selectProduct(index, 0);
                      setProductOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${!item.productId ? "opacity-100" : "opacity-0"}`} />
                    Enter manually
                  </CommandItem>
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.name}
                      onSelect={() => handleProductSelect(product.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${item.productId === product.id ? "opacity-100" : "opacity-0"}`}
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span>{product.name}</span>
                          {product.productType === 'bundle' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                              BUNDLE
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">Cost: {formatCurrency(product.costPrice || '0')}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </td>
      <td className="px-3 py-2 min-w-[80px]">
        <Input
          type="number"
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
          placeholder="1"
          min="1"
          step="1"
          className="h-8 text-sm text-center font-medium w-20"
        />
      </td>
      <td className="px-3 py-2">
        {hasMultipleUnits ? (
          <Select
            value={item.productUnitId?.toString() || 'base'}
            onValueChange={handleUnitChange}
          >
            <SelectTrigger className="h-8 text-sm w-24">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">{selectedProduct?.unit || 'pcs'}</SelectItem>
              {availableUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id.toString()}>
                  {unit.unitLabel} ({unit.conversionFactor}x)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-gray-600">{item.unitLabel || selectedProduct?.unit || '-'}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col">
          <Input
            type="number"
            value={item.unitCost}
            onChange={(e) => updateItem(index, 'unitCost', e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="h-8 text-sm text-right"
          />
          {conversionFactor > 1 && (
            <span className="text-xs text-blue-600 text-right mt-0.5">
              = {formatCurrency(baseCostValue.toFixed(2))}/{selectedProduct?.unit || 'pcs'}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right text-sm font-medium">
        {formatCurrency(item.subtotal || "0")}
      </td>
      <td className="px-3 py-2 text-center">
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeItem(index)}
            className="text-gray-400 hover:text-red-600 p-1 h-8 w-8"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
}

export function PurchaseOrderForm({ purchaseOrderId, onSuccess }: PurchaseOrderFormProps) {
  const { currentStoreId } = useStore();

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    {
      id: undefined,
      description: "",
      quantity: "1",
      unitCost: "0",
      taxRate: "0", // Default to 0%, will be set based on useFakturPajak
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
      productId: null
    }
  ]);
  
  // Supplier combobox state
  const [supplierComboboxOpen, setSupplierComboboxOpen] = useState(false);
  
  // Back confirmation dialog state
  const [showBackConfirmDialog, setShowBackConfirmDialog] = useState(false);
  
  // PO Payment state (for prepaid POs)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    amount: '',
    cashAccountId: '',
    notes: ''
  });
  
  // Store original loaded data for comparison-based change detection
  const originalDataRef = useRef<string | null>(null);
  
  // Product units map - stores units for each product
  const [productUnitsMap, setProductUnitsMap] = useState<Record<number, any[]>>({});
  
  // Helper function to create a comparable snapshot of form data
  const createFormSnapshot = (poValues: any, itemsArray: PurchaseOrderItem[]): string => {
    const snapshot = {
      supplierName: poValues?.supplierName,
      orderDate: poValues?.orderDate?.toISOString?.() || poValues?.orderDate,
      expectedDeliveryDate: poValues?.expectedDeliveryDate?.toISOString?.() || poValues?.expectedDeliveryDate,
      notes: poValues?.notes || '',
      useFakturPajak: poValues?.useFakturPajak || false,
      isPrepaid: poValues?.isPrepaid || false,
      items: itemsArray.map(item => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
      }))
    };
    return JSON.stringify(snapshot);
  };
  
  // Function to check if there are unsaved changes by comparing with original
  const hasUnsavedChanges = (): boolean => {
    if (!originalDataRef.current) {
      // For new POs, check if any meaningful data has been entered
      if (!purchaseOrderId) {
        const hasItems = items.some(item => 
          item.productId || (item.description && item.description.trim() !== '')
        );
        const poValues = form.getValues('purchaseOrder');
        const hasSupplier = !!poValues?.supplierName;
        const hasNotes = !!(poValues?.notes && poValues.notes.trim() !== '');
        return hasItems || hasSupplier || hasNotes;
      }
      return false;
    }
    
    const currentSnapshot = createFormSnapshot(form.getValues('purchaseOrder'), items);
    return currentSnapshot !== originalDataRef.current;
  };
  
  // Handle back button with confirmation
  const handleBack = () => {
    const poValues = form.getValues('purchaseOrder');
    const hasSupplier = poValues.supplierName && poValues.supplierName.trim() !== '';
    const hasNonEmptyItems = items.some(item => item.description && item.description.trim() !== '');
    const hasMeaningfulData = hasSupplier || hasNonEmptyItems;
    
    if (hasUnsavedChanges() && hasMeaningfulData) {
      setShowBackConfirmDialog(true);
    } else {
      navigate(purchaseOrderId ? `/purchase-orders/${purchaseOrderId}` : '/purchase-orders');
    }
  };
  
  // Discard changes and go back
  const discardAndGoBack = () => {
    setShowBackConfirmDialog(false);
    navigate(purchaseOrderId ? `/purchase-orders/${purchaseOrderId}` : '/purchase-orders');
  };

  // Fetch suppliers for the dropdown
  const { data: suppliers } = useQuery<any[]>({
    queryKey: [`/api/stores/${currentStoreId}/suppliers`],
    enabled: !!currentStoreId,
  });

  // Fetch products for product selection
  const { data: products = [] } = useQuery<any[]>({
    queryKey: [`/api/products`, { storeId: currentStoreId }],
    queryFn: async () => {
      const res = await fetch(`/api/products?storeId=${currentStoreId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled: !!currentStoreId,
  });

  // Fetch current user for default notes and tax rate
  const { data: currentUser } = useQuery<any>({
    queryKey: ['/api/user'],
  });

  // Fetch existing purchase order for edit mode
  const { data: existingPO, isLoading: isLoadingPO } = useQuery<any>({
    queryKey: [`/api/stores/${currentStoreId}/purchase-orders`, purchaseOrderId],
    enabled: !!purchaseOrderId && !!currentStoreId,
  });

  // For new purchase orders, fetch the next PO number preview with fallback
  const { data: nextPONumberData, isError: isNumberError } = useQuery<{ purchaseOrderNumber: string }>({
    queryKey: [`/api/stores/${currentStoreId}/purchase-orders/next-number`],
    enabled: !purchaseOrderId && !!currentStoreId, // Only for new purchase orders
  });
  
  const generateFallbackPONumber = () => {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    return `PO-${year}${month}-0001`;
  };
  
  const nextPONumber = nextPONumberData?.purchaseOrderNumber || 
    (isNumberError ? generateFallbackPONumber() : null);

  // Fetch PO payments for prepaid POs
  const { data: poPayments = [], refetch: refetchPayments } = useQuery<any[]>({
    queryKey: [`/api/stores/${currentStoreId}/purchase-orders`, purchaseOrderId, 'payments'],
    enabled: !!purchaseOrderId && !!currentStoreId,
  });

  // Fetch cash accounts for payment recording
  const { data: cashAccounts = [] } = useQuery<CashAccount[]>({
    queryKey: [`/api/stores/${currentStoreId}/cash-accounts`],
    enabled: !!currentStoreId,
  });

  // Form setup
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderFormSchema),
    defaultValues: {
      purchaseOrder: {
        storeId: currentStoreId,
        supplierId: null,
        supplierName: "",
        supplierEmail: "",
        supplierPhone: "",
        supplierAddress: "",
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        status: "pending",
        useFakturPajak: false,
        isPrepaid: false,
        subtotal: "0",
        taxRate: "10",
        taxAmount: "0",
        discount: "0",
        shipping: "0",
        totalAmount: "0",
        notes: ""
      },
      items: items
    }
  });

  // Watch the useFakturPajak toggle
  const useFakturPajak = form.watch('purchaseOrder.useFakturPajak');
  
  // Watch the isPrepaid toggle
  const isPrepaid = form.watch('purchaseOrder.isPrepaid');
  
  // Get the global tax rate from user settings
  const globalTaxRate = currentUser?.defaultTaxRate || 11;

  // Track if we've already loaded items for this PO
  const [itemsLoaded, setItemsLoaded] = useState(false);
  
  // Track previous useFakturPajak value to detect actual changes
  const prevUseFakturPajakRef = useRef(useFakturPajak);

  // Update all items' tax rates when useFakturPajak toggle changes
  useEffect(() => {
    // Only run when useFakturPajak actually changes (not on initial render)
    if (prevUseFakturPajakRef.current !== useFakturPajak) {
      prevUseFakturPajakRef.current = useFakturPajak;
      
      const newTaxRate = useFakturPajak ? globalTaxRate.toString() : "0";
      const updatedItems = items.map(item => {
        const quantity = parseFloat(item.quantity || '1') || 1;
        const unitCost = parseFloat(item.unitCost || '0') || 0;
        const taxRateValue = parseFloat(newTaxRate) || 0;
        const subtotal = quantity * unitCost;
        const taxAmount = (subtotal * taxRateValue) / 100;
        const totalAmount = subtotal + taxAmount;
        
        return {
          ...item,
          taxRate: newTaxRate,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2)
        };
      });
      setItems(updatedItems);
      form.setValue('items', updatedItems);
      updateTotals(updatedItems);
    }
  }, [useFakturPajak, globalTaxRate]);

  // Populate form with existing purchase order data when editing
  useEffect(() => {
    if (existingPO && purchaseOrderId && !itemsLoaded) {
      // Set form values from existing PO
      form.reset({
        purchaseOrder: {
          storeId: existingPO.storeId || 1,
          supplierId: existingPO.supplierId,
          supplierName: existingPO.supplierName || '',
          supplierEmail: existingPO.supplierEmail || '',
          supplierPhone: existingPO.supplierPhone || '',
          supplierAddress: existingPO.supplierAddress || '',
          orderDate: existingPO.orderDate ? new Date(existingPO.orderDate) : new Date(),
          expectedDeliveryDate: existingPO.expectedDeliveryDate ? new Date(existingPO.expectedDeliveryDate) : new Date(),
          status: existingPO.status || 'pending',
          useFakturPajak: existingPO.useFakturPajak || false,
          isPrepaid: existingPO.isPrepaid || false,
          subtotal: existingPO.subtotal?.toString() || '0',
          taxRate: existingPO.taxRate?.toString() || '10',
          taxAmount: existingPO.taxAmount?.toString() || '0',
          discount: existingPO.discount?.toString() || '0',
          shipping: existingPO.shipping?.toString() || '0',
          totalAmount: existingPO.totalAmount?.toString() || '0',
          notes: existingPO.notes || ''
        },
        items: []
      });
      
      // Set items from existing PO
      if (existingPO.items && Array.isArray(existingPO.items) && existingPO.items.length > 0) {
        const loadedItems = existingPO.items.map((item: any) => ({
          id: item.id,
          description: item.description || '',
          quantity: item.quantity?.toString() || '1',
          unitCost: item.unitCost?.toString() || '0',
          taxRate: item.taxRate?.toString() || '10',
          subtotal: item.subtotal?.toString() || '0',
          taxAmount: item.taxAmount?.toString() || '0',
          totalAmount: item.totalAmount?.toString() || '0',
          productId: item.productId || null
        }));
        setItems(loadedItems);
        setItemsLoaded(true);
        
        // Store original data snapshot for comparison-based change detection
        // Create snapshot immediately from the API data (not from state)
        const snapshotItems = loadedItems.map((item: any) => ({
          productId: item.productId || null,
          description: item.description || "",
          quantity: item.quantity || "1",
          unitCost: item.unitCost || "0",
        }));
        
        originalDataRef.current = createFormSnapshot({
          supplierName: existingPO.supplierName || '',
          orderDate: existingPO.orderDate ? new Date(existingPO.orderDate) : new Date(),
          expectedDeliveryDate: existingPO.expectedDeliveryDate ? new Date(existingPO.expectedDeliveryDate) : null,
          notes: existingPO.notes || '',
          useFakturPajak: existingPO.useFakturPajak || false,
          isPrepaid: existingPO.isPrepaid || false,
        }, snapshotItems as any);
      } else {
        // Keep the default empty item
        setItemsLoaded(true);
      }
    }
  }, [existingPO, purchaseOrderId, itemsLoaded]);

  // Handle supplier selection and auto-fill fields
  const handleSupplierSelect = (supplierId: number) => {
    const supplier = suppliers?.find(s => s.id === supplierId);
    if (supplier) {
      form.setValue('purchaseOrder.supplierId', supplierId);
      form.setValue('purchaseOrder.supplierName', supplier.name || '');
      form.setValue('purchaseOrder.supplierEmail', supplier.email || '');
      form.setValue('purchaseOrder.supplierPhone', supplier.phone || '');
      form.setValue('purchaseOrder.supplierAddress', supplier.address || '');
    }
    setSupplierComboboxOpen(false);
  };

  // Create/update purchase order mutation
  const mutation = useMutation({
    mutationFn: async (values: PurchaseOrderFormValues) => {
      const purchaseOrderData = {
        ...values.purchaseOrder,
        orderDate: values.purchaseOrder.orderDate.toISOString(),
        expectedDeliveryDate: values.purchaseOrder.expectedDeliveryDate?.toISOString(),
      };

      const formattedValues = {
        ...values,
        purchaseOrder: purchaseOrderData
      };

      if (purchaseOrderId) {
        return apiRequest('PUT', `/api/stores/${currentStoreId}/purchase-orders/${purchaseOrderId}`, formattedValues);
      } else {
        return apiRequest('POST', `/api/stores/${currentStoreId}/purchase-orders`, formattedValues);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/purchase-orders`] });
      toast({
        title: purchaseOrderId ? "Purchase order updated" : "Purchase order created",
        description: purchaseOrderId ? "Purchase order has been updated successfully." : "Purchase order has been created successfully.",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${purchaseOrderId ? 'update' : 'create'} purchase order: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const { showDialog: showNavGuardDialog, confirmNavigation, cancelNavigation } = useUnsavedChangesGuard({
    isDirty: () => {
      const poValues = form.getValues('purchaseOrder');
      const hasSupplier = poValues.supplierName && poValues.supplierName.trim() !== '';
      const hasNonEmptyItems = items.some(item => item.description && item.description.trim() !== '');
      const hasMeaningfulData = hasSupplier || hasNonEmptyItems;
      return hasUnsavedChanges() && hasMeaningfulData;
    },
    isSubmitting: mutation.isPending,
  });

  // Add new item
  const addItem = () => {
    const isFakturPajak = form.getValues('purchaseOrder.useFakturPajak');
    const newItem: PurchaseOrderItem = {
      id: undefined,
      description: "",
      quantity: "1",
      unitCost: "0",
      taxRate: isFakturPajak ? globalTaxRate.toString() : "0",
      subtotal: "0",
      taxAmount: "0",
      totalAmount: "0",
      productId: null
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    form.setValue('items', newItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      form.setValue('items', newItems);
      updateTotals(newItems);
    }
  };

  // Update item
  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate totals for this item
    const quantity = parseFloat(newItems[index].quantity || '0') || 0;
    const unitCost = parseFloat(newItems[index].unitCost || '0') || 0;
    const taxRate = parseFloat(newItems[index].taxRate || '0') || 0;
    const conversionFactor = parseFloat(newItems[index].conversionFactor || '1') || 1;
    
    const subtotal = quantity * unitCost;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;
    
    newItems[index].subtotal = subtotal.toFixed(2);
    newItems[index].taxAmount = taxAmount.toFixed(2);
    newItems[index].totalAmount = totalAmount.toFixed(2);
    
    // Update base quantity and base cost when quantity or unitCost changes
    if (field === 'quantity' || field === 'unitCost') {
      newItems[index].baseQuantity = (quantity * conversionFactor).toFixed(2);
      newItems[index].baseCost = conversionFactor > 0 ? (unitCost / conversionFactor).toFixed(2) : '0';
    }
    
    setItems(newItems);
    form.setValue('items', newItems);
    updateTotals(newItems);
  };

  // Update totals
  const updateTotals = (currentItems: PurchaseOrderItem[]) => {
    const isFakturPajak = form.getValues('purchaseOrder.useFakturPajak');
    const taxRate = globalTaxRate;
    
    let subtotal = 0;
    let taxAmount = 0;
    
    if (isFakturPajak) {
      // Tax-inclusive pricing: stored prices include tax
      // DPP (base price) = fullPrice / (1 + taxRate/100)
      // PPN = fullPrice - DPP
      currentItems.forEach(item => {
        const fullPrice = parseFloat(item.subtotal || "0");
        const basePrice = fullPrice / (1 + taxRate / 100);
        const itemTax = fullPrice - basePrice;
        subtotal += basePrice;
        taxAmount += itemTax;
      });
    } else {
      // No tax separation - show full price only
      subtotal = currentItems.reduce((sum, item) => sum + (parseFloat(item.subtotal || "0")), 0);
      taxAmount = 0;
    }
    
    const discount = parseFloat(form.getValues('purchaseOrder.discount') || '0') || 0;
    const shipping = parseFloat(form.getValues('purchaseOrder.shipping') || '0') || 0;
    const totalAmount = subtotal + taxAmount - discount + shipping;
    
    form.setValue('purchaseOrder.subtotal', subtotal.toFixed(2));
    form.setValue('purchaseOrder.taxAmount', taxAmount.toFixed(2));
    form.setValue('purchaseOrder.taxRate', taxRate.toString());
    form.setValue('purchaseOrder.totalAmount', totalAmount.toFixed(2));
  };

  // Fetch product units for a product
  const fetchProductUnits = async (productId: number) => {
    if (!productId || productUnitsMap[productId]) return;
    try {
      const response = await fetch(`/api/stores/${currentStoreId}/products/${productId}/units`, { credentials: 'include' });
      if (response.ok) {
        const units = await response.json();
        setProductUnitsMap(prev => ({ ...prev, [productId]: units }));
      }
    } catch (error) {
      console.error('Failed to fetch product units:', error);
    }
  };

  // Update product selection for item
  const selectProduct = (index: number, productId: number) => {
    const newItems = [...items];
    
    if (productId === 0) {
      // Manual entry - clear product selection and reset totals
      newItems[index] = {
        ...newItems[index],
        description: '',
        unitCost: '0',
        productId: null,
        productUnitId: null,
        baseQuantity: '',
        baseCost: '',
        conversionFactor: '1',
        unitLabel: '',
        subtotal: '0',
        taxAmount: '0',
        totalAmount: '0'
      };
    } else {
      const product = products?.find(p => p.id === productId);
      if (product) {
        // Fetch product units for this product
        fetchProductUnits(productId);
        
        // Calculate quantities (conversion factor is 1 for base unit)
        const quantity = parseFloat(newItems[index].quantity || '1') || 1;
        const unitCost = parseFloat(product.costPrice || '0') || 0;
        const conversionFactor = 1; // Base unit
        const baseQuantity = quantity * conversionFactor;
        const baseCost = unitCost / conversionFactor;
        
        newItems[index] = {
          ...newItems[index],
          description: product.name,
          unitCost: product.costPrice || '0',
          productId: productId,
          productUnitId: null,
          baseQuantity: baseQuantity.toFixed(2),
          baseCost: baseCost.toFixed(2),
          conversionFactor: '1',
          unitLabel: product.unit || ''
        };
        
        // Recalculate totals
        const taxRate = parseFloat(newItems[index].taxRate || '10') || 10;
        const subtotal = quantity * unitCost;
        const taxAmount = (subtotal * taxRate) / 100;
        const totalAmount = subtotal + taxAmount;
        
        newItems[index].subtotal = subtotal.toFixed(2);
        newItems[index].taxAmount = taxAmount.toFixed(2);
        newItems[index].totalAmount = totalAmount.toFixed(2);
      }
    }
    
    setItems(newItems);
    form.setValue('items', newItems);
    updateTotals(newItems);
  };
  
  // Update item unit selection
  const updateItemUnit = (index: number, unitId: number | null, unitLabel: string, conversionFactor: string) => {
    const newItems = [...items];
    const product = products?.find(p => p.id === newItems[index].productId);
    
    newItems[index] = {
      ...newItems[index],
      productUnitId: unitId,
      unitLabel: unitLabel,
      conversionFactor: conversionFactor
    };
    
    // Recalculate base quantity and base cost
    const quantity = parseFloat(newItems[index].quantity || '1') || 1;
    const unitCost = parseFloat(newItems[index].unitCost || '0') || 0;
    const factor = parseFloat(conversionFactor) || 1;
    
    newItems[index].baseQuantity = (quantity * factor).toFixed(2);
    newItems[index].baseCost = factor > 0 ? (unitCost / factor).toFixed(2) : '0';
    
    // Recalculate totals
    const taxRate = parseFloat(newItems[index].taxRate || '0') || 0;
    const subtotal = quantity * unitCost;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;
    
    newItems[index].subtotal = subtotal.toFixed(2);
    newItems[index].taxAmount = taxAmount.toFixed(2);
    newItems[index].totalAmount = totalAmount.toFixed(2);
    
    setItems(newItems);
    form.setValue('items', newItems);
    updateTotals(newItems);
  };

  // Payment handlers for prepaid POs
  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentForm({
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      cashAccountId: '',
      notes: ''
    });
    setPaymentDialogOpen(true);
  };

  const handleEditPayment = (payment: any) => {
    setEditingPayment(payment);
    setPaymentForm({
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      cashAccountId: payment.cashAccountId?.toString() || '',
      notes: payment.notes || ''
    });
    setPaymentDialogOpen(true);
  };

  const handleSavePayment = async () => {
    if (!purchaseOrderId) return;

    if (!paymentForm.cashAccountId) {
      toast({ title: "Cash account wajib dipilih", variant: "destructive" });
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({ title: "Jumlah harus lebih dari 0", variant: "destructive" });
      return;
    }
    
    const payload = {
      ...paymentForm,
      paymentType: 'PO Prepaid',
      cashAccountId: parseInt(paymentForm.cashAccountId),
    };

    try {
      if (editingPayment) {
        await apiRequest('PUT', `/api/stores/${currentStoreId}/purchase-orders/${purchaseOrderId}/payments/${editingPayment.id}`, payload);
        toast({ title: "Pembayaran berhasil diperbarui" });
      } else {
        await apiRequest('POST', `/api/stores/${currentStoreId}/purchase-orders/${purchaseOrderId}/payments`, payload);
        toast({ title: "Pembayaran berhasil ditambahkan" });
      }
      setPaymentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/purchase-orders`, purchaseOrderId, 'payments'] });
    } catch (error) {
      toast({ title: "Failed to save payment", variant: "destructive" });
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!purchaseOrderId) return;
    
    try {
      await apiRequest('DELETE', `/api/stores/${currentStoreId}/purchase-orders/${purchaseOrderId}/payments/${paymentId}`);
      toast({ title: "Payment deleted successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/purchase-orders`, purchaseOrderId, 'payments'] });
    } catch (error) {
      toast({ title: "Failed to delete payment", variant: "destructive" });
    }
  };

  // Detect duplicate products in items
  const duplicateProducts = (() => {
    const productIds = items
      .filter(item => item.productId && item.productId !== null)
      .map(item => item.productId as number);
    
    const duplicates: { productId: number; productName: string; count: number }[] = [];
    const seen: Record<number, number> = {};
    
    productIds.forEach(id => {
      seen[id] = (seen[id] || 0) + 1;
    });
    
    Object.entries(seen).forEach(([id, count]) => {
      if (count > 1) {
        const product = products?.find(p => p.id === parseInt(id));
        duplicates.push({
          productId: parseInt(id),
          productName: product?.name || `Product #${id}`,
          count
        });
      }
    });
    
    return duplicates;
  })();

  const onSubmit = (values: PurchaseOrderFormValues) => {
    // Use items from state, not from form values
    const submitValues = {
      ...values,
      items: items
    };
    mutation.mutate(submitValues);
  };

  // Show loading state when fetching existing PO
  if (purchaseOrderId && isLoadingPO) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading purchase order...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {purchaseOrderId ? 'Edit Purchase Order' : 'New Purchase Order'}
          </h1>
          {!purchaseOrderId && nextPONumber && (
            <p className="text-sm text-gray-500 mt-1">Order Number: {nextPONumber}</p>
          )}
          {purchaseOrderId && existingPO?.purchaseOrderNumber && (
            <p className="text-sm text-gray-500 mt-1">Order Number: {existingPO.purchaseOrderNumber}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" type="button" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
      
      {/* Back Confirmation Dialog */}
      <AlertDialog open={showBackConfirmDialog} onOpenChange={setShowBackConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowBackConfirmDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={discardAndGoBack}>
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier Dropdown */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="purchaseOrder.supplierName"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Select Supplier *</FormLabel>
                      <Popover open={supplierComboboxOpen} onOpenChange={setSupplierComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={supplierComboboxOpen}
                              className="w-full justify-between font-normal"
                              data-testid="button-select-supplier"
                            >
                              {form.watch('purchaseOrder.supplierId')
                                ? (() => {
                                    const supplier = suppliers?.find((s: any) => s.id === form.watch('purchaseOrder.supplierId'));
                                    return supplier ? `${supplier.supplierNumber ? `[${supplier.supplierNumber}] ` : ''}${supplier.name}` : field.value || '-- Select Supplier --';
                                  })()
                                : field.value || "-- Select Supplier --"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search suppliers..." data-testid="input-search-supplier" />
                            <CommandList>
                              <CommandEmpty>No supplier found.</CommandEmpty>
                              <CommandGroup>
                                {suppliers?.map((supplier: any) => (
                                  <CommandItem
                                    key={supplier.id}
                                    value={`${supplier.supplierNumber || ''} ${supplier.name}`}
                                    onSelect={() => handleSupplierSelect(supplier.id)}
                                    data-testid={`supplier-option-${supplier.id}`}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        form.watch('purchaseOrder.supplierId') === supplier.id ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {supplier.supplierNumber && <span className="text-gray-500 mr-2">[{supplier.supplierNumber}]</span>}
                                    {supplier.name}
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
              
              <FormField
                control={form.control}
                name="purchaseOrder.supplierEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="email" placeholder="supplier@example.com" readOnly className="bg-gray-50" data-testid="input-supplier-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="purchaseOrder.supplierPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Phone number" readOnly className="bg-gray-50" data-testid="input-supplier-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="purchaseOrder.orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                        data-testid="input-order-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseOrder.useFakturPajak"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Gunakan Faktur Pajak (PPN {globalTaxRate}%)</FormLabel>
                      <FormDescription>
                        Centang jika PO ini menggunakan faktur pajak
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseOrder.isPrepaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-blue-50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Prepaid (Pembayaran di Muka)</FormLabel>
                      <FormDescription>
                        Centang jika PO ini dibayar terlebih dahulu sebelum barang datang
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="purchaseOrder.supplierAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ''} placeholder="Supplier address" readOnly className="bg-gray-50" data-testid="textarea-supplier-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Items</span>
                <Button type="button" onClick={addItem} size="sm" data-testid="button-add-item">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Duplicate product warning */}
              {duplicateProducts.length > 0 && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">Produk duplikat terdeteksi: </span>
                    {duplicateProducts.map((dup, idx) => (
                      <span key={dup.productId}>
                        {dup.productName} ({dup.count}x)
                        {idx < duplicateProducts.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    <span className="block mt-1 text-sm">Pertimbangkan untuk menggabungkan item yang sama.</span>
                  </AlertDescription>
                </Alert>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '30px' }}>#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '45%' }}>Product</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase" style={{ width: '120px' }}>Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" style={{ width: '80px' }}>Unit</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase" style={{ width: '140px' }}>Unit Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase" style={{ width: '120px' }}>Total</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase" style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <PurchaseOrderItemRow
                        key={item.id ? `item-${item.id}` : `new-${index}`}
                        index={index}
                        item={item}
                        products={products || []}
                        productUnitsMap={productUnitsMap}
                        updateItem={(idx, field, value) => updateItem(idx, field, value)}
                        updateItemUnit={updateItemUnit}
                        removeItem={removeItem}
                        selectProduct={selectProduct}
                        canRemove={items.length > 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Totals and Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="purchaseOrder.notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ''}
                          placeholder="Additional notes or terms..."
                          className="min-h-[120px]"
                          data-testid="textarea-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Faktur Pajak Toggle */}
                <FormField
                  control={form.control}
                  name="purchaseOrder.useFakturPajak"
                  render={({ field }) => (
                    <div className="flex justify-between items-center py-2 border-b mb-2">
                      <div>
                        <span className="font-medium">Faktur Pajak</span>
                        <p className="text-xs text-muted-foreground">Tampilkan DPP + PPN terpisah</p>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          setTimeout(() => updateTotals(items), 0);
                        }}
                      />
                    </div>
                  )}
                />

                {useFakturPajak ? (
                  <>
                    {/* DPP (Base Price) - when faktur pajak is active */}
                    <div className="flex justify-between">
                      <span>DPP (Dasar Pengenaan Pajak):</span>
                      <span data-testid="text-subtotal">{formatCurrency(form.watch('purchaseOrder.subtotal') || "0")}</span>
                    </div>
                    
                    {/* PPN (Tax) - when faktur pajak is active */}
                    <div className="flex justify-between">
                      <span>PPN ({globalTaxRate}%):</span>
                      <span data-testid="text-tax">{formatCurrency(form.watch('purchaseOrder.taxAmount') || "0")}</span>
                    </div>
                  </>
                ) : (
                  /* Full price only when faktur pajak is inactive */
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span data-testid="text-subtotal">{formatCurrency(form.watch('purchaseOrder.subtotal') || "0")}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span>Discount:</span>
                  <FormField
                    control={form.control}
                    name="purchaseOrder.discount"
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value || '0'}
                        type="number"
                        className="w-24 text-right"
                        min="0"
                        step="0.01"
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          updateTotals(items);
                        }}
                        data-testid="input-discount"
                      />
                    )}
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <span>Shipping:</span>
                  <FormField
                    control={form.control}
                    name="purchaseOrder.shipping"
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value || '0'}
                        type="number"
                        className="w-24 text-right"
                        min="0"
                        step="0.01"
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          updateTotals(items);
                        }}
                        data-testid="input-shipping"
                      />
                    )}
                  />
                </div>
                
                <hr />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span data-testid="text-total-amount">{formatCurrency(form.watch('purchaseOrder.totalAmount') || "0")}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Prepaid Payments Section - Only visible when isPrepaid is enabled */}
          {isPrepaid && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DollarSign className="mr-2 h-5 w-5" />
                    Pembayaran (Prepaid)
                  </div>
                  {purchaseOrderId && (
                    <Button type="button" onClick={handleAddPayment} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Payment
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!purchaseOrderId ? (
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium">Simpan PO Terlebih Dahulu</p>
                    <p className="text-sm">Klik "Create Purchase Order" untuk menyimpan, lalu Anda dapat mencatat pembayaran.</p>
                  </div>
                ) : (
                  <>
                    {/* Payment Summary */}
                    {(() => {
                      const poTotal = parseFloat(form.watch('purchaseOrder.totalAmount') || '0');
                      const totalPaid = poPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
                      const remaining = poTotal - totalPaid;
                      const paymentProgress = poTotal > 0 ? (totalPaid / poTotal) * 100 : 0;
                      const isFullyPaid = remaining <= 0;
                      
                      return (
                        <div className="bg-gray-50 rounded-lg p-4 mb-4">
                          <h4 className="text-lg font-medium mb-3">Payment Summary</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total PO</span>
                              <span className="font-medium">{formatCurrency(poTotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Sudah Dibayar</span>
                              <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Sisa</span>
                              <span className={`font-semibold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                {formatCurrency(Math.max(0, remaining))}
                              </span>
                            </div>
                            <Progress value={Math.min(100, paymentProgress)} className="h-2 mt-2" />
                          </div>
                          {isFullyPaid ? (
                            <div className="mt-3 p-2 bg-green-100 text-green-800 rounded text-sm text-center">
                              <CheckCircle className="h-4 w-4 inline mr-2" />
                              Lunas
                            </div>
                          ) : totalPaid > 0 ? (
                            <div className="mt-3 p-2 bg-orange-100 text-orange-800 rounded text-sm text-center">
                              <DollarSign className="h-4 w-4 inline mr-2" />
                              Sebagian Dibayar ({Math.round(paymentProgress)}%)
                            </div>
                          ) : (
                            <div className="mt-3 p-2 bg-red-100 text-red-800 rounded text-sm text-center">
                              <DollarSign className="h-4 w-4 inline mr-2" />
                              Belum Dibayar
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Payment Records */}
                    {poPayments.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <p className="text-sm">Belum ada pembayaran tercatat</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {poPayments.map((payment: any) => (
                              <tr key={payment.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {format(new Date(payment.paymentDate), 'dd MMM yyyy')}
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
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePayment(payment.id)}
                                    className="text-red-600 hover:text-red-700"
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
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment Dialog */}
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingPayment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pembayaran</label>
                  <Input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cash Account *</label>
                  <Select
                    value={paymentForm.cashAccountId}
                    onValueChange={(value) => setPaymentForm({ ...paymentForm, cashAccountId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih cash account" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashAccounts.filter(ca => ca.isActive).map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const poTotal = parseFloat(form.watch('purchaseOrder.totalAmount') || '0');
                        setPaymentForm({ ...paymentForm, amount: poTotal.toString() });
                      }}
                    >
                      Fill
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                  <Textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Catatan pembayaran (opsional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="button" onClick={handleSavePayment}>
                  {editingPayment ? 'Update' : 'Simpan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Actions */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-save">
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending 
                ? (purchaseOrderId ? 'Updating...' : 'Creating...') 
                : (purchaseOrderId ? 'Update Purchase Order' : 'Create Purchase Order')}
            </Button>
          </div>
        </form>
      </Form>
      <UnsavedChangesDialog open={showNavGuardDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
}