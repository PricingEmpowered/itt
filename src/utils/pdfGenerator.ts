import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface QuoteData {
  id: string;
  created_at: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  customer: {
    name: string;
    contact_email: string;
    segment: string;
    regionData?: { name: string };
    industryData?: { name: string };
  };
  lines: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_applied: number;
    line_total: number;
    product?: {
      name: string;
      category: string;
    };
  }>;
}

export async function generateQuotePDF(quote: QuoteData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  try {
    const logoImg = await loadImage('/price space logo.png');
    doc.addImage(logoImg, 'PNG', 15, 10, 30, 30);
  } catch (error) {
    console.log('Logo not loaded, continuing without it');
  }

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTE', pageWidth - 15, 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Quote #: ${quote.id}`, pageWidth - 15, 32, { align: 'right' });
  doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, pageWidth - 15, 37, { align: 'right' });
  doc.text(`Status: ${quote.status.toUpperCase()}`, pageWidth - 15, 42, { align: 'right' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 15, 55);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.customer.name, 15, 62);
  doc.text(quote.customer.contact_email, 15, 67);
  doc.text(`Segment: ${quote.customer.segment}`, 15, 72);
  if (quote.customer.regionData) {
    doc.text(`Region: ${quote.customer.regionData.name}`, 15, 77);
  }
  if (quote.customer.industryData) {
    doc.text(`Industry: ${quote.customer.industryData.name}`, 15, 82);
  }

  const tableData = quote.lines.map(line => [
    line.product?.name || line.product_id,
    line.product?.category || 'N/A',
    line.quantity.toString(),
    `$${line.unit_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `${line.discount_applied.toFixed(1)}%`,
    `$${line.line_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ]);

  autoTable(doc, {
    startY: 95,
    head: [['Product', 'Category', 'Qty', 'Unit Price', 'Discount', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 35 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const summaryX = pageWidth - 70;
  doc.text('Subtotal:', summaryX, finalY);
  doc.text(`$${quote.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 15, finalY, { align: 'right' });

  doc.text('Tax:', summaryX, finalY + 7);
  doc.text(`$${quote.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 15, finalY + 7, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(summaryX, finalY + 10, pageWidth - 15, finalY + 10);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', summaryX, finalY + 17);
  doc.text(`$${quote.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 15, finalY + 17, { align: 'right' });

  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(128, 128, 128);
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' });
  doc.text('This quote is valid for 30 days from the date of issue.', pageWidth / 2, footerY + 5, { align: 'center' });

  doc.save(`Quote-${quote.id}.pdf`);
}

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}
