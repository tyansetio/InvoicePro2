import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, MapPin, FileText, Calendar, AlertCircle, ShoppingCart, Edit, TrendingUp, Receipt, Wallet, RefreshCw, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientForm } from "@/components/clients/client-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useStore } from "@/lib/store-context";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Client = {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  addressLink: string;
  taxNumber: string;
  clientNumber: string;
  createdAt: string;
};

type ClientStats = {
  totalPurchases: number;
  unpaidInvoicesCount: number;
  lastPurchaseDate: string | null;
  firstPurchaseDate: string | null;
};

type MonthlyPurchase = {
  month: string;
  totalAmount: number;
  invoiceCount: number;
};

type ClientInvoice = {
  id: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  totalAmount: string;
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const { currentStoreId } = useStore();
  const clientId = parseInt(id!);
  const [, setLocation] = useLocation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: [`/api/clients/${clientId}`],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ClientStats>({
    queryKey: [`/api/clients/${clientId}/stats`],
  });

  const { data: monthlyPurchases, isLoading: purchasesLoading } = useQuery<MonthlyPurchase[]>({
    queryKey: [`/api/clients/${clientId}/monthly-purchases`],
  });

  const { data: clientInvoices, isLoading: invoicesLoading } = useQuery<ClientInvoice[]>({
    queryKey: [`/api/clients/${clientId}/invoices`],
  });

  const { data: depositBalanceData } = useQuery<{ balance: number }>({
    queryKey: ['/api/clients', clientId, 'deposit-balance'],
    staleTime: 0,
  });
  const depositBalance = depositBalanceData?.balance || 0;

  type DepositRecord = {
    id: number;
    type: string;
    amount: string;
    balance: string;
    invoiceId: number | null;
    description: string | null;
    date: string;
    createdAt: string;
  };
  const { data: depositHistory, isLoading: depositsLoading } = useQuery<DepositRecord[]>({
    queryKey: ['/api/clients', clientId, 'deposits'],
  });

  type CashAccountItem = { id: number; name: string; accountType: string };
  const { data: cashAccounts } = useQuery<CashAccountItem[]>({
    queryKey: [`/api/stores/${currentStoreId}/cash-accounts`],
    enabled: !!currentStoreId,
  });

  const { toast } = useToast();
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundForm, setRefundForm] = useState({
    amount: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    cashAccountId: '',
  });

  const refundDepositMutation = useMutation({
    mutationFn: async (data: { amount: string; notes: string; date: string; cashAccountId: string }) => {
      return apiRequest('POST', `/api/clients/${clientId}/refund-deposit`, {
        ...data,
        cashAccountId: data.cashAccountId ? parseInt(data.cashAccountId) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'deposit-balance'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', clientId, 'deposits'], refetchType: 'all' });
      setRefundDialogOpen(false);
      setRefundForm({ amount: '', notes: '', date: format(new Date(), 'yyyy-MM-dd'), cashAccountId: '' });
      toast({
        title: "Berhasil",
        description: "Deposit berhasil direfund.",
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
        title: "Refund Gagal",
        description: errorMsg,
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      sent: { variant: "default", label: "Sent" },
      pending: { variant: "outline", label: "Pending" },
      paid: { variant: "default", label: "Paid" },
      overdue: { variant: "destructive", label: "Overdue" },
      void: { variant: "secondary", label: "Void" },
    };
    const config = statusConfig[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleInvoiceDoubleClick = (invoiceId: number) => {
    setLocation(`/invoices/${invoiceId}`);
  };

  if (clientLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Client not found</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">The client you're looking for doesn't exist.</p>
        <Link href="/clients">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="sm" data-testid="button-back-to-clients">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-client-name">
              {client.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Client #{client.clientNumber || client.id}
            </p>
          </div>
        </div>
        <Button onClick={() => setIsEditDialogOpen(true)} data-testid="button-edit-client">
          <Edit className="mr-2 h-4 w-4" />
          Edit Client
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Purchases</h3>
              <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-total-purchases">
              {stats?.totalPurchases || 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Invoices created</p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Unpaid Invoices</h3>
              <AlertCircle className={`h-5 w-5 ${stats?.unpaidInvoicesCount ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-unpaid-invoices">
              {stats?.unpaidInvoicesCount || 0}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stats?.unpaidInvoicesCount === 0 ? 'All paid' : 'Pending payment'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Deposit Balance</h3>
              <Wallet className={`h-5 w-5 ${depositBalance > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
            </div>
            <div className={`text-2xl font-bold ${depositBalance > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
              Rp {depositBalance.toLocaleString('id-ID')}
            </div>
            {depositBalance > 0 ? (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  setRefundForm({ amount: depositBalance.toString(), notes: '', date: format(new Date(), 'yyyy-MM-dd'), cashAccountId: '' });
                  setRefundDialogOpen(true);
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refund Deposit
              </Button>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No deposit</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Purchase</h3>
              <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-last-purchase">
              {stats?.lastPurchaseDate ? format(new Date(stats.lastPurchaseDate), 'MMM d, yyyy') : 'Never'}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stats?.lastPurchaseDate ? 'Date of last invoice' : 'No purchases yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                  {client.email ? (
                    <a 
                      href={`mailto:${client.email}`} 
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                      data-testid="link-email"
                    >
                      {client.email}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                  {client.phone ? (
                    <a 
                      href={`tel:${client.phone}`} 
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      data-testid="link-phone"
                    >
                      {client.phone}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">Not provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Client Since</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-created-date">
                    {client.createdAt ? format(new Date(client.createdAt), 'MMM d, yyyy') : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                  {client.address ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-address">
                        {client.address}
                      </p>
                      {client.addressLink && (
                        <a 
                          href={client.addressLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          data-testid="link-address-map"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          View on Google Maps
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Not provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tax Number</p>
                  {client.taxNumber ? (
                    <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-tax-number">
                      {client.taxNumber}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Not provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShoppingCart className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">First Purchase</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-first-purchase">
                    {stats?.firstPurchaseDate ? format(new Date(stats.firstPurchaseDate), 'MMM d, yyyy') : 'No purchases yet'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {stats?.lastPurchaseDate && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Marketing Follow-up
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Last purchase was on {format(new Date(stats.lastPurchaseDate), 'MMMM d, yyyy')}. 
                    {stats.unpaidInvoicesCount > 0 && ` This client has ${stats.unpaidInvoicesCount} unpaid invoice${stats.unpaidInvoicesCount > 1 ? 's' : ''}.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Purchases Chart */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <TrendingUp className="h-5 w-5" />
            Monthly Purchases
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchasesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !monthlyPurchases || monthlyPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No purchase data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This client hasn't made any purchases yet.
              </p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyPurchases}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                  />
                  <YAxis 
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                    tickFormatter={(value) => `Rp ${(value / 1000000).toFixed(1)}jt`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#111827', fontWeight: 600 }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Total Amount') {
                        return [`Rp ${value.toLocaleString('id-ID')}`, 'Total'];
                      }
                      return [value, name];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalAmount" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Total Amount"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="invoiceCount" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Invoice Count"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Receipt className="h-5 w-5" />
            Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !clientInvoices || clientInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No invoices</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This client doesn't have any invoices yet.
              </p>
            </div>
          ) : (
            <div className="rounded-md border max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white dark:bg-gray-950 z-10">
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientInvoices.map((invoice) => (
                    <TableRow 
                      key={invoice.id}
                      className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                      onDoubleClick={() => handleInvoiceDoubleClick(invoice.id)}
                    >
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>{format(new Date(invoice.issueDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{invoice.dueDate ? format(new Date(invoice.dueDate), 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">{invoice.totalAmount ? `Rp ${Number(invoice.totalAmount).toLocaleString('id-ID')}` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Double-click on an invoice to view details
          </p>
        </CardContent>
      </Card>

      {/* Deposit History */}
      {depositHistory && depositHistory.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Wallet className="h-5 w-5" />
              Deposit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white dark:bg-gray-950 z-10">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {depositHistory.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell>{format(new Date(deposit.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge variant={deposit.type === 'deposit' ? 'default' : deposit.type === 'refund' ? 'destructive' : 'secondary'}>
                          {deposit.type === 'deposit' ? 'Deposit' : deposit.type === 'refund' ? 'Refund' : 'Used'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{deposit.description || '-'}</TableCell>
                      <TableCell className={`text-right font-medium ${deposit.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                        {deposit.type === 'deposit' ? '+' : '-'}Rp {Number(deposit.amount).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        Rp {Number(deposit.balance).toLocaleString('id-ID')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refund Deposit Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Refund Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              Saldo deposit tersedia: <span className="font-semibold">Rp {depositBalance.toLocaleString('id-ID')}</span>
            </div>
            <div className="space-y-2">
              <Label>Jumlah Refund</Label>
              <Input
                type="number"
                value={refundForm.amount}
                onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                placeholder="Masukkan jumlah refund"
              />
            </div>
            <div className="space-y-2">
              <Label>Akun Kas</Label>
              <Select
                value={refundForm.cashAccountId}
                onValueChange={(value) => setRefundForm({ ...refundForm, cashAccountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun kas" />
                </SelectTrigger>
                <SelectContent>
                  {cashAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-gray-400" />
                        {account.name}
                        <span className="text-xs text-gray-400">
                          ({account.accountType === 'cash' ? 'Kas' : account.accountType === 'bank_company' ? 'Bank Perusahaan' : account.accountType === 'bank_personal' ? 'Bank Pribadi' : 'Lainnya'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={refundForm.date}
                onChange={(e) => setRefundForm({ ...refundForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea
                value={refundForm.notes}
                onChange={(e) => setRefundForm({ ...refundForm, notes: e.target.value })}
                placeholder="Catatan untuk refund ini"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => refundDepositMutation.mutate(refundForm)}
              disabled={refundDepositMutation.isPending || !refundForm.amount || parseFloat(refundForm.amount) <= 0 || !refundForm.cashAccountId}
            >
              {refundDepositMutation.isPending ? 'Memproses...' : 'Refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <ClientForm 
            clientId={clientId} 
            onSuccess={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
