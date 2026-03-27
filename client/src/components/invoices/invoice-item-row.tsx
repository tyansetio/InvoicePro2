import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface InvoiceItem {
  id?: number;
  description: string;
  quantity: string;
  price: string;
  taxRate: string;
  subtotal: string;
  tax: string;
  total: string;
  productId: number | null;
  productUnitId?: number | null;
  selectedUnit?: ProductUnit | null;
}

interface InvoiceItemRowProps {
  index: number;
  item: InvoiceItem;
  products: Product[];
  updateItem: (index: number, item: InvoiceItem) => void;
  removeItem: (index: number) => void;
  onProductSelect: (index: number, productId: number | null, productUnitId?: number | null) => void;
  disabled?: boolean;
  canOverrideLowestPrice?: boolean;
  onPriceValidationChange?: (index: number, isValid: boolean) => void;
}

export function InvoiceItemRow({ 
  index, 
  item, 
  products, 
  updateItem, 
  removeItem,
  onProductSelect,
  disabled = false,
  canOverrideLowestPrice = true,
  onPriceValidationChange
}: InvoiceItemRowProps) {
  const [description, setDescription] = useState(item.description || "");
  const [quantity, setQuantity] = useState(item.quantity || "1");
  const [price, setPrice] = useState(item.price || "0");
  const [taxRate, setTaxRate] = useState(item.taxRate || "0");
  const [productId, setProductId] = useState<string>(item.productId?.toString() || "");
  const [productUnitId, setProductUnitId] = useState<string>(item.productUnitId?.toString() || "");
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  const itemRef = useRef(item);
  const updateItemRef = useRef(updateItem);
  const onProductSelectRef = useRef(onProductSelect);
  const lastSentKeyRef = useRef("");
  const isMountedRef = useRef(false);

  useEffect(() => {
    itemRef.current = item;
  }, [item]);
  useEffect(() => {
    updateItemRef.current = updateItem;
  }, [updateItem]);
  useEffect(() => {
    onProductSelectRef.current = onProductSelect;
  }, [onProductSelect]);

  const makeItemKey = (data: { price: string; quantity: string; description: string; taxRate: string; productId?: number | string | null; productUnitId?: number | string | null }) => {
    return JSON.stringify({
      description: data.description,
      quantity: data.quantity,
      price: data.price,
      taxRate: data.taxRate,
      productId: data.productId?.toString() || "",
      productUnitId: data.productUnitId?.toString() || ""
    });
  };

  // Sync local state when item prop changes from EXTERNAL source (e.g., loading from API)
  // Skip if the incoming item matches what we last sent to parent
  useEffect(() => {
    const incomingKey = makeItemKey({
      price: item.price,
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
    setPrice(item.price || "0");
    setTaxRate(item.taxRate || "0");
    setProductId(item.productId?.toString() || "");
    setProductUnitId(item.productUnitId?.toString() || "");
  }, [item.id, item.description, item.quantity, item.price, item.taxRate, item.productId, item.productUnitId]);

  const lastFetchedProductIdRef = useRef<string>("");

  // Fetch product units when product changes
  useEffect(() => {
    if (productId && productId !== "0") {
      // Skip fetch if we already fetched for this productId
      if (lastFetchedProductIdRef.current === productId) return;
      lastFetchedProductIdRef.current = productId;

      fetch(`/api/products/${productId}/units`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : [])
        .then(units => setProductUnits(units || []))
        .catch(() => setProductUnits([]));
      // Also sync lowestPrice when product changes externally
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
    const priceNum = parseFloat(price) || 0;
    const isBelowLowest = lowestPrice !== null && priceNum > 0 && priceNum < lowestPrice;
    const isInvalid = isBelowLowest && !canOverrideLowestPrice;
    onPriceValidationChange(index, !isInvalid);
  }, [price, lowestPrice, canOverrideLowestPrice, index, onPriceValidationChange]);

  // Define onUpdate to be used within handleProductChange for direct state updates
  const onUpdate = (idx: number, updatedItem: InvoiceItem) => {
    setProductId(updatedItem.productId?.toString() || "");
    setProductUnitId(updatedItem.productUnitId?.toString() || "");
    setDescription(updatedItem.description);
    setQuantity(updatedItem.quantity);
    setPrice(updatedItem.price);
    setTaxRate(updatedItem.taxRate);
    lastSentKeyRef.current = makeItemKey(updatedItem);
    updateItemRef.current(idx, updatedItem);
  };

  // Handle unit selection - only update local state; calc effect pushes to parent
  const handleUnitChange = (unitId: string) => {
    const newUnitId = unitId === "base" ? "" : unitId;
    setProductUnitId(newUnitId);
    const selectedProduct = products.find(p => p.id.toString() === productId);
    
    if (unitId && unitId !== "base") {
      const selectedUnit = productUnits.find(u => u.id.toString() === unitId);
      if (selectedUnit) {
        const newPrice = selectedUnit.price || price;
        setPrice(newPrice);
        itemRef.current = { ...itemRef.current, selectedUnit };
      }
    } else {
      const basePrice = selectedProduct?.currentSellingPrice || price;
      setPrice(basePrice);
      itemRef.current = { ...itemRef.current, selectedUnit: null };
    }
  };

  // Calculate totals when inputs change and push to parent
  useEffect(() => {
    const qty = parseFloat(quantity) || 0;
    const prc = parseFloat(price) || 0;
    const rate = parseFloat(taxRate) || 0;

    const subtotal = (qty * prc).toString();
    const tax = (parseFloat(subtotal) * rate / 100).toString();
    const total = (parseFloat(subtotal) + parseFloat(tax)).toString();

    const updatedItem: InvoiceItem = {
      id: itemRef.current.id,
      selectedUnit: itemRef.current.selectedUnit,
      description,
      quantity,
      price,
      taxRate,
      subtotal,
      tax,
      total,
      productId: productId && productId !== "0" ? parseInt(productId) : null,
      productUnitId: productUnitId && productUnitId !== "" ? parseInt(productUnitId) : null
    };

    const newKey = makeItemKey(updatedItem);
    if (newKey === lastSentKeyRef.current) return;
    lastSentKeyRef.current = newKey;
    updateItemRef.current(index, updatedItem);
  }, [description, quantity, price, taxRate, productId, productUnitId, index]);

  // Handle product selection
  const handleProductChange = (value: string) => {
    console.log('Selected product ID:', value);

    if (value === "0") {
      // Manual entry selected - clear all fields
      const clearedItem = {
        productId: 0,
        description: "",
        quantity: "1",
        price: "0",
        taxRate: "0",
        subtotal: "0",
        tax: "0",
        total: "0",
      };
      console.log('Clearing item at index', index);
      onUpdate(index, clearedItem);
    } else {
      const selectedProduct = products.find(p => p.id.toString() === value);
      console.log('Found product:', selectedProduct);

      if (selectedProduct) {
        // Calculate values based on current quantity
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(selectedProduct.currentSellingPrice || "0");
        const taxRate = 0; // Default tax rate, can be adjusted manually
        const subtotal = qty * price;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        // Track lowest price for this product
        const lp = selectedProduct.lowestPrice ? parseFloat(selectedProduct.lowestPrice) : null;
        setLowestPrice(lp);

        const updatedItem = {
          productId: selectedProduct.id,
          description: selectedProduct.name,
          quantity: item.quantity || "1",
          price: (selectedProduct.currentSellingPrice || "0"),
          taxRate: "0",
          subtotal: subtotal.toFixed(2),
          tax: tax.toFixed(2),
          total: total.toFixed(2),
        };
        console.log('Setting item at index', index, ':', updatedItem);
        onUpdate(index, updatedItem);
      }
    }
  };

  return (
    <tr className={index % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-blue-50"}>
      {/* Row number */}
      <td className="text-center text-sm text-gray-500">
        {index + 1}
      </td>

      {/* Product selection */}
      <td>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-full justify-between text-sm h-8 px-2 border border-transparent hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between w-full min-w-0">
                <span className="truncate text-left">
                  {productId && productId !== "0" 
                    ? products.find(product => product.id.toString() === productId)?.name || description || "Enter manually"
                    : description || "Select a product"}
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
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[450px] p-0" align="start">
            <Command
              ref={commandRef}
              onKeyDown={(e) => {
                const items = [{ id: "0", name: "Enter manually" }, ...products];

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex(prev => Math.max(prev - 1, -1));
                } else if (e.key === "Enter" && selectedIndex >= 0) {
                  e.preventDefault();
                  const selectedItem = items[selectedIndex];
                  if (selectedItem) {
                    handleProductChange(selectedItem.id.toString());
                    setOpen(false);
                    setSelectedIndex(-1);
                  }
                }
              }}
            >
              <CommandInput 
                placeholder="Search product..." 
                className="h-9"
                onFocus={() => setSelectedIndex(-1)}
              />
              <CommandEmpty>No product found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="manual"
                  className={cn(
                    selectedIndex === 0 && "bg-accent"
                  )}
                  onSelect={() => {
                    handleProductChange("0");
                    setOpen(false);
                    setSelectedIndex(-1);
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
                {products.map((product, idx) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    className={cn(
                      selectedIndex === idx + 1 && "bg-accent"
                    )}
                    onSelect={() => {
                      handleProductChange(product.id.toString());
                      setOpen(false);
                      setSelectedIndex(-1);
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
      </td>

      {/* Unit selection (only show if product has units) */}
      <td className="w-[65px]">
        {productUnits.length > 0 ? (
          <Select value={productUnitId || "base"} onValueChange={handleUnitChange} disabled={disabled}>
            <SelectTrigger className="h-8 text-sm" disabled={disabled}>
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
          <span className="text-xs text-gray-500 px-2">
            {productId ? (products.find(p => p.id.toString() === productId)?.unit || "pcs") : "-"}
          </span>
        )}
      </td>

      {/* Quantity */}
      <td className="min-w-[80px]">
        <Input
          type="number"
          min="1"
          step="1"
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
          className="excel-cell-input-right w-full text-center font-medium"
          disabled={disabled}
        />
      </td>

      {/* Price */}
      <td>
        {(() => {
          const priceNum = parseFloat(price) || 0;
          const isBelowLowest = lowestPrice !== null && priceNum > 0 && priceNum < lowestPrice;
          const isBlocking = isBelowLowest && !canOverrideLowestPrice;
          const isWarning = isBelowLowest && canOverrideLowestPrice;
          return (
            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-xs">Rp</span>
                </div>
                <Input
                  type="number"
                  min="0.00"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={cn(
                    "excel-cell-input-right pl-5 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
                    isBlocking && "border-red-500 focus-visible:ring-red-500",
                    isWarning && "border-yellow-400 focus-visible:ring-yellow-400"
                  )}
                  disabled={disabled}
                />
              </div>
              {isBlocking && (
                <p className="text-red-600 text-[10px] leading-tight mt-0.5 whitespace-nowrap">
                  Min: {formatCurrency(lowestPrice!.toString())}. Tidak ada izin.
                </p>
              )}
              {isWarning && (
                <p className="text-yellow-600 text-[10px] leading-tight mt-0.5 whitespace-nowrap">
                  Di bawah min: {formatCurrency(lowestPrice!.toString())}
                </p>
              )}
            </div>
          );
        })()}
      </td>

      {/* Total (subtotal) */}
      <td className="text-right text-sm font-medium text-gray-900 whitespace-nowrap">
        {formatCurrency(item.total || item.subtotal || "0")}
      </td>

      {/* Actions */}
      <td className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => removeItem(index)}
          disabled={disabled}
          className="text-gray-400 hover:text-red-600 p-1 h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete item</span>
        </Button>
      </td>
    </tr>
  );
}