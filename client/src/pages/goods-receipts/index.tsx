import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, ArrowUpDown, MoreHorizontal, Eye, FilePenLine, Trash2, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store-context";

type GoodsReceipt = {
  id: number;
  receiptNumber: string;
  supplierDocNumber: string | null;
  supplierName: string;
  receiptDate: string;
  dueDate: string | null;
  totalAmount: string;
  amountPaid: string;
  status: string;
  hasReturns: boolean;
};

type GoodsReceiptStatus = 'all' | 'paid' | 'partial' | 'unpaid';

export default function GoodsReceiptsPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentStoreId } = useStore();
  
  const { data: goodsReceipts, isLoading } = useQuery<GoodsReceipt[]>({
    queryKey: [`/api/stores/${currentStoreId}/goods-receipts`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/stores/${currentStoreId}/goods-receipts/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/goods-receipts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/purchase-orders`] });
      toast({
        title: "Goods receipt deleted",
        description: "The goods receipt has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete goods receipt: ${error.message}`,
        variant: "destructive",
      });
    }
  });


  const filteredGoodsReceipts = goodsReceipts
    ? goodsReceipts.filter(receipt => {
        const matchesSearch = 
          receipt.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          receipt.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (receipt.supplierDocNumber && receipt.supplierDocNumber.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const total = parseFloat(receipt.totalAmount) || 0;
        const paid = parseFloat(receipt.amountPaid) || 0;
        const paymentStatus = (paid >= total && total > 0) ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
        const matchesStatus = statusFilter === 'all' || paymentStatus === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
    : [];
  
  // Calculate payment status based on amountPaid vs totalAmount
  const getPaymentStatus = (receipt: GoodsReceipt) => {
    const total = parseFloat(receipt.totalAmount) || 0;
    const paid = parseFloat(receipt.amountPaid) || 0;
    if (paid >= total && total > 0) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const getStatusBadge = (receipt: GoodsReceipt) => {
    const paymentStatus = getPaymentStatus(receipt);
    const badge = paymentStatus === 'paid' 
      ? <Badge className="bg-green-500 text-white">Terbayar</Badge>
      : paymentStatus === 'partial'
      ? <Badge className="bg-yellow-500 text-white">Terbayar Sebagian</Badge>
      : <Badge variant="destructive">Belum Terbayar</Badge>;
    
    return (
      <div className="flex items-center gap-2">
        {badge}
        {receipt.hasReturns && (
          <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Return Pending
          </Badge>
        )}
      </div>
    );
  };

  const pendingReturnsCount = goodsReceipts?.filter(r => r.hasReturns).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receipt</h1>
          <p className="text-sm text-gray-500 mt-1">Manage incoming inventory from suppliers</p>
        </div>
        
        <div className="flex items-center gap-3">
          {pendingReturnsCount > 0 && (
            <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-300 py-1.5 px-3">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {pendingReturnsCount} Pending Returns
            </Badge>
          )}
          <Link href="/goods-receipts/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Goods Receipt
            </Button>
          </Link>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search receipts..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value: string) => setStatusFilter(value as GoodsReceiptStatus)}
              >
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="All Statuses" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="paid">Terbayar</SelectItem>
                  <SelectItem value="partial">Terbayar Sebagian</SelectItem>
                  <SelectItem value="unpaid">Belum Terbayar</SelectItem>
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
          ) : filteredGoodsReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <Package className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No goods receipts found</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md">
                {searchQuery || statusFilter !== 'all'
                  ? "Try adjusting your search or filter to find what you're looking for."
                  : "You haven't created any goods receipts yet. Get started by creating your first goods receipt."}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link href="/goods-receipts/create">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Goods Receipt
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[130px]">
                      <div className="flex items-center space-x-1">
                        <span>GR #</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Supplier Doc #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Receipt Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGoodsReceipts.map((receipt) => (
                    <TableRow key={receipt.id} className="group">
                      <TableCell className="font-medium text-primary">
                        <Link href={`/goods-receipts/${receipt.id}`}>
                          <a className="hover:underline">
                            {receipt.receiptNumber}
                          </a>
                        </Link>
                      </TableCell>
                      <TableCell className="text-gray-600">{receipt.supplierDocNumber || '-'}</TableCell>
                      <TableCell>{receipt.supplierName}</TableCell>
                      <TableCell>{formatDate(receipt.receiptDate)}</TableCell>
                      <TableCell>{receipt.dueDate ? formatDate(receipt.dueDate) : '-'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(receipt.totalAmount)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(receipt.amountPaid)}</TableCell>
                      <TableCell>{getStatusBadge(receipt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigate(`/goods-receipts/${receipt.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>View</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/goods-receipts/${receipt.id}/edit`)}>
                              <FilePenLine className="mr-2 h-4 w-4" />
                              <span>Edit</span>
                            </DropdownMenuItem>
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
                                  <AlertDialogTitle>Delete Goods Receipt</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete goods receipt {receipt.receiptNumber}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(receipt.id)}
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
    </div>
  );
}
