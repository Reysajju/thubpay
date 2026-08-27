import PDFDocument from 'pdfkit';

/**
 * ThubPay — Credit Note PDF generator
 * ─────────────────────────────────────────────────────────────
 * Produces a branded credit note PDF for refunds.
 */

interface CreditNotePdfInput {
  transaction: {
    id: string;
    amountCents: number;
    currency: string;
    gatewaySlug: string;
    customerEmail?: string | null;
    customerName?: string | null;
    createdAt: Date | string;
  };
  invoice: {
    id: string;
    invoiceNumber?: string | null;
    totalCents: number;
    currency: string;
    paidAt?: Date | string | null;
    client?: {
      name?: string | null;
      email?: string | null;
    } | null;
    workspace?: {
      name: string;
      logoUrl?: string | null;
    } | null;
  };
  refundId: string;
  refundAmountCents: number;
  reason: string;
  isFullRefund: boolean;
  issuedAt: Date;
}

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  card: 'Credit / Debit Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength > 1_000_000) return null;
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

export async function generateCreditNotePdf({
  transaction,
  invoice,
  refundId,
  refundAmountCents,
  reason,
  isFullRefund,
  issuedAt,
}: CreditNotePdfInput): Promise<Buffer> {
  // Try to fetch the workspace logo (best-effort).
  const logoUrl = invoice.workspace?.logoUrl || '';
  const logoBuffer = logoUrl ? await fetchLogoBuffer(logoUrl) : null;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 56, bottom: 56, left: 56, right: 56 },
        info: {
          Title: `Credit Note ${invoice.invoiceNumber || transaction.id.slice(0, 12)}`,
          Author: 'ThubPay',
          Subject: 'Refund Credit Note',
          Producer: 'ThubPay Credit Note Engine',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 56;
      const contentWidth = pageWidth - margin * 2;

      // ── Colors ────────────────────────────────────────────────
      const ink = '#0f172a';
      const muted = '#64748b';
      const faint = '#94a3b8';
      const amber = '#d97706';
      const amberDark = '#b45309';
      const line = '#e2e8f0';
      const surface = '#f8fafc';

      // ═══════════════════════════════════════════════════════════
      // HEADER — logo + merchant name + CREDIT NOTE badge
      // ═══════════════════════════════════════════════════════════
      const merchantName = invoice.workspace?.name || 'ThubPay';

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, margin, 54, { fit: [36, 36] });
        } catch {
          doc.roundedRect(margin, 56, 32, 32, 8).fill(amber);
          doc
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(18)
            .text('T', margin + 11, 63, { width: 18, align: 'center' });
        }
      } else {
        doc.roundedRect(margin, 56, 32, 32, 8).fill(amber);
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(18)
          .text('T', margin + 11, 63, { width: 18, align: 'center' });
      }

      doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text(merchantName, margin + 44, 62);
      doc.fillColor(faint).font('Helvetica').fontSize(9).text('Refund Credit Note', margin + 44, 80);

      // CREDIT NOTE badge (right side, amber)
      const badgeW = 100;
      const badgeH = 22;
      const badgeX = pageWidth - margin - badgeW;
      const badgeY = 60;
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 11).fill(`${amber}1A`);
      doc
        .fillColor(amberDark)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('CREDIT NOTE', badgeX, badgeY + 6.5, { width: badgeW, align: 'center' });

      // Header divider
      doc
        .moveTo(margin, 112)
        .lineTo(pageWidth - margin, 112)
        .strokeColor(line)
        .lineWidth(1)
        .stroke();

      // ═══════════════════════════════════════════════════════════
      // HERO — ↩️ Refund Issued
      // ═══════════════════════════════════════════════════════════
      let y = 144;

      // Amber circle with ↩
      doc.circle(margin + 14, y, 16).fill(`${amber}1A`);
      doc
        .fillColor(amber)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('↩', margin + 7, y - 5, { width: 16, align: 'center' });

      doc.fillColor(ink).font('Helvetica-Bold').fontSize(20).text('Refund Issued', margin + 40, y - 8);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(10.5)
        .text('A refund has been processed for this payment.', margin + 40, y + 14);

      y += 48;

      // ═══════════════════════════════════════════════════════════
      // AMOUNT CARD
      // ═══════════════════════════════════════════════════════════
      const cardH = 76;
      doc.roundedRect(margin, y, contentWidth, cardH, 10).fill(surface);
      doc.roundedRect(margin, y, contentWidth, cardH, 10).strokeColor(line).lineWidth(1).stroke();

      const currency = (invoice.currency || transaction.currency || 'USD').toUpperCase();
      const formattedRefundAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(refundAmountCents / 100);

      doc.fillColor(muted).font('Helvetica-Bold').fontSize(9).text('REFUND AMOUNT', margin + 20, y + 18);
      doc
        .fillColor(amberDark)
        .font('Helvetica-Bold')
        .fontSize(28)
        .text(formattedRefundAmount, margin + 20, y + 34);

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text('TYPE', pageWidth - margin - 140, y + 18);
      doc
        .fillColor(amberDark)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(isFullRefund ? 'Full refund' : 'Partial', pageWidth - margin - 140, y + 36);

      y += cardH + 28;

      // ═══════════════════════════════════════════════════════════
      // CREDIT NOTE DETAILS TABLE
      // ═══════════════════════════════════════════════════════════
      const creditNoteNumber = `CN-${invoice.invoiceNumber || invoice.id.slice(0, 8)}`;
      const originalInvoiceNumber = invoice.invoiceNumber || invoice.id.slice(0, 8);
      const customerName = transaction.customerName || invoice.client?.name || '—';
      const customerEmail = transaction.customerEmail || invoice.client?.email || '—';
      const methodLabel = METHOD_LABELS[transaction.gatewaySlug || 'card'] || 'Credit / Debit Card';

      doc.fillColor(faint).font('Helvetica-Bold').fontSize(9).text('CREDIT NOTE DETAILS', margin, y);
      y += 18;

      const rows: [string, string][] = [
        ['Credit note #', creditNoteNumber],
        ['Original invoice', originalInvoiceNumber],
        ['Original transaction', transaction.id],
        ['Refund ID', refundId],
        ['Date issued', issuedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })],
        ['Refund type', isFullRefund ? 'Full refund' : 'Partial refund'],
        ['Payment method', methodLabel],
        ['Reason', reason || '—'],
        ['Issued to', customerName],
        ['Customer email', customerEmail],
        ['Issued by', merchantName],
      ];

      const rowH = 22;
      rows.forEach(([label, value], i) => {
        const rowY = y + i * rowH;
        if (i % 2 === 0) {
          doc.rect(margin, rowY, contentWidth, rowH).fill(`${surface}CC`);
        }
        doc.fillColor(muted).font('Helvetica').fontSize(9.5).text(label, margin + 12, rowY + 6);
        doc
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .text(value, margin + 200, rowY + 6, {
            width: contentWidth - 212,
            align: 'left',
            ellipsis: true,
          });
      });

      y += rows.length * rowH + 24;

      // ═══════════════════════════════════════════════════════════
      // REFUND TIMING NOTICE
      // ═══════════════════════════════════════════════════════════
      doc.roundedRect(margin, y, contentWidth, 48, 8).fill(`${amber}0A`);
      doc.roundedRect(margin, y, contentWidth, 48, 8).strokeColor(`${amber}40`).lineWidth(1).stroke();
      doc.fillColor(amberDark).font('Helvetica-Bold').fontSize(9).text('REFUND TIMING', margin + 16, y + 10);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text(
          'Refunds typically appear in the customer\u2019s account in 5\u201310 business days, depending on the bank.',
          margin + 16,
          y + 24,
          { width: contentWidth - 32 }
        );

      y += 72;

      // ═══════════════════════════════════════════════════════════
      // FOOTER
      // ═══════════════════════════════════════════════════════════
      doc
        .moveTo(margin, y)
        .lineTo(pageWidth - margin, y)
        .strokeColor(line)
        .lineWidth(1)
        .stroke();
      y += 16;

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9.5)
        .text('This credit note was issued by ThubPay on behalf of ' + merchantName + '.');
      doc
        .fillColor(faint)
        .font('Helvetica')
        .fontSize(8)
        .text(
          'If you have any questions about this refund, please contact the merchant directly.',
          margin,
          y + 16,
          { width: contentWidth }
        );

      // Footer line at bottom
      doc
        .fillColor(faint)
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          `Credit Note ${creditNoteNumber} · Refund ${refundId} · Generated ${new Date().toISOString()}`,
          margin,
          doc.page.height - 40,
          { width: contentWidth, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
