import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { History, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useStore } from "@/lib/store-context";

type ActivityLog = {
  id: number;
  storeId: number | null;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  entityLabel: string | null;
  description: string;
  createdAt: string;
};

type User = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  permissions?: string[];
};

const ACTION_LABELS: Record<string, string> = {
  create: "Buat",
  update: "Ubah",
  delete: "Hapus",
  void: "Void",
  status_change: "Ubah Status",
  payment_add: "Tambah Bayar",
  payment_delete: "Hapus Bayar",
  print: "Cetak",
  stock_adjust: "Adj. Stok",
  setting_change: "Pengaturan",
  permission_change: "Izin Akses",
  convert: "Konversi",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  void: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  status_change: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  payment_add: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
  payment_delete: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  print: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  stock_adjust: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500",
  setting_change: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  permission_change: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  convert: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
};

const ENTITY_LABELS: Record<string, string> = {
  invoice: "Invoice",
  quotation: "Penawaran",
  delivery_note: "Surat Jalan",
  purchase_order: "Purchase Order",
  goods_receipt: "Penerimaan Barang",
  return: "Retur",
  product: "Produk",
  client: "Klien",
  user: "Pengguna",
  setting: "Pengaturan",
  planning: "Perencanaan",
};

const ENTITY_PATHS: Record<string, string> = {
  invoice: "/invoices",
  quotation: "/quotations",
  delivery_note: "/delivery-notes",
  purchase_order: "/purchase-orders",
  goods_receipt: "/goods-receipts",
  return: "/returns",
  product: "/products",
  client: "/clients",
};

const PAGE_SIZE = 25;

export default function ActivityLogPage() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const { currentStoreId } = useStore();

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const { data: usersData } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const params = new URLSearchParams();
  if (filterUserId !== "all") params.set("userId", filterUserId);
  if (filterAction !== "all") params.set("action", filterAction);
  if (filterEntity !== "all") params.set("entity", filterEntity);
  if (filterDateFrom) params.set("dateFrom", filterDateFrom);
  if (filterDateTo) params.set("dateTo", filterDateTo);
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));

  const { data, isLoading } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: [`/api/stores/${currentStoreId}/activity-logs`, filterUserId, filterAction, filterEntity, filterDateFrom, filterDateTo, page],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${currentStoreId}/activity-logs?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!(currentUser && (currentUser.role === 'owner' || currentUser.permissions?.includes('activity_log.view'))),
  });

  const canView = currentUser?.role === 'owner' || currentUser?.permissions?.includes('activity_log.view');
  if (currentUser && !canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const handleReset = () => {
    setFilterUserId("all");
    setFilterAction("all");
    setFilterEntity("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  };

  const getEntityLink = (log: ActivityLog) => {
    const path = ENTITY_PATHS[log.entity];
    if (!path || !log.entityId) return null;
    return `${path}/${log.entityId}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <History className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">Riwayat semua aktivitas pengguna pada sistem</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Select value={filterUserId} onValueChange={v => { setFilterUserId(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Semua pengguna" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua pengguna</SelectItem>
                {usersData?.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.fullName || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Semua aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua aksi</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterEntity} onValueChange={v => { setFilterEntity(v); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Semua entitas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua entitas</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); setPage(1); }}
              placeholder="Dari tanggal"
            />
            <Input
              type="date"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); setPage(1); }}
              placeholder="Sampai tanggal"
            />

            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <span>Riwayat Aktivitas</span>
            {data && (
              <span className="text-sm font-normal text-muted-foreground">
                {data.total.toLocaleString('id-ID')} aktivitas ditemukan
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Waktu</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pengguna</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aksi</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entitas</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Dokumen</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading && Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
                {!isLoading && data?.logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Tidak ada aktivitas yang ditemukan
                    </td>
                  </tr>
                )}
                {!isLoading && data?.logs.map(log => {
                  const entityLink = getEntityLink(log);
                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        {log.createdAt ? format(new Date(log.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId }) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium leading-tight">{log.userName || '-'}</span>
                          {log.userRole && (
                            <Badge variant="outline" className="text-xs w-fit py-0 px-1.5 h-4">
                              {log.userRole === 'owner' ? 'Pemilik' : 'Staf'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </td>
                      <td className="px-4 py-3">
                        {entityLink ? (
                          <button
                            onClick={() => setLocation(entityLink)}
                            className="text-primary hover:underline font-medium text-xs"
                          >
                            {log.entityLabel || `#${log.entityId}`}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{log.entityLabel || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">
                        {log.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Berikutnya
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
