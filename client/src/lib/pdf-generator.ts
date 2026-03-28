import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatCurrency } from "@/lib/utils";

// PDF-specific interface for invoice items
interface PDFInvoiceItem {
  id?: number;
  description: string;
  quantity: string;
  price: string;
  taxRate?: string;
  subtotal?: string;
  tax?: string;
  total?: string;
  productId?: number | null;
}

interface Client {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
}

interface Invoice {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  notes?: string;
  useFakturPajak?: boolean;
  taxRate?: string | number;
  deliveryAddress?: string;
  deliveryAddressLink?: string;
}

interface PDFData {
  invoice: Invoice;
  items: PDFInvoiceItem[];
  client: Client;
  company?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
    tagline?: string;
  };
  defaultNotes?: string;
}

export async function generatePDF(data: PDFData) {
  console.log("Starting PDF generation with data:", data);
  
  try {
    const { invoice, items, client } = data;
    
    // Create a new PDF document
    const doc = new jsPDF();
    
    // Add fonts
    doc.setFont("helvetica", "normal");
    
    // Set company info
    doc.setFontSize(24);
    doc.setTextColor(79, 70, 229); // primary color
    doc.text(data.company?.name || "AluminumManager", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(data.company?.address || "123 Main Street", 20, 30);
    
    let infoY = 35;
    if (data.company?.phone) {
      doc.text(`Phone: ${data.company.phone}`, 20, infoY);
      infoY += 5;
    }
    if (data.company?.email) {
      doc.text(`Email: ${data.company.email}`, 20, infoY);
      infoY += 5;
    }
    
    // Add invoice title and number
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(`INVOICE: ${invoice.invoiceNumber}`, 140, 20);
    
    // Add invoice status
    doc.setFontSize(12);
    
    let statusColor;
    switch (invoice.status) {
      case "paid":
        statusColor = [16, 185, 129]; // green
        break;
      case "sent":
        statusColor = [245, 158, 11]; // amber
        break;
      case "overdue":
        statusColor = [220, 38, 38]; // red
        break;
      default:
        statusColor = [100, 100, 100]; // gray
    }
    
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    
    // Capitalize first letter of status
    const statusText = invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1);
    doc.text(`Status: ${statusText}`, 140, 30);
    
    // Reset text color to black
    doc.setTextColor(0, 0, 0);
    
    // Add invoice dates
    doc.setFontSize(10);
    doc.text(`Issue Date: ${invoice.issueDate}`, 140, 40);
    doc.text(`Due Date: ${invoice.dueDate}`, 140, 45);
    
    // Add a separator line
    doc.setLineWidth(0.5);
    doc.setDrawColor(230, 230, 230);
    doc.line(20, 55, 190, 55);
    
    // Add bill to section
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, 65);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(client.name, 20, 75);
    doc.text(client.email, 20, 80);
    
    let yPosition = 85;
    
    if (client.phone) {
      doc.text(client.phone, 20, yPosition);
      yPosition += 5;
    }
    
    if (client.address) {
      const addressLines = client.address.split("\n");
      addressLines.forEach(line => {
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
    }
    
    if (client.taxNumber) {
      doc.text(`Tax Number: ${client.taxNumber}`, 20, yPosition);
      yPosition += 5;
    }
    
    // Add delivery address if different from client address
    if (invoice.deliveryAddress) {
      yPosition += 3;
      doc.setFont("helvetica", "bold");
      doc.text("Alamat Pengiriman:", 20, yPosition);
      doc.setFont("helvetica", "normal");
      yPosition += 5;
      const deliveryAddressLines = invoice.deliveryAddress.split("\n");
      deliveryAddressLines.forEach(line => {
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
    }
    
    // Add invoice items table
    const tableData = items.map(item => [
      item.description,
      item.quantity,
      formatCurrency(item.price),
      `${item.taxRate || '0'}%`,
      formatCurrency(item.total?.toString() || '0')
    ]);
    
    autoTable(doc, {
      startY: 110,
      head: [["Description", "Quantity", "Unit Price", "Tax Rate", "Total"]],
      body: tableData,
      theme: "striped",
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [79, 70, 229], // primary color
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      }
    });
    
    // Add totals
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Summary box
    const boxX = 120;
    const boxWidth = 70;
    const useFakturPajak = invoice.useFakturPajak || false;
    const taxRate = typeof invoice.taxRate === 'string' ? parseFloat(invoice.taxRate) : (invoice.taxRate || 11);
    
    // Calculate box height based on content
    let boxHeight = 40;
    if (useFakturPajak && parseFloat(invoice.tax) > 0) {
      boxHeight = 50; // More space for DPP + PPN
    }
    if (parseFloat(invoice.discount) > 0) {
      boxHeight += 10;
    }
    
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(boxX, finalY, boxWidth, boxHeight, 2, 2, 'FD');
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    let yOffset = 10;
    
    if (useFakturPajak && parseFloat(invoice.tax) > 0) {
      // DPP (Base Price) - when faktur pajak is active
      doc.text("DPP:", boxX + 5, finalY + yOffset);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(invoice.subtotal), boxX + boxWidth - 5, finalY + yOffset, { align: "right" });
      yOffset += 10;
      
      // PPN (Tax) - when faktur pajak is active
      doc.setTextColor(100, 100, 100);
      doc.text(`PPN (${taxRate}%):`, boxX + 5, finalY + yOffset);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(invoice.tax), boxX + boxWidth - 5, finalY + yOffset, { align: "right" });
      yOffset += 10;
    } else {
      // Subtotal - when faktur pajak is inactive
      doc.text("Subtotal:", boxX + 5, finalY + yOffset);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(invoice.subtotal), boxX + boxWidth - 5, finalY + yOffset, { align: "right" });
      yOffset += 10;
    }
    
    // Discount (if applicable)
    if (parseFloat(invoice.discount) > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text("Discount:", boxX + 5, finalY + yOffset);
      doc.setTextColor(220, 38, 38); // red for discount
      doc.text(`-${formatCurrency(invoice.discount)}`, boxX + boxWidth - 5, finalY + yOffset, { align: "right" });
      yOffset += 10;
    }
    
    // Line before total
    doc.setDrawColor(200, 200, 200);
    doc.line(boxX + 5, finalY + yOffset, boxX + boxWidth - 5, finalY + yOffset);
    yOffset += 10;
    
    // Total
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Total:", boxX + 5, finalY + yOffset);
    doc.text(formatCurrency(invoice.total), boxX + boxWidth - 5, finalY + yOffset, { align: "right" });
    
    // Update finalY for notes positioning
    finalY += boxHeight - 40;
    
    // Add notes - default notes first, then document-specific notes
    const hasDefaultNotes = !!data.defaultNotes;
    const hasInvoiceNotes = !!invoice.notes;
    
    if (hasDefaultNotes || hasInvoiceNotes) {
      finalY += 50;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Notes:", 20, finalY);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      
      let notesY = finalY + 10;
      
      // Show default notes first
      if (hasDefaultNotes) {
        const defaultNotesLines = doc.splitTextToSize(data.defaultNotes!, 170);
        doc.text(defaultNotesLines, 20, notesY);
        notesY += defaultNotesLines.length * 5 + 5;
      }
      
      // Show document-specific notes below
      if (hasInvoiceNotes) {
        const invoiceNotesLines = doc.splitTextToSize(invoice.notes!, 170);
        doc.text(invoiceNotesLines, 20, notesY);
      }
    }
    
    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated on ${new Date().toLocaleDateString()} by AluminumManager`, 20, 285);
      doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
    }
    
    // Save the PDF
    const filename = `Invoice-${invoice.invoiceNumber}.pdf`;
    doc.save(filename);
    
    return filename;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}