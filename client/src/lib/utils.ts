import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(value)) return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(0);
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatDate(dateString: string): string {
  try {
    // Handle null or undefined
    if (!dateString) {
      return 'N/A';
    }
    
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', dateString);
      return dateString || 'Invalid Date';
    }
    
    return format(date, 'MMM dd, yyyy');
  } catch (error) {
    console.warn('Error formatting date:', error, 'Input:', dateString);
    return dateString || 'Invalid Date';
  }
}

export function generateInitials(name: string): string {
  if (!name) return "";
  
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export function getRandomColor(seed: string): string {
  // Simple hash function to generate a color based on a string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    "#4F46E5", // primary
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#06B6D4", // cyan
    "#14B8A6", // teal
  ];
  
  // Use the hash to select a color from our palette
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function calculateDueDate(date: Date, daysFromNow: number): Date {
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + daysFromNow);
  return dueDate;
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Format a number with a specific number of decimal places
export function formatNumber(value: string | number, decimalPlaces: number = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  return numValue.toFixed(decimalPlaces);
}

// Calculate invoice subtotal from line items
export function calculateSubtotal(items: { quantity: string; price: string }[]): number {
  return items.reduce((sum, item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    return sum + (quantity * price);
  }, 0);
}

// Calculate invoice tax from line items and tax rate
export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

// Calculate the total after tax and discount
export function calculateTotal(subtotal: number, tax: number, discount: number): number {
  return subtotal + tax - discount;
}

// Generate a new invoice number based on the last invoice
export function generateInvoiceNumber(lastInvoiceNumber: string): string {
  // Extract the numeric part
  const matches = lastInvoiceNumber.match(/(\d+)$/);
  if (!matches || !matches[1]) {
    return 'INV-2023-0001';
  }
  
  // Increment the number and pad with zeros
  const nextNumber = (parseInt(matches[1]) + 1).toString().padStart(4, '0');
  const prefix = lastInvoiceNumber.substring(0, lastInvoiceNumber.length - matches[1].length);
  
  return `${prefix}${nextNumber}`;
}

// Format currency in accounting style (right-aligned with Rp prefix)
export function formatCurrencyAccounting(amount: string | number): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(value)) return 'Rp 0';
  
  // Format with thousand separators (Indonesian style: dots)
  const formatted = Math.abs(value).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  // Return with Rp prefix, right-aligned style
  return `Rp ${formatted}`;
}

// Format quantity - hide decimals if it's a whole number
export function formatQuantity(qty: string | number): string {
  const value = typeof qty === 'string' ? parseFloat(qty) : qty;
  
  if (isNaN(value)) return '0';
  
  // Check if it's a whole number
  if (Number.isInteger(value)) {
    return value.toString();
  }
  
  // Show decimals only if there are decimal places
  return value.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}
