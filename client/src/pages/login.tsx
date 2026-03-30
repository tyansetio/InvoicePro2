import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Building2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

interface CompanySettings {
  companyName: string;
  logoUrl: string | null;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    companyName: "Mitra Indo Aluminium",
    logoUrl: null,
  });
  const { toast } = useToast();

  // Fetch company settings on mount
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const res = await fetch("/api/company-settings");
        if (res.ok) {
          const data = await res.json();
          setCompanySettings({
            companyName: data.companyName || "Mitra Indo Aluminium",
            logoUrl: data.logoUrl || null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch company settings:", error);
      }
    };
    fetchCompanySettings();
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/auth/login", data);

      if (res.ok) {
        const userData = await res.json();
        toast({
          title: "Login Berhasil",
          description: `Selamat datang, ${userData.fullName}!`,
        });
        onLoginSuccess(userData);
      } else {
        const error = await res.json();
        toast({
          title: "Login Gagal",
          description: error.error || "Username atau password salah",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          {companySettings.logoUrl ? (
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 overflow-hidden border">
              <img
                src={companySettings.logoUrl}
                alt="Company Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement!.innerHTML =
                    '<div class="w-full h-full bg-primary flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-foreground"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></div>';
                }}
              />
            </div>
          ) : (
            <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
          )}
          <CardTitle className="text-2xl font-bold">
            {companySettings.companyName}
          </CardTitle>
          <CardDescription>
            Masuk ke akun Anda untuk melanjutkan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan username"
                        {...field}
                        autoComplete="username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Masukkan password"
                        {...field}
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <LogIn className="h-4 w-4 mr-2" />
                )}
                {isLoading ? "Memproses..." : "Masuk"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
