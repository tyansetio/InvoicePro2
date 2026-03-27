import { useState, useEffect } from "react";
import { logPrint } from "@/lib/activity-log";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, MapPin, Package, Filter, Check, Navigation, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { DeliveryNote, Invoice, Client, DeliveryNoteItem, InvoiceItem, Product, Category } from "@shared/schema";
import { useStore } from '@/lib/store-context';

const STORAGE_KEY = "delivery_planning_categories";

type DeliveryNoteWithDetails = DeliveryNote & { 
  invoice: Invoice & { client: Client | null };
  itemCount: number;
};

type DeliveryNoteWithItems = {
  deliveryNote: DeliveryNote;
  items: (DeliveryNoteItem & { 
    invoiceItem: InvoiceItem & { product: Product } 
  })[];
};

type GroupedItem = {
  productName: string;
  categoryName: string;
  categoryId: number;
  quantity: string;
  description: string;
};

type ClientDelivery = {
  clientName: string;
  clientAddress: string;
  deliveryAddress: string;
  addressLink: string | null;
  deliveryNotes: {
    deliveryNumber: string;
    invoiceNumber: string;
    items: GroupedItem[];
  }[];
};

export default function DeliveryPlanningPage() {
  const { currentStoreId } = useStore();

  const [, navigate] = useLocation();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [routeLink, setRouteLink] = useState("");
  const { toast } = useToast();

  const { data: allPendingNotes, isLoading } = useQuery<DeliveryNoteWithDetails[]>({
    queryKey: [`/api/stores/${currentStoreId}/delivery-notes`, 'pending'],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${currentStoreId}/delivery-notes?status=pending`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch delivery notes');
      return res.json();
    }
  });

  const deliveryNotes = allPendingNotes?.filter(n => n.deliveryType !== 'self_pickup');

  const { data: categories } = useQuery<Category[]>({
    queryKey: [`/api/stores/${currentStoreId}/categories`]
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const ids = JSON.parse(saved) as number[];
        setSelectedCategoryIds(new Set(ids));
      } catch (e) {
        console.error('Failed to parse saved categories:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedCategoryIds.size > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedCategoryIds)));
    }
  }, [selectedCategoryIds]);

  const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (!deliveryNotes) return;
    if (selectedIds.size === deliveryNotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deliveryNotes.map(n => n.id)));
    }
  };

  const toggleCategorySelection = (categoryId: number) => {
    const newSet = new Set(selectedCategoryIds);
    if (newSet.has(categoryId)) {
      newSet.delete(categoryId);
    } else {
      newSet.add(categoryId);
    }
    setSelectedCategoryIds(newSet);
  };

  const selectAllCategories = () => {
    if (categories) {
      setSelectedCategoryIds(new Set(categories.map(c => c.id)));
    }
  };

  const clearCategorySelection = () => {
    setSelectedCategoryIds(new Set());
    localStorage.removeItem(STORAGE_KEY);
  };

  const getDeliveryAddress = (note: DeliveryNoteWithDetails) => {
    if (note.invoice?.deliveryAddress) {
      return note.invoice.deliveryAddress;
    }
    return note.invoice?.client?.address || '-';
  };

  const getAddressLink = (note: DeliveryNoteWithDetails) => {
    if (note.invoice?.deliveryAddressLink) {
      return note.invoice.deliveryAddressLink;
    }
    return note.invoice?.client?.addressLink || null;
  };

  const generateGoogleMapsRoute = () => {
    if (selectedIds.size === 0 || !deliveryNotes) {
      toast({
        title: "Error",
        description: "Pilih minimal satu surat jalan untuk membuat rute",
        variant: "destructive"
      });
      return;
    }

    const selectedNotes = deliveryNotes.filter(n => selectedIds.has(n.id));
    
    const uniqueDestinations = new Map<string, { address: string; link: string | null }>();
    selectedNotes.forEach(note => {
      const address = getDeliveryAddress(note);
      const link = getAddressLink(note);
      if (!uniqueDestinations.has(address)) {
        uniqueDestinations.set(address, { address, link });
      }
    });

    const destinations = Array.from(uniqueDestinations.values());
    
    if (destinations.length === 0) {
      toast({
        title: "Error",
        description: "Tidak ada alamat pengiriman yang valid",
        variant: "destructive"
      });
      return;
    }

    let mapsUrl: string;
    
    if (destinations.length === 1) {
      const dest = destinations[0];
      if (dest.link) {
        mapsUrl = dest.link;
      } else {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest.address)}`;
      }
    } else {
      const waypoints = destinations.map(d => {
        if (d.link) {
          const coordMatch = d.link.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
          if (coordMatch) {
            return `${coordMatch[1]},${coordMatch[2]}`;
          }
          const placeMatch = d.link.match(/place\/([^/@]+)/);
          if (placeMatch) {
            return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
          }
        }
        return d.address;
      });

      const origin = waypoints[0];
      const destination = waypoints[waypoints.length - 1];
      const waypointsList = waypoints.slice(1, -1);

      if (waypointsList.length > 0) {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypointsList.join('|'))}&travelmode=driving`;
      } else {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      }
    }

    setRouteLink(mapsUrl);
    setRouteDialogOpen(true);
  };

  const copyRouteLink = async () => {
    try {
      await navigator.clipboard.writeText(routeLink);
      toast({
        title: "Berhasil",
        description: "Link rute berhasil disalin"
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Gagal menyalin link",
        variant: "destructive"
      });
    }
  };

  const openRouteInNewTab = () => {
    window.open(routeLink, '_blank');
  };

  const handlePrint = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Error",
        description: "Pilih minimal satu surat jalan untuk dicetak",
        variant: "destructive"
      });
      return;
    }

    try {
      const promises = Array.from(selectedIds).map(id => 
        fetch(`/api/delivery-notes/${id}`, { credentials: 'include' }).then(res => res.json())
      );
      const selectedNotesDetails: DeliveryNoteWithItems[] = await Promise.all(promises);

      const hasActiveCategoryFilter = selectedCategoryIds.size > 0;

      const clientMap = new Map<string, ClientDelivery>();

      selectedNotesDetails.forEach((detail) => {
        const noteInfo = deliveryNotes?.find(n => n.id === detail.deliveryNote.id);
        if (!noteInfo) return;

        const clientName = noteInfo.invoice?.client?.name || 'Unknown Client';
        const clientAddress = noteInfo.invoice?.client?.address || '-';
        const deliveryAddress = getDeliveryAddress(noteInfo);
        const addressLink = getAddressLink(noteInfo);
        const key = `${clientName}-${deliveryAddress}`;

        if (!clientMap.has(key)) {
          clientMap.set(key, {
            clientName,
            clientAddress,
            deliveryAddress,
            addressLink,
            deliveryNotes: []
          });
        }

        const items: GroupedItem[] = detail.items.map(item => ({
          productName: item.invoiceItem.product?.name || item.invoiceItem.description,
          categoryName: categoryMap.get(item.invoiceItem.product?.categoryId || 0) || 'Other',
          categoryId: item.invoiceItem.product?.categoryId || 0,
          quantity: item.deliveredQuantity,
          description: item.invoiceItem.description
        }));

        clientMap.get(key)!.deliveryNotes.push({
          deliveryNumber: detail.deliveryNote.deliveryNumber,
          invoiceNumber: noteInfo.invoice?.invoiceNumber || '-',
          items
        });
      });

      const allClientDeliveries = Array.from(clientMap.values());

      const filteredClientDeliveries = allClientDeliveries.map(client => ({
        ...client,
        deliveryNotes: client.deliveryNotes.map(dn => ({
          ...dn,
          items: hasActiveCategoryFilter ? dn.items.filter(item => selectedCategoryIds.has(item.categoryId)) : dn.items
        })).filter(dn => dn.items.length > 0)
      })).filter(client => client.deliveryNotes.length > 0);

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Daftar Pengiriman</title>
          <style>
            @page { size: A4; margin: 12mm 15mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 10px; 
              line-height: 1.35;
            }
            h1 { font-size: 16px; text-align: center; margin-bottom: 10px; }
            .section-title {
              font-weight: bold;
              font-size: 11px;
              background: #000;
              color: #fff;
              padding: 3px 8px;
              margin-bottom: 8px;
            }
            .destination-list {
              margin-bottom: 12px;
            }
            .dest-item {
              display: flex;
              gap: 6px;
              margin-bottom: 4px;
              padding: 3px 0;
              border-bottom: 1px dotted #ccc;
            }
            .dest-num {
              font-weight: bold;
              min-width: 18px;
            }
            .dest-name { font-weight: bold; }
            .dest-addr { color: #444; font-size: 9px; }
            .dest-dn { color: #888; font-size: 8px; }
            .two-col {
              column-count: 2;
              column-gap: 20px;
            }
            .cat-block {
              break-inside: avoid;
              margin-bottom: 10px;
            }
            .cat-title {
              font-weight: bold;
              font-size: 11px;
              background: #e8e8e8;
              padding: 2px 6px;
              margin-bottom: 4px;
              border-left: 3px solid #000;
            }
            .cat-client {
              margin-bottom: 6px;
              padding-left: 4px;
              break-inside: avoid;
            }
            .cat-client-name {
              font-weight: bold;
              font-size: 10px;
              margin-bottom: 2px;
            }
            .cat-items {
              list-style: none;
              padding-left: 8px;
            }
            .cat-items li {
              margin-bottom: 1px;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .checkbox {
              display: inline-block;
              width: 10px;
              height: 10px;
              border: 1px solid #333;
              flex-shrink: 0;
            }
            .qty {
              font-weight: bold;
              min-width: 30px;
            }
            .summary {
              margin-top: 12px;
              padding-top: 8px;
              border-top: 2px solid #000;
            }
            .summary-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 10px;
            }
            .summary-item {
              background: #f0f0f0;
              padding: 4px 10px;
              border-radius: 3px;
            }
            .summary-cat { font-size: 9px; color: #666; }
            .summary-count { font-size: 13px; font-weight: bold; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>DAFTAR PENGIRIMAN</h1>

          <div class="destination-list">
            <div class="section-title">DAFTAR TUJUAN PENGIRIMAN</div>
            ${allClientDeliveries.map((client, idx) => `
              <div class="dest-item">
                <span class="dest-num">${idx + 1}.</span>
                <div>
                  <span class="dest-name">${client.clientName}</span>
                  <span class="dest-dn">(${client.deliveryNotes.map(dn => dn.deliveryNumber).join(', ')})</span>
                  <div class="dest-addr">${client.deliveryAddress}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="section-title">DETAIL BARANG</div>
          <div class="two-col">
            ${(() => {
              return filteredClientDeliveries.map(client => {
                const groupedByCategory = new Map<string, GroupedItem[]>();
                client.deliveryNotes.forEach(dn => {
                  dn.items.forEach(item => {
                    if (!groupedByCategory.has(item.categoryName)) {
                      groupedByCategory.set(item.categoryName, []);
                    }
                    groupedByCategory.get(item.categoryName)!.push(item);
                  });
                });
                const sortedCats = Array.from(groupedByCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                let html = '<div class="cat-block">';
                html += '<div class="cat-title">' + client.clientName + '</div>';
                sortedCats.forEach(([catName, items]) => {
                  html += '<div class="cat-client">';
                  html += '<div class="cat-client-name">' + catName + '</div>';
                  html += '<ul class="cat-items">';
                  items.forEach(item => {
                    html += '<li><span class="checkbox"></span> <span class="qty">' + item.quantity + '</span> ' + item.description + '</li>';
                  });
                  html += '</ul></div>';
                });
                html += '</div>';
                return html;
              }).join('');
            })()}
          </div>

          <div class="summary">
            <div class="section-title" style="margin-bottom: 6px;">RINGKASAN</div>
            <div class="summary-grid">
              ${(() => {
                const categoryTotals = new Map<string, number>();
                filteredClientDeliveries.forEach(client => {
                  client.deliveryNotes.forEach(dn => {
                    dn.items.forEach(item => {
                      const current = categoryTotals.get(item.categoryName) || 0;
                      categoryTotals.set(item.categoryName, current + parseFloat(item.quantity));
                    });
                  });
                });
                return Array.from(categoryTotals.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, total]) => 
                  '<div class="summary-item"><div class="summary-cat">' + cat + '</div><div class="summary-count">' + total + ' pcs</div></div>'
                ).join('');
              })()}
            </div>
          </div>
        </body>
        </html>
      `;

      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.top = '-10000px';
      printFrame.style.left = '-10000px';
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(printContent);
        frameDoc.close();

        printFrame.onload = async () => {
          try {
            const images = Array.from(printFrame.contentDocument?.images || []);
            await Promise.all(images.map(img => {
              if (img.complete) return Promise.resolve();
              return new Promise<void>(resolve => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 3000);
              });
            }));
            logPrint('planning', null, 'Daftar Pengiriman', `Mencetak daftar pengiriman (${selectedIds.size} surat jalan)`);
            printFrame.contentWindow?.print();
          } catch (e) {
            console.error('Print failed:', e);
          }
          setTimeout(() => {
            if (printFrame.parentNode) {
              document.body.removeChild(printFrame);
            }
          }, 2000);
        };
      } else {
        document.body.removeChild(printFrame);
        toast({
          title: "Error",
          description: "Tidak dapat membuka jendela cetak",
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal memuat data surat jalan",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/delivery-notes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Buat Daftar Pengiriman</h1>
          <p className="text-muted-foreground">Pilih surat jalan untuk membuat daftar pengiriman A4</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Surat Jalan Pending</CardTitle>
              <CardDescription>
                Pilih surat jalan yang akan disertakan dalam daftar pengiriman
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[220px] justify-start">
                    <Filter className="h-4 w-4 mr-2" />
                    {selectedCategoryIds.size === 0 
                      ? "Pilih Kategori" 
                      : `${selectedCategoryIds.size} kategori dipilih`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-2" align="end">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm font-medium">Filter Kategori</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllCategories}>
                          Semua
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearCategorySelection}>
                          Hapus
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
                      {categories?.map(cat => (
                        <div
                          key={cat.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                          onClick={() => toggleCategorySelection(cat.id)}
                        >
                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                            selectedCategoryIds.has(cat.id) ? 'bg-primary border-primary' : 'border-input'
                          }`}>
                            {selectedCategoryIds.has(cat.id) && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <span className="text-sm">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                    {selectedCategoryIds.size > 0 && (
                      <div className="pt-2 border-t text-xs text-muted-foreground">
                        Pilihan akan tersimpan sebagai default
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button 
                variant="outline"
                onClick={generateGoogleMapsRoute} 
                disabled={selectedIds.size === 0}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Generate Route
              </Button>
              <Button 
                onClick={handlePrint} 
                disabled={selectedIds.size === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Daftar Pengiriman ({selectedIds.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : deliveryNotes && deliveryNotes.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox 
                  checked={selectedIds.size === deliveryNotes.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Pilih Semua ({deliveryNotes.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {deliveryNotes.map((note) => (
                  <div 
                    key={note.id} 
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedIds.has(note.id) ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                    onClick={() => toggleSelection(note.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedIds.has(note.id)}
                        onCheckedChange={() => toggleSelection(note.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{note.deliveryNumber}</span>
                          <Badge variant="outline">{note.itemCount} item</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {note.invoice?.client?.name || '-'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{getDeliveryAddress(note)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada surat jalan pending</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              Google Maps Route
            </DialogTitle>
            <DialogDescription>
              Link rute pengiriman berdasarkan titik-titik yang dipilih
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={routeLink} 
                readOnly 
                className="flex-1 text-sm"
              />
              <Button variant="outline" size="icon" onClick={copyRouteLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRouteDialogOpen(false)}>
                Tutup
              </Button>
              <Button onClick={openRouteInNewTab}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Buka di Google Maps
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
