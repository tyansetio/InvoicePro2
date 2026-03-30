import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { subDays, format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { CategorySalesChart } from "@/components/dashboard/category-sales-chart";
import { TopClientsList } from "@/components/dashboard/top-clients-list";
import { InventoryStatsCard } from "@/components/dashboard/inventory-stats-card";
import { LowStockProducts } from "@/components/dashboard/low-stock-products";
import { TopSellingProducts } from "@/components/dashboard/top-selling-products";
import { UnpaidSupplierBills } from "@/components/dashboard/unpaid-supplier-bills";
import { DeliveredUnpaidInvoices } from "@/components/dashboard/delivered-unpaid-invoices";
import { ProfitOverview } from "@/components/dashboard/profit-overview";
import { useStore } from '@/lib/store-context';


type DashboardStats = {
  totalRevenue: number;
  totalExpenses: number;
  openInvoices: {
    count: number;
    value: number;
  };
  totalClients: number;
  productsCount: number;
  lowStockCount: number;
};

export default function Dashboard() {
  const { currentStoreId } = useStore();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const queryDates = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return {
        start: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd'),
      };
    }
    return {
      start: format(dateRange.from, 'yyyy-MM-dd'),
      end: format(dateRange.to, 'yyyy-MM-dd'),
    };
  }, [dateRange]);
  
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: [`/api/stores/${currentStoreId}/dashboard/stats`, queryDates],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('start', queryDates.start);
      params.set('end', queryDates.end);
      
      const response = await fetch(`/api/stores/${currentStoreId}/dashboard/stats?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
  });
  
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <DateRangePicker
          date={dateRange}
          onDateChange={setDateRange}
          className="w-full sm:w-auto"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : error || !data ? (
          <div className="col-span-3">
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-gray-500">Failed to load dashboard statistics</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <StatsCard
              title="Total Income"
              value={data.totalRevenue}
            />
            
            <StatsCard
              title="Total Expenses"
              value={data.totalExpenses}
            />
            
            <StatsCard
              title="Net Balance"
              value={data.totalRevenue - data.totalExpenses}
            />
          </>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-5">
        <RevenueChart startDate={queryDates.start} endDate={queryDates.end} />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <ProfitOverview startDate={queryDates.start} endDate={queryDates.end} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <InventoryStatsCard />
        <LowStockProducts />
        <TopSellingProducts />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <CategorySalesChart />
      </div>
      
      <div className="grid grid-cols-1 gap-5">
        <TopClientsList />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UnpaidSupplierBills />
        <DeliveredUnpaidInvoices />
      </div>
    </div>
  );
}
