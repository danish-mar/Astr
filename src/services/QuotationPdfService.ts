import PDFDocument from 'pdfkit';

export interface QuotationItem {
  name: string;
  qty?: number;
  unitPrice: number;
  total: number;
}

export interface QuotationPdfData {
  quoteNumber: string;
  date: Date;
  validUntil: Date;
  shop: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    upiId?: string;
  };
  customer: {
    name: string;
    phone?: string;
  };
  items: QuotationItem[];
  totalAmount: number;
  notes?: string;
}

export class QuotationPdfService {
  /**
   * Generates a sleek, professional PDF quotation buffer.
   */
  public static async generateQuotationPdf(data: QuotationPdfData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Quotation ${data.quoteNumber} - ${data.shop.name}`,
            Author: data.shop.name,
            Subject: 'Hardware Quotation / Price Estimate',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const pageWidth = 595.28; // A4 width in points
        const pageHeight = 841.89; // A4 height in points
        const leftMargin = 40;
        const rightMargin = 555;
        const contentWidth = rightMargin - leftMargin;

        // 1. Top Decorative Brand Bar
        doc.rect(0, 0, pageWidth, 6).fill('#4F46E5');

        let y = 35;

        // 2. Header: Shop Info (Left) & Quotation Badge (Right)
        const shopName = (data.shop.name || 'Mamdani Computers').toUpperCase();
        doc
          .font('Helvetica-Bold')
          .fontSize(18)
          .fillColor('#0F172A')
          .text(shopName, leftMargin, y);

        y += 22;
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#64748B')
          .text('Computers, Custom Builds & Hardware Solutions', leftMargin, y);

        y += 13;
        if (data.shop.address) {
          doc.text(data.shop.address, leftMargin, y);
          y += 12;
        }
        if (data.shop.phone) {
          doc.text(`Phone / WhatsApp: ${data.shop.phone}`, leftMargin, y);
          y += 12;
        }
        if (data.shop.gstin) {
          doc.text(`GSTIN: ${data.shop.gstin}`, leftMargin, y);
          y += 12;
        }

        // Quotation Badge & Metadata (Right side)
        const badgeX = 375;
        const badgeWidth = 180;
        const badgeY = 32;

        // Badge Pill
        doc.roundedRect(badgeX, badgeY, badgeWidth, 26, 4).fill('#EEF2FF');
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#4338CA')
          .text('ESTIMATE / QUOTATION', badgeX, badgeY + 7, {
            width: badgeWidth,
            align: 'center',
          });

        let metaY = badgeY + 36;
        const metaRows = [
          { label: 'Quote Ref:', val: data.quoteNumber },
          { label: 'Date:', val: data.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
          { label: 'Valid Until:', val: data.validUntil.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
        ];

        for (const meta of metaRows) {
          doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(meta.label, badgeX, metaY);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E293B').text(meta.val, badgeX + 70, metaY, { width: 110, align: 'right' });
          metaY += 14;
        }

        y = Math.max(y + 10, metaY + 10);

        // Divider Line
        doc.moveTo(leftMargin, y).lineTo(rightMargin, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
        y += 14;

        // 3. Customer Info Box
        doc.roundedRect(leftMargin, y, contentWidth, 54, 4).fillAndStroke('#F8FAFC', '#E2E8F0');

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#6366F1')
          .text('QUOTATION PREPARED FOR', leftMargin + 14, y + 10);

        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#0F172A')
          .text(data.customer.name || 'Valued Customer', leftMargin + 14, y + 22);

        if (data.customer.phone) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748B')
            .text(`Contact: ${data.customer.phone}`, leftMargin + 14, y + 37);
        }

        // Right side of customer box: Payment / UPI info if available
        if (data.shop.upiId) {
          doc
            .font('Helvetica-Bold')
            .fontSize(8)
            .fillColor('#64748B')
            .text('PAYMENT DETAILS', 360, y + 10);
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#1E293B')
            .text(`UPI ID: ${data.shop.upiId}`, 360, y + 24);
        }

        y += 70;

        // 4. Itemized Components Table
        const colNo = leftMargin; // width: 25
        const colDesc = leftMargin + 30; // width: 290
        const colQty = leftMargin + 325; // width: 40
        const colRate = leftMargin + 370; // width: 70
        const colAmount = leftMargin + 445; // width: 70

        // Table Header
        const headerHeight = 22;
        doc.rect(leftMargin, y, contentWidth, headerHeight).fill('#1E293B');

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
        doc.text('#', colNo + 6, y + 6);
        doc.text('COMPONENT / PRODUCT DESCRIPTION', colDesc, y + 6);
        doc.text('QTY', colQty, y + 6, { width: 35, align: 'center' });
        doc.text('RATE (₹)', colRate, y + 6, { width: 65, align: 'right' });
        doc.text('AMOUNT (₹)', colAmount, y + 6, { width: 65, align: 'right' });

        y += headerHeight;

        // Table Rows
        let idx = 1;
        for (const item of data.items) {
          const rowHeight = 24;
          const isEven = idx % 2 === 0;

          if (isEven) {
            doc.rect(leftMargin, y, contentWidth, rowHeight).fill('#F8FAFC');
          }

          // Row line separator
          doc.moveTo(leftMargin, y + rowHeight).lineTo(rightMargin, y + rowHeight).strokeColor('#F1F5F9').lineWidth(0.75).stroke();

          doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(String(idx), colNo + 6, y + 6);
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E293B').text(item.name, colDesc, y + 6, { width: 285 });
          doc.font('Helvetica').fontSize(9).fillColor('#475569').text(String(item.qty || 1), colQty, y + 6, { width: 35, align: 'center' });
          doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(`₹${Number(item.unitPrice || 0).toLocaleString('en-IN')}`, colRate, y + 6, { width: 65, align: 'right' });
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0F172A').text(`₹${Number(item.total || 0).toLocaleString('en-IN')}`, colAmount, y + 6, { width: 65, align: 'right' });

          y += rowHeight;
          idx++;
        }

        // 5. Total & Summary Box
        y += 12;
        const totalBoxWidth = 220;
        const totalBoxX = rightMargin - totalBoxWidth;
        const totalBoxY = y;
        const totalBoxHeight = 44;

        doc.roundedRect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 4).fillAndStroke('#EEF2FF', '#C7D2FE');

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#4F46E5')
          .text('ESTIMATED TOTAL', totalBoxX + 14, totalBoxY + 9);

        doc
          .font('Helvetica-Bold')
          .fontSize(15)
          .fillColor('#1E1B4B')
          .text(`₹${Number(data.totalAmount || 0).toLocaleString('en-IN')}`, totalBoxX + 14, totalBoxY + 22, {
            width: totalBoxWidth - 28,
            align: 'right',
          });

        y += totalBoxHeight + 25;

        // 6. Terms & Conditions
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#475569').text('TERMS & CONDITIONS:', leftMargin, y);
        y += 12;

        const terms = [
          '1. Prices are valid for 7 days from the date of issue and subject to component stock availability.',
          '2. Daily market price fluctuations may affect rates upon expiration of this estimate.',
          '3. Standard manufacturer warranty applies to all new components as per company policy.',
          '4. Assembly, cable management, and testing are included with full PC builds.',
        ];

        doc.font('Helvetica').fontSize(8).fillColor('#64748B');
        for (const t of terms) {
          doc.text(t, leftMargin, y);
          y += 11;
        }

        // 7. Footer
        const footerY = pageHeight - 45;
        doc.moveTo(leftMargin, footerY).lineTo(rightMargin, footerY).strokeColor('#E2E8F0').lineWidth(0.75).stroke();

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#94A3B8')
          .text(
            `Thank you for consulting ${shopName}! For orders or modifications, reach us on WhatsApp.`,
            leftMargin,
            footerY + 10,
            { width: contentWidth, align: 'center' }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default QuotationPdfService;
