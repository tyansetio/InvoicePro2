import { useState } from "react";
import { logPrint } from "@/lib/activity-log";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Edit, FileDown, Trash2, FileEdit, Calendar, Building, Mail, Phone, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useStore } from '@/lib/store-context';
import type { PrintSettings } from "@shared/schema";

interface QuotationDetailPageProps {
  id: number;
}

type QuotationWithItems = {
  quotation: {
    id: number;
    quotationNumber: string;
    clientId: number;
    issueDate: string;
    expiryDate: string;
    status: string;
    subtotal: string;
    taxRate: string;
    taxAmount: string;
    discount: string;
    shipping: string;
    totalAmount: string;
    notes: string;
    convertedToInvoiceId?: number;
    rejectionReason?: string;
    createdByName?: string;
  };
  items: Array<{
    id: number;
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    taxAmount: string;
    discount: string;
    subtotal: string;
    totalAmount: string;
    productSku?: string;
    productCode?: string;
    unitLabel?: string;
  }>;
  client?: {
    id: number;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
};

export default function QuotationDetailPage({
 id }: QuotationDetailPageProps) {
  const { currentStoreId } = useStore();

  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: quotationData, isLoading, error } = useQuery<QuotationWithItems>({
    queryKey: ['/api/quotations', id],
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
  }>({
    queryKey: ['/api/user'],
  });

  // Fetch store details (name, address, tagline, etc.)
  const { data: currentStore } = useQuery<any>({
    queryKey: [`/api/stores/${currentStoreId}`],
    enabled: !!currentStoreId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/quotations/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/quotations`] });
      toast({
        title: "Quotation deleted",
        description: "The quotation has been deleted successfully.",
      });
      navigate("/quotations");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete quotation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/quotations/${id}/convert`, {}) as Promise<unknown> as Promise<{ id: number }>;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/quotations`] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Quotation converted",
        description: "The quotation has been converted to an invoice successfully.",
      });
      if (invoice?.id) {
        navigate(`/invoices/${invoice.id}`);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to convert quotation to invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest('PATCH', `/api/quotations/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations', id] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/quotations`] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: number; rejectionReason: string }) => {
      return apiRequest('PATCH', `/api/quotations/${id}`, { 
        status: 'rejected', 
        rejectionReason 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotations', id] });
      queryClient.invalidateQueries({ queryKey: [`/api/stores/${currentStoreId}/quotations`] });
      setRejectDialogOpen(false);
      setRejectionReason("");
      toast({
        title: "Quotation rejected",
        description: "The quotation has been marked as rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject quotation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string, convertedToInvoiceId?: number | null) => {
    if (convertedToInvoiceId || status === 'accepted') return 'success';
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'sent':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'expired':
        return 'outline';
      default:
        return 'secondary';
    }
  };
  
  const getStatusLabel = (status: string, convertedToInvoiceId?: number | null) => {
    if (convertedToInvoiceId || status === 'accepted') return 'Converted';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !quotationData) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-16">
        <h2 className="text-2xl font-semibold">Quotation not found</h2>
        <p className="text-muted-foreground">The quotation you're looking for doesn't exist or may have been deleted.</p>
        <Link href="/quotations">
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Quotations
          </Button>
        </Link>
      </div>
    );
  }

  const { quotation, items, client } = quotationData;

  const handlePrint = async () => {
    if (quotation.status === 'draft') {
      try {
        await updateStatusMutation.mutateAsync({ id: quotation.id, status: 'sent' });
      } catch (error) {
        toast({
          title: "Warning",
          description: "Failed to update status to 'sent', but printing will continue.",
          variant: "default",
        });
      }
    }
    logPrint('quotation', quotation.id, quotation.quotationNumber, `Mencetak Penawaran ${quotation.quotationNumber}`);
    const logoImg = document.querySelector('.print-only .print-logo-image') as HTMLImageElement | null;
    if (logoImg && !logoImg.complete) {
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        setTimeout(resolve, 3000);
      });
    }
    window.print();
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please provide a reason for rejecting this quotation.",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ id: quotation.id, rejectionReason: rejectionReason.trim() });
  };

  return (
    <>
      {/* Print-only template */}
      <div className="print-only" style={{ display: 'none' }}>
        <div className="print-invoice-template">
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
              <div className="print-company-address">
                {currentStore?.address || "Your Company Address"}
                {currentStore?.phone && (
                  <>
                    <br />
                    Phone: {currentStore.phone}
                  </>
                )}
                {currentStore?.email && (
                  <>
                    {currentStore?.phone ? ' / ' : <br />}
                    Email: {currentStore.email}
                  </>
                )}
              </div>
            </div>
            
            {/* Right column: Document Details */}
            <div className="print-header-right">
              <div className="print-doc-type" style={{ borderColor: '#000' }}>QUOTATION</div>
              <div className="print-doc-details">
                <div className="print-doc-row">
                  <span className="print-doc-label">No.</span>
                  <span className="print-doc-value">{quotation.quotationNumber}</span>
                </div>
                <div className="print-doc-row">
                  <span className="print-doc-label">Date</span>
                  <span className="print-doc-value">{formatDate(quotation.issueDate)}</span>
                </div>
                <div className="print-doc-row">
                  <span className="print-doc-label">Valid Until</span>
                  <span className="print-doc-value">{formatDate(quotation.expiryDate) || 'N/A'}</span>
                </div>
                {/* Created By */}
                {quotation.createdByName && (
                  <div className="print-doc-row">
                    <span className="print-doc-label">Created By</span>
                    <span className="print-doc-value">{quotation.createdByName}</span>
                  </div>
                )}
                {/* Page indicator */}
                <div className="print-doc-row">
                  <span className="print-doc-label">Page</span>
                  <span className="print-doc-value">1/1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table - Same format as Invoice */}
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
              {items.map((item, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{index + 1}</div></td>
                  <td style={{ textAlign: 'center' }}><div className="print-cell-clip" style={{ fontSize: '7pt' }}>{item.productCode || item.productSku || '-'}</div></td>
                  <td style={{ textAlign: 'left' }}><div className="print-cell-clip">{item.description}</div></td>
                  <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{item.quantity}</div></td>
                  <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{item.unitLabel || '-'}</div></td>
                  <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatCurrency(parseFloat(item.unitPrice))}</div></td>
                  <td style={{ textAlign: 'center' }}><div className="print-cell-clip">{formatCurrency(parseFloat(item.totalAmount))}</div></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-footer">
            <div className="print-footer-left">
              <div className="print-notes-label">Notes / Terms & Conditions:</div>
              <div className="print-notes-text">
                {(storePrintSettings?.quotationNotes || storePrintSettings?.defaultNotes) && (
                  <div>{storePrintSettings?.quotationNotes || storePrintSettings?.defaultNotes}</div>
                )}
                {quotation.notes && (
                  <div style={{ marginTop: (storePrintSettings?.quotationNotes || storePrintSettings?.defaultNotes) ? '8px' : '0' }}>{quotation.notes}</div>
                )}
                {!quotation.notes && !(storePrintSettings?.quotationNotes || storePrintSettings?.defaultNotes) && (
                  <div>Items checked and verified upon delivery. Items cannot be returned.</div>
                )}
              </div>
            </div>
            
            <div className="print-footer-right">
              {(parseFloat(quotation.discount || '0') > 0 || parseFloat(quotation.shipping || '0') > 0) && (
                <div className="print-total-row">
                  <span className="print-total-label">Subtotal</span>
                  <span className="print-total-value">{formatCurrency(parseFloat(quotation.subtotal))}</span>
                </div>
              )}
              {parseFloat(quotation.discount || '0') > 0 && (
                <div className="print-total-row">
                  <span className="print-total-label">Discount</span>
                  <span className="print-total-value">-{formatCurrency(parseFloat(quotation.discount))}</span>
                </div>
              )}
              {parseFloat(quotation.shipping || '0') > 0 && (
                <div className="print-total-row">
                  <span className="print-total-label">Ongkos Kirim</span>
                  <span className="print-total-value">+{formatCurrency(parseFloat(quotation.shipping))}</span>
                </div>
              )}
              <div className="print-total-row print-total-final" style={{ backgroundColor: '#e8e8e8' }}>
                <span className="print-total-label">TOTAL</span>
                <span className="print-total-value">{formatCurrency(parseFloat(quotation.totalAmount))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen view */}
      <div className="space-y-6 screen-only" data-testid="quotation-detail-page">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/quotations">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-quotation-number">
              {quotation.quotationNumber}
            </h1>
            <div className="flex items-center space-x-2">
              <Badge variant={getStatusBadgeVariant(quotation.status, quotation.convertedToInvoiceId) as any}>
                {getStatusLabel(quotation.status, quotation.convertedToInvoiceId)}
              </Badge>
              {quotation.status === 'rejected' && quotation.rejectionReason && (
                <span className="text-sm text-muted-foreground italic">
                  Reason: {quotation.rejectionReason}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {!quotation.convertedToInvoiceId && (
            <Link href={`/quotations/${quotation.id}/edit`}>
              <Button variant="outline" data-testid="button-edit-quotation">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          
          <Button
            variant="outline"
            onClick={handlePrint}
            data-testid="button-print-quotation"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>

          {quotation.status !== 'accepted' && quotation.status !== 'rejected' && !quotation.convertedToInvoiceId && (
            <Button
              onClick={() => convertMutation.mutate(quotation.id)}
              disabled={convertMutation.isPending}
              data-testid="button-convert-to-invoice"
            >
              <FileEdit className="mr-2 h-4 w-4" />
              Convert to Invoice
            </Button>
          )}

          {quotation.status !== 'rejected' && quotation.status !== 'accepted' && !quotation.convertedToInvoiceId && (
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(true)}
              disabled={rejectMutation.isPending}
              data-testid="button-reject-quotation"
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-quotation">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this quotation? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(quotation.id)}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                  data-testid="button-confirm-delete"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quotation Details */}
          <Card>
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium" data-testid="text-issue-date">
                    {formatDate(quotation.issueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expiry Date</p>
                  <p className="font-medium" data-testid="text-expiry-date">
                    {formatDate(quotation.expiryDate)}
                  </p>
                </div>
                {quotation.createdByName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Created By</p>
                    <p className="font-medium">{quotation.createdByName}</p>
                  </div>
                )}
              </div>
              
              {quotation.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm" data-testid="text-notes">{quotation.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id || index} data-testid={`row-item-${index}`}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right" data-testid={`text-unit-price-${index}`}>
                        {formatCurrency(parseFloat(item.unitPrice))}
                      </TableCell>
                      <TableCell className="text-right font-medium" data-testid={`text-total-${index}`}>
                        {formatCurrency(parseFloat(item.totalAmount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span data-testid="text-subtotal">{formatCurrency(parseFloat(quotation.subtotal))}</span>
                </div>
                {parseFloat(quotation.discount || '0') > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span data-testid="text-discount">-{formatCurrency(parseFloat(quotation.discount))}</span>
                  </div>
                )}
                {parseFloat(quotation.shipping || '0') > 0 && (
                  <div className="flex justify-between">
                    <span>Ongkos Kirim:</span>
                    <span data-testid="text-shipping">+{formatCurrency(parseFloat(quotation.shipping))}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span data-testid="text-total-amount">{formatCurrency(parseFloat(quotation.totalAmount))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Information */}
          {client && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="mr-2 h-4 w-4" />
                  Client Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium" data-testid="text-client-name">{client.name}</p>
                </div>
                
                {client.email && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="mr-2 h-3 w-3" />
                    <span data-testid="text-client-email">{client.email}</span>
                  </div>
                )}
                
                {client.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-3 w-3" />
                    <span data-testid="text-client-phone">{client.phone}</span>
                  </div>
                )}
                
                {client.address && (
                  <div className="text-sm text-muted-foreground">
                    <p data-testid="text-client-address">{client.address}</p>
                    {client.city && (
                      <p>
                        {client.city}
                        {client.postalCode && `, ${client.postalCode}`}
                      </p>
                    )}
                    {client.country && <p>{client.country}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quotation.convertedToInvoiceId && (
                <Link href={`/invoices/${quotation.convertedToInvoiceId}`}>
                  <Button variant="outline" className="w-full justify-start">
                    <FileEdit className="mr-2 h-4 w-4" />
                    View Converted Invoice
                  </Button>
                </Link>
              )}
              
              <Link href="/quotations">
                <Button variant="outline" className="w-full justify-start">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Quotations
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Quotation</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this quotation. This will be recorded for future reference.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Quotation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}