import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Filter, ArrowUpDown, MoreHorizontal, Eye, FilePenLine, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store-context";

type PurchaseOrder = {
  id: number;
  purchaseOrderNumber: string;
  supplierName: string;
  orderDate: string;
  totalAmount: string;
  status: 'pending' | 'partial' | 'received' | 'cancelled';
  isPrepaid: boolean;
};

type PendingPOItem = {
  purchaseOrderId: number;
  purchaseOrderNumber: string;
  supplierName: string;
  orderDate: string;
  productId: number;
  productName: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
};

type PurchaseOrderStatus = 'all' | 'pending' | 'partial' | 'received';

export default function PurchaseOrdersPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus>("all");
  const [activeTab, setActiveTab] = useState<"by-po" | "by-item">("by-po");
  const [itemSearchQuery, setItemSearchQuery] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStoreId } = useStore();
  
  const { data: purchaseOrders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: [`/api/stores/${currentStoreId}/purchase-orders`],
  });

  const { data: pendingItems, isLoading: isLoadingPendingItems } = useQuery<PendingPOItem[]>({
    queryKey: [`/api/stores/${currentStoreId}/purchase-orders/pending-items`],
  });

  // Delete purchase order mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/stores/${currentStoreId}/purchase-orders/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/purchase-orders`] });
      toast({
        title: "Purchase order deleted",
        description: "The purchase order has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete purchase order: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  

  // Filter purchase orders based on search query and status
  const filteredPurchaseOrders = purchaseOrders
    ? purchaseOrders.filter(purchaseOrder => {
        const matchesSearch = 
          purchaseOrder.purchaseOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          purchaseOrder.supplierName.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || purchaseOrder.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
    : [];
  
  // Render badge based on purchase order status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Pending</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case 'received':
        return <Badge className="bg-green-100 text-green-800">Received</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Cancelled</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Sent</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Filter pending items based on search
  const filteredPendingItems = pendingItems
    ? pendingItems.filter(item => {
        const matchesSearch = !itemSearchQuery || 
          item.productName.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
          item.supplierName.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
          item.purchaseOrderNumber.toLowerCase().includes(itemSearchQuery.toLowerCase());
        return matchesSearch;
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage supplier orders and track deliveries</p>
        </div>
        
        <Link href="/purchase-orders/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </Link>
      </div>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "by-po" | "by-item")} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="by-po">By PO</TabsTrigger>
          <TabsTrigger value="by-item">
            By Item
            {pendingItems && pendingItems.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {pendingItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="by-po">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search purchase orders..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-purchase-orders"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(value: string) => setStatusFilter(value as PurchaseOrderStatus)}
                  >
                    <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                      <div className="flex items-center">
                        <Filter className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="All Statuses" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
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
          ) : filteredPurchaseOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <Package className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No purchase orders found</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md">
                {searchQuery || statusFilter !== 'all'
                  ? "Try adjusting your search or filter to find what you're looking for."
                  : "You haven't created any purchase orders yet. Get started by creating your first purchase order."}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link href="/purchase-orders/create">
                  <Button data-testid="button-create-first-purchase-order">
                    <Plus className="mr-2 h-4 w-4" />
                    New Purchase Order
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">
                      <div className="flex items-center space-x-1">
                        <span>PO #</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchaseOrders.map((purchaseOrder) => (
                    <TableRow key={purchaseOrder.id} className="group" data-testid={`row-purchase-order-${purchaseOrder.id}`}>
                      <TableCell className="font-medium text-primary">
                        <div className="flex items-center gap-2">
                          <Link href={`/purchase-orders/${purchaseOrder.id}`}>
                            <a className="hover:underline" data-testid={`link-purchase-order-${purchaseOrder.id}`}>
                              {purchaseOrder.purchaseOrderNumber}
                            </a>
                          </Link>
                          {purchaseOrder.isPrepaid && (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] px-1.5 py-0">
                              Prepaid
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-supplier-${purchaseOrder.id}`}>{purchaseOrder.supplierName}</TableCell>
                      <TableCell data-testid={`text-order-date-${purchaseOrder.id}`}>{formatDate(purchaseOrder.orderDate)}</TableCell>
                      <TableCell className="font-medium" data-testid={`text-amount-${purchaseOrder.id}`}>{formatCurrency(purchaseOrder.totalAmount)}</TableCell>
                      <TableCell data-testid={`status-${purchaseOrder.id}`}>{getStatusBadge(purchaseOrder.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0" data-testid={`button-actions-${purchaseOrder.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}`)} data-testid={`button-view-${purchaseOrder.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>View</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}/edit`)} data-testid={`button-edit-${purchaseOrder.id}`}>
                              <FilePenLine className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600" data-testid={`button-delete-${purchaseOrder.id}`}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete purchase order {purchaseOrder.purchaseOrderNumber}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(purchaseOrder.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                    data-testid="button-confirm-delete"
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
        </TabsContent>

        <TabsContent value="by-item">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Cari produk, supplier, atau PO#..."
                    className="pl-8"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingPendingItems ? (
                <div className="space-y-4">
                  {Array(5).fill(0).map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ))}
                </div>
              ) : filteredPendingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-gray-100 p-3 mb-4">
                    <Package className="h-6 w-6 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No pending items</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-md">
                    {itemSearchQuery
                      ? "Coba sesuaikan pencarian Anda."
                      : "Semua item purchase order sudah diterima."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>PO #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Pending</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPendingItems.map((item, index) => (
                        <TableRow key={`${item.purchaseOrderId}-${item.productId}-${index}`}>
                          <TableCell className="font-medium">
                            <Link href={`/products/${item.productId}/dashboard`} className="text-primary hover:underline">
                              {item.productName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Link href={`/purchase-orders/${item.purchaseOrderId}`} className="text-primary hover:underline">
                              {item.purchaseOrderNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{item.supplierName}</TableCell>
                          <TableCell>{formatDate(item.orderDate)}</TableCell>
                          <TableCell className="text-right">{item.orderedQty}</TableCell>
                          <TableCell className="text-right">{item.receivedQty}</TableCell>
                          <TableCell className="text-right font-semibold text-blue-600">
                            {item.pendingQty}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}