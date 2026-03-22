import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, MoreHorizontal, Package, Download, Upload, FileSpreadsheet, BarChart3, Layers, Scale, ArrowUpDown } from "lucide-react";
import * as XLSX from 'xlsx';
import { StockAdjustmentDialog } from "@/components/products/stock-adjustment-dialog";
import { Checkbox } from "@/components/ui/checkbox";

type UserData = {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role?: 'owner' | 'staff';
  permissions?: string[];
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";
import { useStore } from '@/lib/store-context';

type Category = {
  id: number;
  name: string;
  description?: string;
};

type Product = {
  id: number;
  name: string;
  sku: string;
  description: string;
  currentSellingPrice: string;
  costPrice?: string;
  lowestPrice?: string;
  minStock?: number;
  currentStock?: number;
  reservedQty?: number;
  availableStock?: number;
  pendingPOQuantity?: number;
  isLowStock?: boolean;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  productType?: 'standard' | 'bundle';
  unit?: string;
  categoryId?: number | null;
  category?: Category;
  isActive?: boolean;
};

type BundleComponent = {
  id?: number;
  componentProductId: number;
  quantity: string;
  componentProduct?: Product;
};

type ProductUnit = {
  id?: number;
  productId?: number;
  unitCode: string;
  unitLabel: string;
  conversionFactor: string;
  price: string | null;
  isDefault: boolean;
};

// Schema for product form validation
const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  description: z.string().optional(),
  currentSellingPrice: z.string().min(1, "Price is required"),
  costPrice: z.string().transform((val: string) => val === "" ? undefined : val).optional(),
  lowestPrice: z.string().transform((val: string) => val === "" ? undefined : val).optional(),
  productType: z.enum(["standard", "bundle"]).optional().default("standard"),
  baseUnit: z.string().optional(),
  minStock: z.coerce.number().min(0).optional().default(0),
  categoryId: z.number().nullable().optional(),
  isActive: z.boolean().default(true),
}).refine((data) => {
  if (data.lowestPrice && data.currentSellingPrice) {
    const price = parseFloat(data.currentSellingPrice);
    const lowestPrice = parseFloat(data.lowestPrice);
    return price >= lowestPrice;
  }
  return true;
}, {
  message: "Unit price cannot be lower than lowest price",
  path: ["currentSellingPrice"],
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const { currentStoreId } = useStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "standard" | "bundle">("all");
  const [nameSort, setNameSort] = useState<"none" | "asc" | "desc">("none");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [stockAdjustmentProduct, setStockAdjustmentProduct] = useState<Product | null>(null);
  const [isStockAdjustmentOpen, setIsStockAdjustmentOpen] = useState(false);
  const [bundleComponents, setBundleComponents] = useState<BundleComponent[]>([]);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: [`/api/stores/${currentStoreId}/products/stock`],
  });
  
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories'],
  });

  const { data: currentUser } = useQuery<UserData>({
    queryKey: ['/api/auth/user'],
  });

  const hasPermission = useMemo(() => {
    return (permission: string): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'owner') return true;
      return currentUser.permissions?.includes(permission) ?? false;
    };
  }, [currentUser]);
  
  // Create/update product mutation
  const productMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: number, data: ProductFormValues }) => {
      if (id) {
        return apiRequest('PUT', `/api/products/${id}`, data);
      } else {
        return apiRequest('POST', '/api/products', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      toast({
        title: editingProduct ? "Product updated" : "Product created",
        description: editingProduct 
          ? "The product has been updated successfully." 
          : "The product has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${editingProduct ? "update" : "create"} product: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/products/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Product deleted",
        description: "The product has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete product: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Bulk delete products mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      return apiRequest('DELETE', '/api/products/bulk', { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setSelectedProducts(new Set());
      toast({
        title: "Products deleted",
        description: "The selected products have been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to delete products: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Export products mutation

  // Export products mutation
  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'xlsx') => {
      const response = await fetch(`/api/products/export/${format}`, {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export products');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      return true;
    },
    onSuccess: (_, format) => {
      toast({
        title: "Export successful",
        description: `Products exported as ${format.toUpperCase()} file.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: `Failed to export products: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Import products mutation
  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await apiRequest('POST', '/api/products/import', { data });
      return response.json();
    },
    onSuccess: (result: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Import completed",
        description: result.message || "Products imported successfully",
      });
      setImportFile(null);
      setIsImportDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: `Failed to import products: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension === 'csv' || fileExtension === 'xlsx') {
        setImportFile(file);
      } else {
        toast({
          title: "Invalid file",
          description: "Please select a CSV or XLSX file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    try {
      const fileExtension = importFile.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'csv') {
        const text = await importFile.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        });
        importMutation.mutate(data);
      } else if (fileExtension === 'xlsx') {
        // Parse XLSX file using xlsx library
        const arrayBuffer = await importFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (jsonData.length === 0) {
          toast({
            title: "Empty file",
            description: "The XLSX file has no data rows.",
            variant: "destructive",
          });
          return;
        }
        
        // Validate that required columns exist
        const firstRow = jsonData[0] as Record<string, any>;
        if (!firstRow['SKU'] && !firstRow['sku']) {
          toast({
            title: "Invalid format",
            description: "The file must have a 'SKU' column.",
            variant: "destructive",
          });
          return;
        }
        
        importMutation.mutate(jsonData as any[]);
      }
    } catch (error) {
      toast({
        title: "File processing error",
        description: "Failed to process the uploaded file.",
        variant: "destructive",
      });
    }
  };
  
  // Filter products based on search query and stock status
  const filteredProducts = products
    ? products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase());
        
        const available = product.availableStock ?? product.currentStock ?? 0;
        const minStock = product.minStock || 0;
        
        const matchesStock = stockFilter === "all" ||
          (stockFilter === "low" && available > 0 && available <= minStock) ||
          (stockFilter === "out" && available <= 0);

        const matchesStatus = statusFilter === "all" ||
          (statusFilter === "active" && product.isActive !== false) ||
          (statusFilter === "inactive" && product.isActive === false);

        const matchesType = typeFilter === "all" ||
          (typeFilter === "standard" && (product.productType || 'standard') === 'standard') ||
          (typeFilter === "bundle" && product.productType === 'bundle');
          
        return matchesSearch && matchesStock && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (nameSort === "asc") return a.name.localeCompare(b.name);
        if (nameSort === "desc") return b.name.localeCompare(a.name);
        return 0;
      })
    : [];
  
  // Product form setup
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      currentSellingPrice: "",
      costPrice: "",
      lowestPrice: "",
      productType: "standard",
      baseUnit: "",
      minStock: 0,
      categoryId: null,
      isActive: true,
    }
  });

  const productType = form.watch("productType");
  
  // Reset form with product data for editing
  const handleEdit = async (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      sku: product.sku,
      description: product.description,
      currentSellingPrice: product.currentSellingPrice || "",
      costPrice: product.costPrice || "",
      lowestPrice: product.lowestPrice || "",
      productType: product.productType || "standard",
      baseUnit: product.unit || "", // Map unit from database to baseUnit in form
      minStock: product.minStock || 0,
      categoryId: product.categoryId || null,
      isActive: product.isActive ?? true,
    });
    
    // Load bundle components if product is a bundle
    if (product.productType === "bundle") {
      try {
        const response = await fetch(`/api/products/${product.id}/bundle-components`, { credentials: 'include' });
        if (response.ok) {
          const components = await response.json();
          setBundleComponents(components.map((c: any) => ({
            componentProductId: c.componentProductId,
            quantity: c.quantity,
            componentProduct: c.componentProduct
          })));
        }
      } catch (error) {
        console.error("Failed to load bundle components:", error);
      }
    } else {
      setBundleComponents([]);
    }
    
    // Load product units
    try {
      const response = await fetch(`/api/products/${product.id}/units`, { credentials: 'include' });
      if (response.ok) {
        const units = await response.json();
        setProductUnits(units);
      }
    } catch (error) {
      console.error("Failed to load product units:", error);
    }
    
    setIsDialogOpen(true);
  };
  
  // Reset form for new product
  const handleAddNew = (type: "standard" | "bundle" = "standard") => {
    setEditingProduct(null);
    form.reset({
      name: "",
      sku: "",
      description: "",
      currentSellingPrice: "",
      productType: type,
      baseUnit: "",
      categoryId: null,
      isActive: true,
    });
    setBundleComponents([]);
    setProductUnits([]);
    setIsDialogOpen(true);
  };
  
  // Submit form handler
  const onSubmit = async (data: ProductFormValues) => {
    // Prevent double submission
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // First save the product
      let productId = editingProduct?.id;
      
      if (data.productType === "bundle") {
        const validComponents = bundleComponents.filter(c => c.componentProductId > 0 && parseFloat(c.quantity) > 0);
        if (validComponents.length < 2) {
          toast({
            title: "Bundle requires at least 2 components",
            description: "A bundle product must contain at least 2 different component products.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      const productData = {
        name: data.name,
        sku: data.sku,
        description: data.description,
        currentSellingPrice: data.currentSellingPrice,
        costPrice: data.costPrice,
        lowestPrice: data.lowestPrice,
        productType: data.productType,
        unit: data.baseUnit || "pcs",
        categoryId: data.categoryId,
        isActive: data.isActive,
      };
      
      if (productId) {
        await apiRequest('PUT', `/api/products/${productId}`, productData);
      } else {
        const response = await apiRequest('POST', '/api/products', productData);
        const newProduct = await response.json();
        productId = newProduct.id;
      }
      
      // Save bundle components if product is a bundle
      if (data.productType === "bundle" && productId) {
        await apiRequest('PUT', `/api/products/${productId}/bundle-components`, 
          bundleComponents.map(c => ({
            componentProductId: c.componentProductId,
            quantity: c.quantity
          }))
        );
      }
      
      // Save product units
      if (productUnits.length > 0 && productId) {
        await apiRequest('PUT', `/api/products/${productId}/units`, 
          productUnits.map(u => ({
            unitCode: u.unitCode,
            unitLabel: u.unitLabel,
            conversionFactor: u.conversionFactor,
            price: u.price,
            isDefault: u.isDefault
          }))
        );
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/products/stock`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIsDialogOpen(false);
      setEditingProduct(null);
      setBundleComponents([]);
      setProductUnits([]);
      toast({
        title: editingProduct ? "Product updated" : "Product created",
        description: editingProduct 
          ? "The product has been updated successfully." 
          : "The product has been created successfully.",
      });
    } catch (error: any) {
      console.error("Error saving product:", error);
      // Parse error message - format is "409: {\"error\": \"...\"}" or similar
      let displayMessage = "Failed to save product. Please try again.";
      const errorMsg = error?.message || "";
      
      if (errorMsg.includes("409")) {
        // Try to extract JSON error message
        const jsonMatch = errorMsg.match(/\{.*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            displayMessage = parsed.error || displayMessage;
          } catch {
            displayMessage = "A product with this SKU/Code already exists";
          }
        } else {
          displayMessage = "A product with this SKU/Code already exists";
        }
      }
      
      toast({
        title: "Error",
        description: displayMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const toggleProduct = (productId: number) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleAll = () => {
    if (selectedProducts.size === (products?.length || 0)) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products?.map((p: any) => p.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products & Services</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your products and services for invoices</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {selectedProducts.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedProducts.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {selectedProducts.size} selected products. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => bulkDeleteMutation.mutate(Array.from(selectedProducts))}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {hasPermission('products.export') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-products">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem 
                onClick={() => exportMutation.mutate('csv')}
                disabled={exportMutation.isPending}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => exportMutation.mutate('xlsx')}
                disabled={exportMutation.isPending}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export as XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}

          {hasPermission('products.import') && (
          <Button 
            variant="outline" 
            onClick={() => setIsImportDialogOpen(true)}
            data-testid="button-import-products"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          )}

          <Button onClick={() => handleAddNew("standard")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
          
          <Button onClick={() => handleAddNew("bundle")}>
            <Layers className="mr-2 h-4 w-4" />
            Add Bundle
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row flex-wrap gap-4">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search products..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Status:</Label>
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Type:</Label>
              <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium whitespace-nowrap">Stock:</Label>
              <Select value={stockFilter} onValueChange={(val: any) => setStockFilter(val)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low" className="text-amber-600 font-medium">Low Stock</SelectItem>
                  <SelectItem value="out" className="text-red-600 font-medium">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <Package className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No products found</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md">
                {searchQuery
                  ? "No products match your search criteria. Try a different search term."
                  : "You haven't added any products yet. Get started by adding your first product."}
              </p>
              {!searchQuery && (
                <div className="flex gap-2">
                  <Button onClick={() => handleAddNew("standard")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                  <Button onClick={() => handleAddNew("bundle")}>
                    <Layers className="mr-2 h-4 w-4" />
                    Add Bundle
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={products && products.length > 0 && selectedProducts.size === products.length}
                        onCheckedChange={() => toggleAll()}
                      />
                    </TableHead>
                    <TableHead className="w-[300px] cursor-pointer select-none" onClick={() => setNameSort(prev => prev === "none" ? "asc" : prev === "asc" ? "desc" : "none")}>
                      <div className="flex items-center gap-1">
                        Name
                        <ArrowUpDown className={`h-4 w-4 ${nameSort !== "none" ? "text-primary" : "text-muted-foreground/50"}`} />
                        {nameSort === "asc" && <span className="text-xs text-muted-foreground">A→Z</span>}
                        {nameSort === "desc" && <span className="text-xs text-muted-foreground">Z→A</span>}
                      </div>
                    </TableHead>
                    <TableHead className="w-[150px]">SKU/Code</TableHead>
                    <TableHead className="w-[80px] text-right">Stock</TableHead>
                    <TableHead className="w-[80px] text-right">Reserved</TableHead>
                    <TableHead className="w-[90px] text-right">Available</TableHead>
                    <TableHead className="w-[60px] text-right">PO</TableHead>
                    <TableHead>Price</TableHead>
                    {hasPermission('products.view_cost') && <TableHead>Cost Price</TableHead>}
                    {hasPermission('products.view_lowest_price') && <TableHead>Lowest Price</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="group cursor-pointer hover:bg-muted/50" 
                      onDoubleClick={() => handleEdit(product)}
                      data-testid={`row-product-${product.id}`}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {product.name}
                          {product.productType === 'bundle' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                              BUNDLE
                            </span>
                          )}
                          {product.isActive === false && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-600 dark:text-gray-400">
                        {product.sku || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.productType === 'bundle' ? (
                          <span className="text-sm text-gray-400">—</span>
                        ) : (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {product.currentStock || 0}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.productType === 'bundle' ? (
                          <span className="text-sm text-gray-400">—</span>
                        ) : (product.reservedQty || 0) > 0 ? (
                          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                            {product.reservedQty}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-medium ${
                              (product.availableStock ?? product.currentStock ?? 0) === 0 ? 'text-red-600 dark:text-red-400' :
                              (product.availableStock ?? product.currentStock ?? 0) <= (product.minStock || 0) ? 'text-amber-600 dark:text-amber-400' :
                              'text-green-600 dark:text-green-400'
                            }`}>
                              {product.availableStock ?? product.currentStock ?? 0}
                            </span>
                            {(product.availableStock ?? product.currentStock ?? 0) === 0 ? (
                              <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-full">
                                Out
                              </span>
                            ) : product.productType !== 'bundle' && (product.availableStock ?? product.currentStock ?? 0) <= (product.minStock || 0) && (product.minStock || 0) > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 rounded-full">
                                Low
                              </span>
                            )}
                          </div>
                          {product.productType !== 'bundle' && (
                            <span className="text-xs text-gray-400">
                              Min: {product.minStock || 0}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.productType === 'bundle' ? (
                          <span className="text-sm text-gray-400">—</span>
                        ) : (product.pendingPOQuantity || 0) > 0 ? (
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {product.pendingPOQuantity}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatCurrency(product.currentSellingPrice || "0")}</TableCell>
                      {hasPermission('products.view_cost') && <TableCell>{product.costPrice ? formatCurrency(product.costPrice) : "—"}</TableCell>}
                      {hasPermission('products.view_lowest_price') && <TableCell>{product.lowestPrice ? formatCurrency(product.lowestPrice) : "—"}</TableCell>}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link 
                                href={`/products/${product.id}/dashboard`}
                                data-testid={`link-view-dashboard-${product.id}`}
                              >
                                <BarChart3 className="mr-2 h-4 w-4" />
                                <span>View Dashboard</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            {hasPermission('products.stock_adjust') && (
                              <DropdownMenuItem onClick={() => {
                                setStockAdjustmentProduct(product);
                                setIsStockAdjustmentOpen(true);
                              }}>
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                <span>Stock Adjustment</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{product.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(product.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Product dialog form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct 
                ? (editingProduct.productType === "bundle" ? "Edit Bundle" : "Edit Product")
                : (productType === "bundle" ? "Add Bundle" : "Add Product")}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? (editingProduct.productType === "bundle" 
                    ? "Update the details of your bundle product"
                    : "Update the details of your product or service")
                : (productType === "bundle"
                    ? "Create a bundle product made from multiple component products"
                    : "Enter the details of your product or service")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter product name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU/Code*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter product SKU or code" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))} 
                          value={field.value?.toString() || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Category</SelectItem>
                            {categories?.map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter product description" 
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="currentSellingPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price*</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">Rp</span>
                            </div>
                            <Input 
                              placeholder="0" 
                              type="number"
                              step="1"
                              min="0"
                              className="pl-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* Hide cost price for bundles - it's calculated from components */}
                  {productType !== "bundle" && (
                    <div className="grid grid-cols-2 gap-4">
                      {hasPermission('products.view_cost') ? (
                        <FormField
                          control={form.control}
                          name="costPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cost Price</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">Rp</span>
                                  </div>
                                  <Input 
                                    placeholder="0" 
                                    type="number"
                                    step="1"
                                    min="0"
                                    className="pl-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : <div />}
                      {hasPermission('products.view_lowest_price') ? (
                        <FormField
                          control={form.control}
                          name="lowestPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Lowest Price</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">Rp</span>
                                  </div>
                                  <Input 
                                    placeholder="0" 
                                    type="number"
                                    step="1"
                                    min="0"
                                    className="pl-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                    {...field} 
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ) : <div />}
                    </div>
                  )}
                  
                  {/* Show only lowest price for bundles - full width */}
                  {productType === "bundle" && (
                    <FormField
                      control={form.control}
                      name="lowestPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lowest Price</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">Rp</span>
                              </div>
                              <Input 
                                placeholder="0" 
                                type="number"
                                step="1"
                                min="0"
                                className="pl-8 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="baseUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Unit</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., pcs, kg, meter" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {productType !== "bundle" && (
                    <FormField
                      control={form.control}
                      name="minStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Min Stock (Low Warning)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="0" 
                              type="number"
                              min="0"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    )}
                  </div>
                
                {/* Bundle Components Section - only visible when productType is bundle */}
                {productType === "bundle" && (
                  <div className="space-y-4 border-t pt-4">
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                    <h4 className="font-medium text-purple-900 mb-1 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Bundle Product
                    </h4>
                    <p className="text-sm text-purple-800">
                      Add component products that make up this bundle. Stock is automatically calculated based on available components.
                    </p>
                  </div>
                  
                  {bundleComponents.length > 0 && (
                    <div className="space-y-2">
                      {bundleComponents.map((component, index) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-md">
                          <div className="flex-1">
                            <select
                              value={component.componentProductId}
                              onChange={(e) => {
                                const updated = [...bundleComponents];
                                updated[index].componentProductId = parseInt(e.target.value);
                                const selectedProduct = products?.find(p => p.id === parseInt(e.target.value));
                                if (selectedProduct) {
                                  updated[index].componentProduct = selectedProduct;
                                }
                                setBundleComponents(updated);
                              }}
                              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                              <option value="">Select product...</option>
                              {products?.filter(p => p.productType !== 'bundle' && p.id !== editingProduct?.id).map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-24">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Qty"
                              value={component.quantity}
                              onChange={(e) => {
                                const updated = [...bundleComponents];
                                updated[index].quantity = e.target.value;
                                setBundleComponents(updated);
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBundleComponents(bundleComponents.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBundleComponents([...bundleComponents, { componentProductId: 0, quantity: "1" }]);
                    }}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Component
                  </Button>
                  </div>
                )}
                
                {/* Multi-Unit Section - only visible when editing an existing product */}
                {editingProduct && (
                  <div className="space-y-4 border-t pt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <h4 className="font-medium text-blue-900 mb-1 flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Alternate Selling Units
                    </h4>
                    <p className="text-sm text-blue-800">
                      Define alternative units for selling this product (e.g., box of 12, pack of 6). Each unit can have its own price.
                    </p>
                  </div>
                  
                  {productUnits.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid gap-2 text-xs font-medium text-gray-500 px-2" style={{ gridTemplateColumns: '1fr 1.5fr 0.8fr 1.5fr 40px' }}>
                        <span>Unit Code</span>
                        <span>Label</span>
                        <span>Conversion</span>
                        <span>Price</span>
                        <span></span>
                      </div>
                      {productUnits.map((unit, index) => (
                        <div key={index} className="grid gap-2 items-center bg-gray-50 p-2 rounded-md" style={{ gridTemplateColumns: '1fr 1.5fr 0.8fr 1.5fr 40px' }}>
                          <Input
                            placeholder="box"
                            value={unit.unitCode}
                            onChange={(e) => {
                              const updated = [...productUnits];
                              updated[index].unitCode = e.target.value;
                              setProductUnits(updated);
                            }}
                          />
                          <Input
                            placeholder="Box of 12"
                            value={unit.unitLabel}
                            onChange={(e) => {
                              const updated = [...productUnits];
                              updated[index].unitLabel = e.target.value;
                              setProductUnits(updated);
                            }}
                          />
                          <Input
                            type="number"
                            min="1"
                            step="0.01"
                            placeholder="12"
                            value={parseFloat(unit.conversionFactor) || ""}
                            onChange={(e) => {
                              const updated = [...productUnits];
                              updated[index].conversionFactor = e.target.value;
                              setProductUnits(updated);
                            }}
                          />
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rp</span>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Price"
                              className="pl-8"
                              value={unit.price || ""}
                              onChange={(e) => {
                                const updated = [...productUnits];
                                updated[index].price = e.target.value || null;
                                setProductUnits(updated);
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setProductUnits(productUnits.filter((_, i) => i !== index));
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProductUnits([...productUnits, { 
                        unitCode: "", 
                        unitLabel: "", 
                        conversionFactor: "1",
                        price: null,
                        isDefault: false
                      }]);
                    }}
                    className="mt-2"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Unit
                  </Button>
                  </div>
                )}
              </div>
              
              {/* Active Status - Only show when editing */}
              {editingProduct && (
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Inactive products won't appear in invoice/quotation dropdowns
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : (editingProduct ? "Update" : "Create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
            <DialogDescription>
              Upload a CSV or XLSX file to import multiple products at once.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Select File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                data-testid="input-product-import-file"
              />
              <p className="text-sm text-gray-500">
                Supported formats: CSV, XLSX
              </p>
            </div>
            
            {importFile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {importFile.name}
                  </span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  File ready for import
                </p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <h4 className="font-medium text-amber-900 mb-1">Required Columns</h4>
              <p className="text-sm text-amber-800">
                Your file should include these columns: Name, SKU, Description, Current Price, Unit, Min Stock, Weight, Dimensions, Is Active
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsImportDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importFile || importMutation.isPending}
              data-testid="button-confirm-product-import"
            >
              <Upload className="mr-2 h-4 w-4" />
              {importMutation.isPending ? "Importing..." : "Import Products"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <StockAdjustmentDialog
        open={isStockAdjustmentOpen}
        onOpenChange={setIsStockAdjustmentOpen}
        product={stockAdjustmentProduct}
        storeId={currentStoreId}
      />
    </div>
  );
}
