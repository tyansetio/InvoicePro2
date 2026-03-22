import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useStore } from "@/lib/store-context";

interface InvoiceStatusSummary {
  paid: number;
  pending: number;
  overdue: number;
}

export function InvoiceStatusChart() {
  const { currentStoreId } = useStore();
  const { data, isLoading, error } = useQuery<InvoiceStatusSummary>({
    queryKey: [`/api/stores/${currentStoreId}/dashboard/invoice-status`],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <Skeleton className="h-8 w-40" />
          </div>
          <div className="flex justify-center mb-5">
            <Skeleton className="h-44 w-44 rounded-full" />
          </div>
          <div className="space-y-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900">Invoice Status</h3>
          </div>
          <div className="flex justify-center items-center h-44">
            <p className="text-gray-500">Failed to load invoice data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = (data.paid || 0) + (data.pending || 0) + (data.overdue || 0);

  const pieData = [
    { name: 'Paid', value: data.paid || 0, color: '#10B981' },
    { name: 'Pending', value: data.pending || 0, color: '#F59E0B' },
    { name: 'Overdue', value: data.overdue || 0, color: '#DC2626' },
  ];

  const calculatePercentage = (value: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Invoice Status</h3>
        </div>
        
        <div className="flex justify-center mb-5">
          <div className="relative w-44 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold text-gray-700">{total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
              <span className="text-sm text-gray-700">Paid</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">{data.paid}</span>
              <span className="text-xs text-gray-500">({calculatePercentage(data.paid)}%)</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-amber-500 mr-2"></span>
              <span className="text-sm text-gray-700">Pending</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">{data.pending}</span>
              <span className="text-xs text-gray-500">({calculatePercentage(data.pending)}%)</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-red-600 mr-2"></span>
              <span className="text-sm text-gray-700">Overdue</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">{data.overdue}</span>
              <span className="text-xs text-gray-500">({calculatePercentage(data.overdue)}%)</span>
            </div>
          </div>
        </div>
        
        <div className="mt-5 pt-5 border-t border-gray-200">
          <Link href="/invoices" className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80">
            <span>View all invoices</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
