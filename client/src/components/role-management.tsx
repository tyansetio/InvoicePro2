import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield, Plus, Pencil, Trash2 } from "lucide-react";

type Role = {
  id: number;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
};

const PERMISSION_GROUPS = {
  "Dashboard": [
    { id: "dashboard.view", label: "Lihat Dashboard" },
  ],
  "Produk": [
    { id: "products.view", label: "Lihat Produk" },
    { id: "products.create", label: "Tambah Produk" },
    { id: "products.edit", label: "Edit Produk" },
    { id: "products.delete", label: "Hapus Produk" },
    { id: "products.adjust_stock", label: "Adjust Stock" },
    { id: "products.view_cost", label: "Lihat Cost Price" },
    { id: "products.view_lowest_price", label: "Lihat Lowest Price" },
    { id: "products.export", label: "Export Produk" },
    { id: "products.import", label: "Import Produk" },
  ],
  "Invoice": [
    { id: "invoices.view", label: "Lihat Invoice" },
    { id: "invoices.create", label: "Buat Invoice" },
    { id: "invoices.edit", label: "Edit Invoice" },
    { id: "invoices.print", label: "Print Invoice" },
    { id: "payments.manage", label: "Tambah/Ubah Payment" },
    { id: "invoices.override_lowest_price", label: "Set Harga di Bawah Lowest Price" },
  ],
  "Quotation": [
    { id: "quotations.view", label: "Lihat Quotation" },
    { id: "quotations.create", label: "Buat Quotation" },
    { id: "quotations.edit", label: "Edit Quotation" },
    { id: "quotations.delete", label: "Hapus Quotation" },
    { id: "quotations.print", label: "Print Quotation" },
  ],
  "Purchase Order": [
    { id: "purchase_orders.view", label: "Lihat PO" },
    { id: "purchase_orders.create", label: "Buat PO" },
    { id: "purchase_orders.edit", label: "Edit PO" },
    { id: "purchase_orders.delete", label: "Hapus PO" },
  ],
  "Goods Receipt": [
    { id: "goods_receipts.view", label: "Lihat Penerimaan Barang" },
    { id: "goods_receipts.create", label: "Buat Penerimaan Barang" },
    { id: "goods_receipts.delete", label: "Hapus Penerimaan Barang" },
  ],
  "Delivery Note": [
    { id: "delivery_notes.view", label: "Lihat Surat Jalan" },
    { id: "delivery_notes.create", label: "Buat Surat Jalan" },
    { id: "delivery_notes.edit", label: "Edit Surat Jalan" },
    { id: "delivery_notes.delete", label: "Hapus Surat Jalan" },
    { id: "delivery_notes.print", label: "Print Surat Jalan" },
    { id: "delivery_notes.update_status", label: "Ubah Status Surat Jalan" },
  ],
  "Retur": [
    { id: "returns.view", label: "Lihat Retur" },
    { id: "returns.create", label: "Buat Retur" },
    { id: "returns.delete", label: "Hapus Retur" },
    { id: "returns.print", label: "Print Retur" },
  ],
  "Klien": [
    { id: "clients.view", label: "Lihat Klien" },
    { id: "clients.create", label: "Tambah Klien" },
    { id: "clients.edit", label: "Edit Klien" },
    { id: "clients.delete", label: "Hapus Klien" },
  ],
  "Supplier": [
    { id: "suppliers.view", label: "Lihat Supplier" },
    { id: "suppliers.create", label: "Tambah Supplier" },
    { id: "suppliers.edit", label: "Edit Supplier" },
    { id: "suppliers.delete", label: "Hapus Supplier" },
  ],
  "Transaksi": [
    { id: "transactions.view", label: "Lihat Transaksi" },
    { id: "transactions.create", label: "Buat Transaksi" },
    { id: "transactions.edit", label: "Edit Transaksi" },
    { id: "transactions.delete", label: "Hapus Transaksi" },
  ],
  "Laporan": [
    { id: "reports.view", label: "Lihat Laporan" },
    { id: "reports.export", label: "Export Laporan" },
  ],
  "Pengaturan": [
    { id: "settings.view", label: "Lihat Pengaturan" },
    { id: "settings.edit", label: "Edit Pengaturan" },
    { id: "settings.users", label: "Kelola User" },
  ],
  "Activity Log": [
    { id: "activity_log.view", label: "Lihat Activity Log" },
  ],
};

const roleSchema = z.object({
  name: z.string().min(2, "Nama role minimal 2 karakter"),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

type RoleFormData = z.infer<typeof roleSchema>;

export function RoleManagement() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  const { data: roles, isLoading } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      return apiRequest("POST", "/api/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({ title: "Berhasil", description: "Role berhasil ditambahkan" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Gagal menambahkan role", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: RoleFormData }) => {
      return apiRequest("PATCH", `/api/roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({ title: "Berhasil", description: "Role berhasil diperbarui" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Gagal memperbarui role", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      toast({ title: "Berhasil", description: "Role berhasil dihapus" });
      setDeletingRole(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Gagal menghapus role", variant: "destructive" });
    },
  });

  const openDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      form.reset({
        name: role.name,
        description: role.description || "",
        permissions: role.permissions || [],
      });
    } else {
      setEditingRole(null);
      form.reset({
        name: "",
        description: "",
        permissions: [],
      });
    }
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRole(null);
    form.reset();
  };

  const onSubmit = (data: RoleFormData) => {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleGroupToggle = (groupName: string, checked: boolean) => {
    const group = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    const currentPermissions = form.getValues("permissions");
    
    if (checked) {
      const combined = [...currentPermissions, ...group.map(p => p.id)];
      const newPermissions = combined.filter((item, index) => combined.indexOf(item) === index);
      form.setValue("permissions", newPermissions);
    } else {
      const groupIds = group.map(p => p.id);
      const newPermissions = currentPermissions.filter(p => !groupIds.includes(p));
      form.setValue("permissions", newPermissions);
    }
  };

  const isGroupFullySelected = (groupName: string): boolean => {
    const group = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    const currentPermissions = form.watch("permissions");
    return group.every(p => currentPermissions.includes(p.id));
  };

  const isGroupPartiallySelected = (groupName: string): boolean => {
    const group = PERMISSION_GROUPS[groupName as keyof typeof PERMISSION_GROUPS];
    const currentPermissions = form.watch("permissions");
    const selectedCount = group.filter(p => currentPermissions.includes(p.id)).length;
    return selectedCount > 0 && selectedCount < group.length;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manajemen Role
          </CardTitle>
          <CardDescription>
            Buat dan kelola role kustom dengan hak akses yang berbeda
          </CardDescription>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Role
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : roles && roles.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Role</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Jumlah Permission</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description || "-"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      {role.permissions?.length || 0} permission
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(role)}
                        disabled={role.isSystem}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeletingRole(role)}
                        disabled={role.isSystem}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada role kustom.</p>
            <p className="text-sm">Klik "Tambah Role" untuk membuat role baru.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Tambah Role Baru"}</DialogTitle>
            <DialogDescription>
              {editingRole ? "Ubah nama, deskripsi, dan hak akses role" : "Buat role baru dengan hak akses yang sesuai"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Role *</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Supervisor, Kasir, Admin Gudang" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Deskripsi singkat tentang role ini..." 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={() => (
                  <FormItem>
                    <FormLabel>Hak Akses (Permissions)</FormLabel>
                    <div className="border rounded-lg p-4">
                      <Accordion type="multiple" className="w-full">
                        {Object.entries(PERMISSION_GROUPS).map(([groupName, permissions]) => (
                          <AccordionItem key={groupName} value={groupName}>
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isGroupFullySelected(groupName)}
                                  ref={(el) => {
                                    if (el) {
                                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = isGroupPartiallySelected(groupName);
                                    }
                                  }}
                                  onCheckedChange={(checked) => handleGroupToggle(groupName, !!checked)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="font-medium">{groupName}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({permissions.length} permission)
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="grid grid-cols-2 gap-2 pl-8 pt-2">
                                {permissions.map((permission) => (
                                  <FormField
                                    key={permission.id}
                                    control={form.control}
                                    name="permissions"
                                    render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(permission.id)}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                field.onChange([...field.value, permission.id]);
                                              } else {
                                                field.onChange(field.value.filter((v: string) => v !== permission.id));
                                              }
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal cursor-pointer">
                                          {permission.label}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Batal
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Role?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus role "{deletingRole?.name}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
