import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductUnit {
  id: number;
  productId: number;
  unitCode: string;
  unitLabel: string;
  conversionFactor: string;
  price: string | null;
  isDefault: boolean;
}

interface Product {
  id: number;
  name: string;
  description: string;
  currentSellingPrice: string;
  lowestPrice?: string | null;
  productType?: 'standard' | 'bundle';
  unit?: string; // Base unit from database (pcs, kg, meter, etc.)
  currentStock?: number;
  reservedQty?: number;
  availableStock?: number;
}

interface QuotationItem {
  id?: number;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate?: string;
  subtotal?: string;
  taxAmount?: string;
  totalAmount?: string;
  productId: number | null;
  productUnitId?: number | null;
}

interface QuotationItemRowProps {
  index: number;
  item: QuotationItem;
  products: Product[];
  onUpdate: (index: number, item: QuotationItem) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  canOverrideLowestPrice?: boolean;
  onPriceValidationChange?: (index: number, isValid: boolean) => void;
}

export function QuotationItemRow({ 
  index, 
  item, 
  products, 
  onUpdate, 
  onRemove,
  canRemove,
  canOverrideLowestPrice = true,
  onPriceValidationChange
}: QuotationItemRowProps) {
  const [description, setDescription] = useState(item.description || "");
  const [quantity, setQuantity] = useState(item.quantity || "1");
  const [unitPrice, setUnitPrice] = useState(item.unitPrice || "0");
  const [taxRate, setTaxRate] = useState(item.taxRate || "0");
  const [productId, setProductId] = useState<string>(item.productId?.toString() || "");
  const [productUnitId, setProductUnitId] = useState<string>(item.productUnitId?.toString() || "");
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [open, setOpen] = useState(false);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);

  const itemRef = useRef(item);
  const onUpdateRef = useRef(onUpdate);
  const lastSentKeyRef = useRef("");
  const isMountedRef = useRef(false);

  useEffect(() => {
    itemRef.current = item;
  }, [item]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const makeItemKey = (data: { unitPrice: string; quantity: string; description: string; taxRate?: string; productId?: number | string | null; productUnitId?: number | string | null }) => {
    return JSON.stringify({
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      taxRate: data.taxRate || "0",
      productId: data.productId?.toString() || "",
      productUnitId: data.productUnitId?.toString() || ""
    });
  };

  // Sync state when item prop changes from EXTERNAL source (e.g., loading from API)
  // Skip if the incoming item matches what we last sent to parent
  useEffect(() => {
    const incomingKey = makeItemKey({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      description: item.description,
      taxRate: item.taxRate,
      productId: item.productId,
      productUnitId: item.productUnitId
    });
    if (incomingKey === lastSentKeyRef.current) return;
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setDescription(item.description || "");
    setQuantity(item.quantity || "1");
    setUnitPrice(item.unitPrice || "0");
    setTaxRate(item.taxRate || "0");
    setProductId(item.productId?.toString() || "");
    setProductUnitId(item.productUnitId?.toString() || "");
  }, [item.id, item.description, item.quantity, item.unitPrice, item.taxRate, item.productId, item.productUnitId]);

  const lastFetchedProductIdRef = useRef<string>("");

  // Fetch product units when product changes and sync lowestPrice
  useEffect(() => {
    if (productId && productId !== "0") {
      // Skip fetch if we already fetched for this productId
      if (lastFetchedProductIdRef.current === productId) return;
      lastFetchedProductIdRef.current = productId;

      fetch(`/api/products/${productId}/units`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(units => setProductUnits(units || []))
        .catch(() => setProductUnits([]));
      const prod = products.find(p => p.id.toString() === productId);
      if (prod) {
        setLowestPrice(prod.lowestPrice ? parseFloat(prod.lowestPrice) : null);
      }
    } else {
      lastFetchedProductIdRef.current = "";
      setProductUnits([]);
      setProductUnitId("");
      setLowestPrice(null);
    }
  }, [productId]);

  // Notify parent whether price passes lowest price validation
  useEffect(() => {
    if (!onPriceValidationChange) return;
    const priceNum = parseFloat(unitPrice) || 0;
    const isBelowLowest = lowestPrice !== null && priceNum > 0 && priceNum < lowestPrice;
    const isInvalid = isBelowLowest && !canOverrideLowestPrice;
    onPriceValidationChange(index, !isInvalid);
  }, [unitPrice, lowestPrice, canOverrideLowestPrice, index, onPriceValidationChange]);

  // Handle unit selection
  const handleUnitChange = (unitId: string) => {
    setProductUnitId(unitId === "base" ? "" : unitId);
    const selectedProduct = products.find(p => p.id.toString() === productId);
    
    if (unitId && unitId !== "base") {
      const selectedUnit = productUnits.find(u => u.id.toString() === unitId);
      if (selectedUnit) {
        const newPrice = selectedUnit.price || unitPrice;
        setUnitPrice(newPrice);
      }
    } else {
      const basePrice = selectedProduct?.currentSellingPrice || unitPrice;
      setUnitPrice(basePrice);
    }
  };

  // Calculate totals when inputs change and push to parent
  useEffect(() => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    const rate = parseFloat(taxRate) || 0;
    
    const subtotal = qty * price;
    const taxAmount = (subtotal * rate / 100);
    const totalAmount = subtotal + taxAmount;
    
    const updatedItem: QuotationItem = {
      id: itemRef.current.id,
      description,
      quantity,
      unitPrice,
      taxRate,
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      productId: productId && productId !== "0" ? parseInt(productId) : null,
      productUnitId: productUnitId && productUnitId !== "" ? parseInt(productUnitId) : null
    };
    
    const newKey = makeItemKey(updatedItem);
    if (newKey === lastSentKeyRef.current) return;
    lastSentKeyRef.current = newKey;
    onUpdateRef.current(index, updatedItem);
  }, [description, quantity, unitPrice, taxRate, productId, productUnitId, index]);
  
  // Handle product selection
  const handleProductChange = (value: string) => {
    setProductId(value);
    setProductUnitId(""); // Reset unit when product changes
    
    if (value && value !== "0") {
      const selectedProduct = products.find(p => p.id.toString() === value);
      if (selectedProduct) {
        setDescription(selectedProduct.name);
        setUnitPrice(selectedProduct.currentSellingPrice || "0");
        setLowestPrice(selectedProduct.lowestPrice ? parseFloat(selectedProduct.lowestPrice) : null);
      }
    } else {
      // Reset description when switching to manual entry
      setDescription("");
      setUnitPrice("0");
      setLowestPrice(null);
    }
  };

  const selectedProductName = productId && productId !== "0" 
    ? products.find(product => product.id.toString() === productId)?.name || description || "Enter manually"
    : "Select a product";

  return (
    <div className={cn(
      "grid grid-cols-12 gap-2 p-4 border rounded-lg",
      index % 2 === 0 ? "bg-white" : "bg-gray-50"
    )} data-testid={`quotation-item-row-${index}`}>
      {/* Product Selection */}
      <div className="col-span-12 md:col-span-4">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Product
        </label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between text-sm"
              data-testid={`button-select-product-${index}`}
            >
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="truncate text-left">
                  {selectedProductName}
                </span>
                {productId && productId !== "0" && (() => {
                  const selectedProduct = products.find(p => p.id.toString() === productId);
                  const stock = selectedProduct?.currentStock ?? 0;
                  return (
                    <span className={cn(
                      "text-xs ml-1 whitespace-nowrap",
                      stock === 0 ? "text-red-500" :
                      stock <= 5 ? "text-orange-500" : "text-gray-500"
                    )}>
                      [{stock}]
                    </span>
                  );
                })()}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[450px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search product..." className="h-9" />
              <CommandEmpty>No product found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="manual"
                  onSelect={() => {
                    handleProductChange("0");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      productId === "0" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  Enter manually
                </CommandItem>
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => {
                      handleProductChange(product.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        productId === product.id.toString() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-1">
                        <span>{product.name}</span>
                        {product.productType === 'bundle' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                            BUNDLE
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs ml-2",
                        (product.availableStock ?? product.currentStock ?? 0) === 0 ? "text-red-500" :
                        (product.availableStock ?? product.currentStock ?? 0) <= 5 ? "text-orange-500" : "text-gray-500"
                      )}>
                        Tersedia: {product.availableStock ?? product.currentStock ?? 0}
                        {(product.reservedQty ?? 0) > 0 && (
                          <span className="text-gray-400 ml-1">(Rsv: {product.reservedQty})</span>
                        )}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Unit Selection */}
      <div className="col-span-6 md:col-span-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Unit
        </label>
        {productUnits.length > 0 ? (
          <Select value={productUnitId || "base"} onValueChange={handleUnitChange}>
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">
                {products.find(p => p.id.toString() === productId)?.unit || "pcs"}
              </SelectItem>
              {productUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id.toString()}>
                  {unit.unitLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50">
            <span className="text-sm text-gray-500">
              {products.find(p => p.id.toString() === productId)?.unit || "pcs"}
            </span>
          </div>
        )}
      </div>

      {/* Quantity */}
      <div className="col-span-6 md:col-span-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Qty
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          placeholder="1"
          value={(() => {
            const num = parseFloat(quantity) || 0;
            return Number.isInteger(num) ? String(num) : quantity;
          })()}
          onChange={(e) => setQuantity(e.target.value)}
          onBlur={(e) => {
            const num = parseFloat(e.target.value) || 1;
            if (Number.isInteger(num)) {
              setQuantity(String(num));
            }
          }}
          className="text-center font-medium"
          data-testid={`input-quantity-${index}`}
        />
      </div>

      {/* Unit Price */}
      <div className="col-span-6 md:col-span-2">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Unit Price
        </label>
        {(() => {
          const priceNum = parseFloat(unitPrice) || 0;
          const isBelowLowest = lowestPrice !== null && priceNum > 0 && priceNum < lowestPrice;
          const isBlocking = isBelowLowest && !canOverrideLowestPrice;
          const isWarning = isBelowLowest && canOverrideLowestPrice;
          return (
            <>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className={cn(
                  "w-full",
                  isBlocking && "border-red-500 focus-visible:ring-red-500",
                  isWarning && "border-yellow-400 focus-visible:ring-yellow-400"
                )}
                data-testid={`input-unit-price-${index}`}
              />
              {isBlocking && (
                <p className="text-red-600 text-xs mt-1">
                  Min: {formatCurrency(lowestPrice!.toString())}. Tidak ada izin.
                </p>
              )}
              {isWarning && (
                <p className="text-yellow-600 text-xs mt-1">
                  Di bawah min: {formatCurrency(lowestPrice!.toString())}
                </p>
              )}
            </>
          );
        })()}
      </div>

      {/* Total */}
      <div className="col-span-6 md:col-span-2">
        <label className="text-sm font-medium text-gray-700 mb-1 block">
          Total
        </label>
        <div className="flex items-center h-10 px-3 border rounded-md bg-gray-50">
          <span className="text-sm font-medium" data-testid={`text-total-${index}`}>
            {formatCurrency(parseFloat(item.totalAmount || "0"))}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="col-span-12 md:col-span-1">
        <label className="text-sm font-medium text-gray-700 mb-1 block opacity-0">
          Action
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          data-testid={`button-remove-item-${index}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}