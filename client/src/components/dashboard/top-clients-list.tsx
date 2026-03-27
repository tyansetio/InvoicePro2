import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/lib/store-context";

interface TopClient {
  id: number;
  name: string;
  email: string;
  totalValue: number;
  invoiceCount: number;
  initials: string;
}

export function TopClientsList() {
  const { currentStoreId } = useStore();
  const { data, isLoading, error } = useQuery<TopClient[]>({
    queryKey: [`/api/stores/${currentStoreId}/dashboard/topclients`, { limit: 10 }],
    queryFn: async () => {
      const response = await fetch(`/api/stores/${currentStoreId}/dashboard/topclients?limit=10`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-6 w-20" />
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array(10).fill(0).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 p-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
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
        <CardHeader className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Top 10 Clients</CardTitle>
            <Link href="/clients" className="text-sm font-medium text-primary hover:text-primary/80">
              View All
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-64">
          <p className="text-gray-500">Failed to load client data</p>
        </CardContent>
      </Card>
    );
  }

  const leftColumn = data.slice(0, 5);
  const rightColumn = data.slice(5, 10);

  const ClientItem = ({ client, rank }: { client: TopClient; rank: number }) => (
    <div className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg">
      <div className={`
        flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold
        ${rank === 1 ? 'bg-yellow-100 text-yellow-700' : 
          rank === 2 ? 'bg-gray-100 text-gray-600' :
          rank === 3 ? 'bg-amber-100 text-amber-700' :
          'bg-gray-50 text-gray-500'}
      `}>
        {rank}
      </div>
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
        {client.initials}
      </div>
      <div className="flex-1 min-w-0">
        <Link 
          href={`/clients/${client.id}`}
          className="text-sm font-medium text-gray-900 hover:underline truncate block"
        >
          {client.name}
        </Link>
        <p className="text-xs text-gray-500">{client.invoiceCount} invoices</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-green-600">{formatCurrency(client.totalValue)}</p>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Top 10 Clients</CardTitle>
          <Link 
            href="/clients" 
            className="text-sm font-medium text-primary hover:text-primary/80"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
          <div className="space-y-1">
            {leftColumn.map((client, i) => (
              <ClientItem key={client.id} client={client} rank={i + 1} />
            ))}
          </div>
          <div className="space-y-1">
            {rightColumn.map((client, i) => (
              <ClientItem key={client.id} client={client} rank={i + 6} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
