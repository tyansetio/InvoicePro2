import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, ArrowDown, ArrowUp, MoreHorizontal, FileDown, Eye, FilePenLine, Ban, Download, FileSpreadsheet, X } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from "@/lib/pdf-generator";
import { useStore } from "@/lib/store-context";

type PaymentStatus = 'unpaid' | 'partial_paid' | 'paid' | 'overpaid' | 'overdue';
type DeliveryStatus = 'undelivered' | 'partial_delivered' | 'delivered';

type Invoice = {
  id: number;
  invoiceNumber: string;
  clientId?: number;
  clientName?: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string;
  status: string;
  isVoided: boolean;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
};

type PaymentStatusFilter = 'all' | PaymentStatus;
type DeliveryStatusFilter = 'all' | DeliveryStatus;

type SortDirection = 'asc' | 'desc';

export default function InvoicesPage() {
  const { currentStoreId } = useStore();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportPaymentStatus, setExportPaymentStatus] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: [`/api/stores/${currentStoreId}/invoices`],
  });

  // Fetch current user for default notes
  const { data: currentUser } = useQuery<{
    invoiceNotes?: string;
    defaultNotes?: string;
  }>({
    queryKey: ['/api/user'],
  });

  // Fetch store details (name, address, tagline, etc.)
  const { data: currentStore } = useQuery<any>({
    queryKey: [`/api/stores/${currentStoreId}`],
    enabled: !!currentStoreId,
  });

  // Void invoice mutation
  const voidMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/invoices/${id}/void`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/invoices`] });
      toast({
        title: "Invoice dibatalkan",
        description: "Invoice telah di-void.",
      });
    },
    onError: (error: any) => {
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

  // Handle generating PDF
  const handleGeneratePDF = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch invoice details");
      }
      
      const invoiceData = await res.json();
      
      await generatePDF({
        invoice: {
          ...invoiceData,
          issueDate: formatDate(invoiceData.issueDate),
          dueDate: formatDate(invoiceData.dueDate)
        },
        items: invoiceData.items,
        client: invoiceData.client,
        company: currentStore,
        defaultNotes: currentUser?.invoiceNotes || currentUser?.defaultNotes
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

  // Handle export to Excel
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      
      const params = new URLSearchParams();
      params.append('storeId', String(currentStoreId));
      if (exportStartDate) params.append('startDate', exportStartDate);
      if (exportEndDate) params.append('endDate', exportEndDate);
      if (exportPaymentStatus) params.append('paymentStatus', exportPaymentStatus);
      
      const response = await fetch(`/api/invoices/export/xlsx?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to export invoices');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices-${exportStartDate || 'all'}-to-${exportEndDate || 'all'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Berhasil",
        description: "File Excel telah didownload",
      });
      
      setExportDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal export invoice",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle sort direction
  const toggleSort = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  // Filter and sort invoices
  const filteredInvoices = invoices
    ? invoices
        .filter(invoice => {
          const matchesSearch = 
            invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (invoice.clientName?.toLowerCase() || '').includes(searchQuery.toLowerCase());
          
          // Filter voided invoices
          if (!showVoided && invoice.isVoided) return false;
          if (invoice.isVoided) return matchesSearch; // Don't apply other filters to voided
          
          const matchesPaymentStatus = paymentStatusFilter === 'all' || invoice.paymentStatus === paymentStatusFilter;
          const matchesDeliveryStatus = deliveryStatusFilter === 'all' || invoice.deliveryStatus === deliveryStatusFilter;
          const matchesDateStart = !filterStartDate || invoice.issueDate >= filterStartDate;
          const matchesDateEnd = !filterEndDate || invoice.issueDate <= filterEndDate;
          
          return matchesSearch && matchesPaymentStatus && matchesDeliveryStatus && matchesDateStart && matchesDateEnd;
        })
        .sort((a, b) => {
          const comparison = a.invoiceNumber.localeCompare(b.invoiceNumber, undefined, { numeric: true });
          return sortDirection === 'desc' ? -comparison : comparison;
        })
    : [];
  
  // Payment status badge
  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'unpaid':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Unpaid</Badge>;
      case 'partial_paid':
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'overpaid':
        return <Badge className="bg-purple-100 text-purple-800">Overpaid</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Delivery status badge
  const getDeliveryStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'undelivered':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Undelivered</Badge>;
      case 'partial_delivered':
        return <Badge className="bg-blue-100 text-blue-800">Partial</Badge>;
      case 'delivered':
        return <Badge className="bg-emerald-100 text-emerald-800">Delivered</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your invoices and track payments</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Export Invoice ke Excel</DialogTitle>
                <DialogDescription>
                  Pilih filter untuk data invoice yang akan di-export
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="startDate" className="text-right">
                    Dari Tanggal
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    className="col-span-3"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="endDate" className="text-right">
                    Sampai Tanggal
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    className="col-span-3"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="paymentStatus" className="text-right">
                    Status Bayar
                  </Label>
                  <Select
                    value={exportPaymentStatus}
                    onValueChange={setExportPaymentStatus}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="unpaid">Belum Bayar</SelectItem>
                      <SelectItem value="partial_paid">Sebagian</SelectItem>
                      <SelectItem value="paid">Lunas</SelectItem>
                      <SelectItem value="overdue">Jatuh Tempo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExportDialogOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                >
                  {isExporting ? "Exporting..." : "Download Excel"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Link href="/invoices/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
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
                placeholder="Search invoices..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <span className="whitespace-nowrap">Dari:</span>
                <Input
                  type="date"
                  className="h-8 w-36 text-sm"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <span className="whitespace-nowrap">s/d:</span>
                <Input
                  type="date"
                  className="h-8 w-36 text-sm"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
              {(filterStartDate || filterEndDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-gray-500"
                  onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-600 ml-1">
                <input 
                  type="checkbox" 
                  checked={showVoided}
                  onChange={(e) => setShowVoided(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show Voided
              </label>
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
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <FileDown className="h-6 w-6 text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No invoices found</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md">
                {searchQuery || paymentStatusFilter !== 'all' || deliveryStatusFilter !== 'all' || filterStartDate || filterEndDate
                  ? "Try adjusting your search or filter to find what you're looking for."
                  : "You haven't created any invoices yet. Get started by creating your first invoice."}
              </p>
              {!searchQuery && paymentStatusFilter === 'all' && deliveryStatusFilter === 'all' && !filterStartDate && !filterEndDate && (
                <Link href="/invoices/create">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Invoice
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
                      <button
                        onClick={toggleSort}
                        className="flex items-center space-x-1 hover:text-primary transition-colors cursor-pointer"
                      >
                        <span>Invoice #</span>
                        {sortDirection === 'desc' ? (
                          <ArrowDown className="h-3 w-3 text-primary" />
                        ) : (
                          <ArrowUp className="h-3 w-3 text-primary" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>
                      <Select
                        value={paymentStatusFilter}
                        onValueChange={(value: string) => setPaymentStatusFilter(value as PaymentStatusFilter)}
                      >
                        <SelectTrigger className="h-8 w-[130px] border-none bg-transparent p-0 font-medium text-sm shadow-none focus:ring-0">
                          <SelectValue placeholder="Payment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Payment</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                          <SelectItem value="partial_paid">Partial Paid</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overpaid">Overpaid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead>
                      <Select
                        value={deliveryStatusFilter}
                        onValueChange={(value: string) => setDeliveryStatusFilter(value as DeliveryStatusFilter)}
                      >
                        <SelectTrigger className="h-8 w-[130px] border-none bg-transparent p-0 font-medium text-sm shadow-none focus:ring-0">
                          <SelectValue placeholder="Delivery" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Delivery</SelectItem>
                          <SelectItem value="undelivered">Undelivered</SelectItem>
                          <SelectItem value="partial_delivered">Partial Delivered</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className={`group ${invoice.isVoided ? 'opacity-50' : ''}`}>
                      <TableCell className="font-medium text-primary">
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline text-primary">
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(invoice.totalAmount)}</TableCell>
                      <TableCell>
                        {invoice.isVoided ? (
                          <Badge variant="outline" className="bg-slate-200 text-slate-600 line-through">Void</Badge>
                        ) : (
                          getPaymentStatusBadge(invoice.paymentStatus)
                        )}
                      </TableCell>
                      <TableCell>
                        {invoice.isVoided ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          getDeliveryStatusBadge(invoice.deliveryStatus)
                        )}
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>View</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGeneratePDF(invoice)}>
                              <FileDown className="mr-2 h-4 w-4" />
                              <span>Download PDF</span>
                            </DropdownMenuItem>
                            {!invoice.isVoided && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate(`/invoices/${invoice.id}/edit`)}>
                                  <FilePenLine className="mr-2 h-4 w-4" />
                                  <span>Edit</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                      <Ban className="mr-2 h-4 w-4" />
                                      <span>Void Invoice</span>
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Void Invoice</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Yakin ingin membatalkan invoice {invoice.invoiceNumber}? Invoice yang di-void tidak bisa dihapus dan akan tetap tercatat untuk audit.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => voidMutation.mutate(invoice.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Void
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
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
