import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  FileText,
  Users,
  DollarSign,
  PieChart,
  Package2,
  Settings,
  UserCog,
  CreditCard,
  LogOut,
  Menu,
  FileEdit,
  Bell,
  Package,
  Building2,
  Truck,
  RotateCcw,
  User,
  Key,
  ChevronUp,
  ChevronDown,
  Store,
  Briefcase,
  History,
  ShieldCheck,
  UserPlus,
  Building,
  Plus,
} from "lucide-react";
import { UserManagement } from "@/components/user-management";
import { StoreManagement } from "@/components/store-management";
import { RoleManagement } from "@/components/role-management";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/lib/store-context";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type StoreType = {
  id: number;
  name: string;
};

interface SidebarProps {
  user: {
    id?: number;
    username?: string;
    fullName: string;
    email: string;
    role?: 'owner' | 'staff';
    permissions?: string[];
    storeId?: number | null;
  };
  open: boolean;
  onToggle: () => void;
  mobileView: boolean;
}

export function Sidebar({ user, open, onToggle, mobileView }: SidebarProps) {
  const { currentStoreId, setCurrentStoreId } = useStore();
  const [location] = useLocation();
  
  const { data: stores } = useQuery<StoreType[]>({
    queryKey: ['/api/stores'],
  });
  
  const currentStore = stores?.find(s => s.id === currentStoreId);
  const userStore = stores?.find(s => s.id === user.storeId);
  const isOwner = user.role === 'owner';
  const { toast } = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [editUsername, setEditUsername] = useState(user.username || "");
  const [editFullName, setEditFullName] = useState(user.fullName || "");
  const [editEmail, setEditEmail] = useState(user.email || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [storesManageOpen, setStoresManageOpen] = useState(false);

  const isActive = (path: string) => {
    return location === path;
  };

  const hasPermission = (permission: string): boolean => {
    if (user.role === 'owner') return true;
    return user.permissions?.includes(permission) ?? false;
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      window.location.reload();
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: "Error", description: "Mohon isi semua field", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Password baru tidak cocok", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      toast({ title: "Berhasil", description: "Password berhasil diubah" });
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Gagal mengubah password", 
        variant: "destructive" 
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editUsername || editUsername.trim().length < 3) {
      toast({ title: "Error", description: "Username minimal 3 karakter", variant: "destructive" });
      return;
    }
    if (!editFullName || editFullName.trim().length < 2) {
      toast({ title: "Error", description: "Nama minimal 2 karakter", variant: "destructive" });
      return;
    }
    if (!editEmail || !editEmail.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({ title: "Error", description: "Format email tidak valid", variant: "destructive" });
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await apiRequest("POST", "/api/auth/profile", {
        username: editUsername.trim(),
        fullName: editFullName.trim(),
        email: editEmail.trim(),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Berhasil", description: "Profil berhasil diperbarui" });
        setProfileOpen(false);
        window.location.reload();
      } else {
        toast({ title: "Error", description: data.message || "Gagal menyimpan profil", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Gagal menyimpan profil", variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const userInitial = user.fullName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase() || 'U';

  // If mobile and sidebar is closed, don't render sidebar
  if (mobileView && !open) {
    return (
      <>
        {open && (
          <div 
            className="fixed inset-0 z-40 bg-gray-900 bg-opacity-50 md:hidden"
            onClick={onToggle}
          ></div>
        )}
      </>
    );
  }

  return (
    <>
      {mobileView && open && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900 bg-opacity-50 md:hidden"
          onClick={onToggle}
        ></div>
      )}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-background dark:bg-card shadow-lg transform transition-transform duration-300 ease-in-out border-r border-border",
          mobileView ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <div className="flex items-center">
              <Briefcase className="w-8 h-8 text-primary" />
              <span className="ml-2 text-xl font-semibold text-foreground">CoreBiz</span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Notifications */}
              <button className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent">
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
            {hasPermission("dashboard.view") && (
              <Link 
                href="/dashboard"
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                  isActive("/dashboard") 
                    ? "text-primary-foreground bg-primary" 
                    : "text-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <BarChart2 className={cn(
                  "mr-3 h-5 w-5",
                  isActive("/dashboard") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <span>Dashboard</span>
              </Link>
            )}
            
            {/* Navigation Items (Clean List) */}
            <div className="mt-4 space-y-1">
              {hasPermission("invoices.view") && (
                <Link 
                  href="/invoices"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/invoices") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <FileText className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/invoices") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Invoices</span>
                </Link>
              )}
              
              {hasPermission("quotations.view") && (
                <Link 
                  href="/quotations"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/quotations") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <FileEdit className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/quotations") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Quotations</span>
                </Link>
              )}
              
              {hasPermission("delivery_notes.view") && (
                <Link 
                  href="/delivery-notes"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/delivery-notes") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Truck className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/delivery-notes") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Delivery Notes</span>
                </Link>
              )}
              
              {hasPermission("returns.view") && (
                <Link 
                  href="/returns"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/returns") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <RotateCcw className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/returns") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Returns</span>
                </Link>
              )}

              {hasPermission("clients.view") && (
                <Link 
                  href="/clients"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/clients") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Users className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/clients") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Clients</span>
                </Link>
              )}
              
              {hasPermission("suppliers.view") && (
                <Link 
                  href="/suppliers"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/suppliers") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Building2 className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/suppliers") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Suppliers</span>
                </Link>
              )}
              
              {hasPermission("products.view") && (
                <Link 
                  href="/products"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/products") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Package2 className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/products") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Products</span>
                </Link>
              )}

              {hasPermission("transactions.view") && (
                <Link 
                  href="/transactions"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/transactions") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <DollarSign className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/transactions") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Transactions</span>
                </Link>
              )}
              
              {hasPermission("reports.view") && (
                <Link 
                  href="/reports"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/reports") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <PieChart className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/reports") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Reports</span>
                </Link>
              )}

              {hasPermission("purchase_orders.view") && (
                <Link 
                  href="/purchase-orders"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/purchase-orders") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Package className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/purchase-orders") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Purchase Orders</span>
                </Link>
              )}
              
              {hasPermission("goods_receipts.view") && (
                <Link 
                  href="/goods-receipts"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/goods-receipts") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Package className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/goods-receipts") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Goods Receipt</span>
                </Link>
              )}

              {hasPermission("settings.view") && (
                <Link 
                  href="/settings"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/settings") 
                      ? "text-primary-foreground bg-primary" 
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Settings className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/settings") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Settings</span>
                </Link>
              )}


              {hasPermission('activity_log.view') && (
                <Link
                  href="/activity-log"
                  className={cn(
                    "flex items-center px-3 py-2.5 text-sm font-medium rounded-md group",
                    isActive("/activity-log")
                      ? "text-primary-foreground bg-primary"
                      : "text-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <History className={cn(
                    "mr-3 h-5 w-5",
                    isActive("/activity-log") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span>Activity Log</span>
                </Link>
              )}
            </div>
          </nav>
          
          {/* Store Selector Section */}
          <div className="border-t border-border p-2">
            {isOwner && stores && stores.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center w-full p-2 rounded-md hover:bg-accent transition-colors">
                    <Store className="h-5 w-5 text-muted-foreground mr-3" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-foreground truncate">
                        {currentStore?.name || 'Pilih Cabang'}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-56">
                  {stores.map((store) => (
                    <DropdownMenuItem
                      key={store.id}
                      onClick={() => setCurrentStoreId(store.id)}
                      className={currentStoreId === store.id ? 'bg-accent' : ''}
                    >
                      <Store className="h-4 w-4 mr-2" />
                      {store.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setStoresManageOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Cabang
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center p-2">
                <Store className="h-5 w-5 text-muted-foreground mr-3" />
                <p className="text-sm text-foreground truncate">
                  {userStore?.name || 'Tidak ada cabang'}
                </p>
              </div>
            )}
          </div>
          
          {/* User Profile Section with Dropdown */}
          <div className="border-t border-border p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center w-full p-2 rounded-md hover:bg-accent transition-colors">
                  <div className="flex-shrink-0">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="ml-3 overflow-hidden flex-1 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{user.fullName || user.username}</p>
                    <p className="text-xs text-muted-foreground truncate capitalize">
                      {user.role === 'owner' ? 'Pemilik' : 'Staff'}
                    </p>
                  </div>
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                {isOwner && (
                  <>
                    <DropdownMenuItem onClick={() => setUsersOpen(true)}>
                      <Users className="h-4 w-4 mr-2" />
                      Manajemen User
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRolesOpen(true)}>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Manajemen Role
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStoresManageOpen(true)}>
                      <Building className="h-4 w-4 mr-2" />
                      Manajemen Cabang
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <User className="h-4 w-4 mr-2" />
                  Profil Saya
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Ganti Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={(open) => {
        setProfileOpen(open);
        if (open) {
          setEditUsername(user.username || "");
          setEditFullName(user.fullName || "");
          setEditEmail(user.email || "");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profil</DialogTitle>
            <DialogDescription>Ubah username dan nama Anda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 pb-4 border-b">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="text-lg font-medium">{user.fullName}</h4>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                value={editUsername} 
                onChange={(e) => setEditUsername(e.target.value)}
                disabled={!isOwner}
              />
              {!isOwner && <p className="text-xs text-muted-foreground">Username hanya bisa diubah oleh owner</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <Input 
                id="fullName" 
                value={editFullName} 
                onChange={(e) => setEditFullName(e.target.value)}
                disabled={!isOwner}
              />
              {!isOwner && <p className="text-xs text-muted-foreground">Nama hanya bisa diubah oleh owner</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email"
                value={editEmail} 
                onChange={(e) => setEditEmail(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setProfileOpen(false)}>Batal</Button>
            <Button onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti Password</DialogTitle>
            <DialogDescription>Masukkan password lama dan password baru Anda</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password Saat Ini</Label>
              <Input 
                id="currentPassword" 
                type="password"
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password Baru</Label>
              <Input 
                id="newPassword" 
                type="password"
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
              <Input 
                id="confirmPassword" 
                type="password"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Batal</Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? "Mengubah..." : "Ganti Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Global Management Dialogs */}
      <Dialog open={usersOpen} onOpenChange={setUsersOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manajemen User</DialogTitle>
          </DialogHeader>
          <UserManagement />
        </DialogContent>
      </Dialog>

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manajemen Role</DialogTitle>
          </DialogHeader>
          <RoleManagement />
        </DialogContent>
      </Dialog>

      <Dialog open={storesManageOpen} onOpenChange={setStoresManageOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manajemen Cabang</DialogTitle>
          </DialogHeader>
          <StoreManagement />
        </DialogContent>
      </Dialog>
    </>
  );
}
