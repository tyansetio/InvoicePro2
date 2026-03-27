import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CreditCard, Banknote, Clock, CheckCircle, XCircle, RotateCcw, ExternalLink, DollarSign, Trash2, Pencil, MoreVertical, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate, formatCurrency, formatCurrencyAccounting, formatQuantity } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { logPrint } from "@/lib/activity-log";
import type { Return, ReturnItem, CreditNoteUsage, Invoice, Client, InvoiceItem, Product, PrintSettings } from "@shared/schema";
import { Link } from "wouter";
import { useStore } from '@/lib/store-context';

type ReturnWithDetails = {
  return: Return;
  items: (ReturnItem & { invoiceItem: InvoiceItem & { product: Product } })[];
  usages: CreditNoteUsage[];
  invoice: Invoice;
  client: Client;
};

export default function ReturnDetailPage() {
  const { currentStoreId } = useStore();

  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const returnId = parseInt(params.id as string);

  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading, error } = useQuery<ReturnWithDetails>({
    queryKey: ['/api/returns', returnId],
    staleTime: Infinity
  });

  // Fetch current user for permissions
  const { data: currentUser } = useQuery<{ role?: string; permissions?: string[] }>({
    queryKey: ['/api/user'],
  });

  // Fetch store details (name, address, logo, etc.)
  const { data: currentStore } = useQuery<any>({
    queryKey: [`/api/stores/${currentStoreId}`],
    enabled: !!currentStoreId,
  });

  // Fetch store-specific print settings
  const { data: storePrintSettings } = useQuery<PrintSettings>({
    queryKey: [`/api/stores/${currentStoreId}/print-settings`],
    enabled: !!currentStoreId,
  });

  const isOwner = currentUser?.role === 'owner';
  const canPrintReturn = isOwner || (currentUser?.permissions?.includes('returns.print') ?? false);

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest('PATCH', `/api/returns/${returnId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/returns', returnId] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/returns`] });
      toast({
        title: "Status diperbarui",
        description: "Status retur berhasil diperbarui.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui status.",
        variant: "destructive",
      });
    },
  });

  const convertToRefundMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest('POST', `/api/returns/${returnId}/convert-to-refund`, { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/returns', returnId] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/returns`] });
      setRefundDialogOpen(false);
      setRefundAmount("");
      toast({
        title: "Berhasil",
        description: "Credit note berhasil dikonversi ke refund.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal mengkonversi ke refund.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/returns/${returnId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/returns`] });
      toast({
        title: "Berhasil",
        description: "Retur berhasil dihapus.",
      });
      navigate('/returns');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus retur.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest('PUT', `/api/returns/${returnId}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/returns', returnId] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/returns`] });
      setEditDialogOpen(false);
      toast({
        title: "Berhasil",
        description: "Retur berhasil diperbarui.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui retur.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Retur tidak ditemukan</p>
          <Button variant="outline" onClick={() => navigate('/returns')} className="mt-4">
            Kembali ke Daftar
          </Button>
        </div>
      </div>
    );
  }

  const { return: returnData, items, usages, invoice, client } = data;
  const remainingBalance = Number(returnData.totalAmount) - Number(returnData.usedAmount);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Selesai</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'credit_note':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CreditCard className="h-3 w-3 mr-1" />Credit Note</Badge>;
      case 'refund':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><Banknote className="h-3 w-3 mr-1" />Refund</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleConvertToRefund = () => {
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0 || amount > remainingBalance) {
      toast({
        title: "Error",
        description: "Jumlah tidak valid. Harus antara 0 dan sisa saldo.",
        variant: "destructive",
      });
      return;
    }
    convertToRefundMutation.mutate(amount);
  };

  const paginatedItems = (() => {
    if (!items || items.length === 0) return [{ items: [], isLastPage: true, startIndex: 0 }];
    const MAX_ITEMS_FIRST_PAGE = 20;
    const MAX_ITEMS_WITHOUT_FOOTER = 25;

    let pages = [];
    let remaining = [...items];
    let runningIndex = 0;

    while (remaining.length > 0) {
      const isFirstPage = pages.length === 0;
      const maxItems = isFirstPage ? MAX_ITEMS_FIRST_PAGE : MAX_ITEMS_WITHOUT_FOOTER;

      if (remaining.length <= maxItems) {
        pages.push({ items: remaining, isLastPage: true, startIndex: runningIndex });
        break;
      } else {
        const pageItems = remaining.slice(0, maxItems);
        pages.push({ items: pageItems, isLastPage: false, startIndex: runningIndex });
        runningIndex += pageItems.length;
        remaining = remaining.slice(maxItems);
      }
    }
    return pages;
  })();

  const getRunningItemNumber = (pageIndex: number, itemIndex: number): number => {
    let count = 0;
    for (let i = 0; i < pageIndex; i++) {
      count += paginatedItems[i].items.length;
    }
    return count + itemIndex + 1;
  };

  const totalPages = paginatedItems.length;

  return (
    <>
      {/* Print-only template */}
      <div className="print-only" style={{ display: 'none' }}>
        {paginatedItems.map((page, pageIndex) => (
          <div
            key={pageIndex}
            className="print-invoice-template"
            style={{ pageBreakAfter: page.isLastPage ? 'auto' : 'always' }}
          >
            {/* Header */}
            <div className="print-header">
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
                  <div className="print-bill-to-label" style={{ borderColor: '#000' }}>To</div>
                  <div className="print-bill-to-name">{client?.name || 'N/A'}</div>
                  {client && (
                    <div className="print-bill-to-details">
                      {client.address && <div>{client.address}</div>}
                      {client.phone && <div>Phone: {client.phone}</div>}
                    </div>
                  )}
                </div>
              </div>

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

              <div className="print-header-right">
                <div className="print-doc-type" style={{ borderColor: '#000' }}>RETUR</div>
                <div className="print-doc-details">
                  <div className="print-doc-row">
                    <span className="print-doc-label">No.</span>
                    <span className="print-doc-value">{returnData.returnNumber}</span>
                  </div>
                  <div className="print-doc-row">
                    <span className="print-doc-label">Invoice</span>
                    <span className="print-doc-value">{invoice?.invoiceNumber || '-'}</span>
                  </div>
                  <div className="print-doc-row">
                    <span className="print-doc-label">Date</span>
                    <span className="print-doc-value">{formatDate(returnData.returnDate)}</span>
                  </div>
                  {returnData.createdByName && (
                    <div className="print-doc-row">
                      <span className="print-doc-label">Created By</span>
                      <span className="print-doc-value">{returnData.createdByName}</span>
                    </div>
                  )}
                  <div className="print-doc-row">
                    <span className="print-doc-label">Page</span>
                    <span className="print-doc-value">{pageIndex + 1}/{totalPages}</span>
                  </div>
                  <div className="print-doc-row">
                    <span className="print-doc-label">Type</span>
                    <span className="print-doc-value">{returnData.returnType === 'credit_note' ? 'Credit Note' : 'Refund'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="print-items-table">
              <thead>
                <tr>
                  <th style={{ width: '4%', textAlign: 'center' }}>No.</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Kode Item</th>
                  <th style={{ width: '44%', textAlign: 'center' }}>Products</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>QTY</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Unit</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>Return Value</th>
                  <th style={{ width: '15%', textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item, itemIndex) => (
                  <tr key={itemIndex}>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{getRunningItemNumber(pageIndex, itemIndex)}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip" style={{ fontSize: '7pt' }}>{item.invoiceItem?.product?.sku || '-'}</div></td>
                    <td style={{ textAlign: 'left' }}><div className="print-cell-clip">{item.invoiceItem?.product?.name || item.invoiceItem?.description || '-'}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatQuantity(item.quantity)}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">-</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatCurrencyAccounting(item.price)}</div></td>
                    <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatCurrencyAccounting(item.subtotal)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            {page.isLastPage && (
              <div className="print-footer">
                <div className="print-footer-left">
                  <div className="print-notes-label">Notes:</div>
                  <div className="print-notes-text">
                    {returnData.notes ? (
                      <div>{returnData.notes}</div>
                    ) : (
                      <div>-</div>
                    )}
                  </div>
                </div>

                <div className="print-footer-right">
                  <div className="print-total-row print-total-final" style={{ backgroundColor: '#e8e8e8' }}>
                    <span className="print-total-label">Return Value</span>
                    <span className="print-total-value">{formatCurrencyAccounting(returnData.totalAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 screen-only">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/returns')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{returnData.returnNumber}</h1>
                {getTypeBadge(returnData.returnType)}
                {getStatusBadge(returnData.status)}
              </div>
              <p className="text-muted-foreground">{formatDate(returnData.returnDate)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {canPrintReturn && (
              <Button
                variant="outline"
                onClick={async () => {
                  logPrint('return', returnData.id, returnData.returnNumber, `Mencetak Retur ${returnData.returnNumber}`);
                  const logoImg = document.querySelector('.print-only .print-logo-image') as HTMLImageElement | null;
                  if (logoImg && !logoImg.complete) {
                    await new Promise<void>((resolve) => {
                      logoImg.onload = () => resolve();
                      logoImg.onerror = () => resolve();
                      setTimeout(resolve, 3000);
                    });
                  }
                  window.print();
                }}
                className="gap-1"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </Button>
            )}
            {returnData.status === 'pending' && (
              <>
                {/* For refunds only - credit notes complete automatically when balance is used up */}
                {returnData.returnType === 'refund' && (
                  <Button variant="outline" onClick={() => updateStatusMutation.mutate('completed')}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Selesaikan
                  </Button>
                )}
                <Button variant="outline" className="text-red-600" onClick={() => updateStatusMutation.mutate('cancelled')}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Batalkan
                </Button>
              </>
            )}

            {/* Quick actions dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setEditNotes(returnData.notes || '');
                  setEditDialogOpen(true);
                }}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {Number(returnData.usedAmount || 0) === 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Hapus
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Item Retur</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produk</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.invoiceItem?.product?.name || item.invoiceItem?.description}</TableCell>
                        <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.price))}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.subtotal))}</TableCell>
                        <TableCell className="text-muted-foreground">{item.reason || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-4" />
                <div className="flex justify-end">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Retur</div>
                    <div className="text-2xl font-bold">{formatCurrency(Number(returnData.totalAmount))}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {returnData.returnType === 'credit_note' && usages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Riwayat Penggunaan Credit Note</CardTitle>
                  <CardDescription>Daftar penggunaan saldo credit note</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Tipe</TableHead>
                        <TableHead className="text-right">Jumlah</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usages.map((usage) => (
                        <TableRow key={usage.id}>
                          <TableCell>{formatDate(usage.usedAt instanceof Date ? usage.usedAt.toISOString() : usage.usedAt)}</TableCell>
                          <TableCell>
                            {usage.usageType === 'payment' ? (
                              <Badge variant="outline">Pembayaran Invoice</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700">Konversi Refund</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(usage.amount))}</TableCell>
                          <TableCell className="text-muted-foreground">{usage.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Pelanggan</div>
                  <div className="font-medium">{client.name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Invoice Asal</div>
                  <Link href={`/invoices/${invoice.id}`} className="flex items-center gap-1 text-primary hover:underline">
                    {invoice.invoiceNumber}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                {returnData.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground">Catatan</div>
                    <div>{returnData.notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {returnData.returnType === 'credit_note' && returnData.status === 'completed' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Saldo Credit Note
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span>{formatCurrency(Number(returnData.totalAmount))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terpakai</span>
                    <span>{formatCurrency(Number(returnData.usedAmount))}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Sisa Saldo</span>
                    <span className={`font-bold text-lg ${remainingBalance > 0 ? 'text-green-600' : ''}`}>
                      {formatCurrency(remainingBalance)}
                    </span>
                  </div>

                  {remainingBalance > 0 && (
                    <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Konversi ke Refund
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Konversi ke Refund Tunai</DialogTitle>
                          <DialogDescription>
                            Konversi sisa saldo credit note menjadi pengembalian uang tunai.
                            Sisa saldo: {formatCurrency(remainingBalance)}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Jumlah Refund</Label>
                            <Input
                              type="number"
                              value={refundAmount}
                              onChange={(e) => setRefundAmount(e.target.value)}
                              placeholder={`Max ${formatCurrency(remainingBalance)}`}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>Batal</Button>
                          <Button onClick={handleConvertToRefund} disabled={convertToRefundMutation.isPending}>
                            {convertToRefundMutation.isPending ? "Memproses..." : "Konversi"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Hapus Retur</DialogTitle>
              <DialogDescription>
                Apakah Anda yakin ingin menghapus retur {returnData.returnNumber}? Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Retur</DialogTitle>
              <DialogDescription>
                {Number(returnData.usedAmount || 0) > 0
                  ? "Hanya catatan yang dapat diubah karena credit note sudah digunakan."
                  : "Perbarui catatan retur ini."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Input
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Catatan retur..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Batal</Button>
              <Button onClick={() => updateMutation.mutate(editNotes)} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
