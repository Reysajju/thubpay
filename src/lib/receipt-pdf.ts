import PDFDocument from 'pdfkit';

/**
 * ThubPay — Receipt PDF generator
 * ─────────────────────────────────────────────────────────────
 * Produces a clean, branded payment receipt PDF using pdfkit.
 */

interface ReceiptPdfInput {
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
}

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  card: 'Credit / Debit Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

/**
 * Fetch a logo image as a Buffer. Returns null if the URL is missing,
 * unreachable, or the content-type isn't an image we can embed.
 *
 * Used in the receipt PDF header: when a workspace has a `logoUrl`,
 * we embed the real brand logo instead of the default ThubPay "T".
 */
async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      // Don't hang the PDF generation on a slow logo CDN.
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const arrayBuf = await res.arrayBuffer();
    // Guard against absurdly large logos (max 1 MB).
    if (arrayBuf.byteLength > 1_000_000) return null;
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

export async function generateReceiptPdf({ transaction, invoice }: ReceiptPdfInput): Promise<Buffer> {
  // Try to fetch the workspace logo before we start building the PDF
  // (best-effort — if it fails we fall back to the default "T" badge).
  const logoUrl = invoice.workspace?.logoUrl || '';
  const logoBuffer = logoUrl ? await fetchLogoBuffer(logoUrl) : null;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 56, bottom: 56, left: 56, right: 56 },
        info: {
          Title: `Receipt ${invoice.invoiceNumber || transaction.id.slice(0, 12)}`,
          Author: 'ThubPay',
          Subject: 'Payment Receipt',
          Producer: 'ThubPay Receipt Engine',
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
      const ink = '#0f172a'; // slate-900
      const muted = '#64748b'; // slate-500
      const faint = '#94a3b8'; // slate-400
      const emerald = '#059669';
      const emeraldDark = '#047857';
      const line = '#e2e8f0'; // slate-200
      const surface = '#f8fafc'; // slate-50

      // ═══════════════════════════════════════════════════════════
      // HEADER — logo + merchant name + PAID badge
      // ═══════════════════════════════════════════════════════════
      const merchantName = invoice.workspace?.name || 'ThubPay';

      // Logo: embed the workspace logo if we fetched one successfully;
      // otherwise fall back to the default emerald "T" badge.
      if (logoBuffer) {
        try {
          // pdfkit auto-scales to fit the given width/height while
          // preserving aspect ratio when only one dimension is given.
          doc.image(logoBuffer, margin, 54, { fit: [36, 36] });
        } catch {
          // Image decode failed — fall back to the default badge.
          doc.roundedRect(margin, 56, 32, 32, 8).fill(emerald);
          doc
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(18)
            .text('T', margin + 11, 63, { width: 18, align: 'center' });
        }
      } else {
        doc.roundedRect(margin, 56, 32, 32, 8).fill(emerald);
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(18)
          .text('T', margin + 11, 63, { width: 18, align: 'center' });
      }

      // Merchant name
      doc.fillColor(ink).font('Helvetica-Bold').fontSize(15).text(merchantName, margin + 44, 62);
      doc.fillColor(faint).font('Helvetica').fontSize(9).text('Payment Receipt', margin + 44, 80);

      // PAID badge (right side)
      const badgeW = 64;
      const badgeH = 22;
      const badgeX = pageWidth - margin - badgeW;
      const badgeY = 60;
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 11).fill(`${emerald}1A`); // 10% alpha
      doc
        .fillColor(emeraldDark)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('PAID', badgeX, badgeY + 6.5, { width: badgeW, align: 'center' });

      // Header divider
      doc
        .moveTo(margin, 112)
        .lineTo(pageWidth - margin, 112)
        .strokeColor(line)
        .lineWidth(1)
        .stroke();

      // ═══════════════════════════════════════════════════════════
      // SUCCESS HERO
      // ═══════════════════════════════════════════════════════════
      let y = 144;

      // Green check circle
      doc.circle(margin + 14, y, 16).fill(`${emerald}1A`);
      doc
        .fillColor(emerald)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('✓', margin + 6, y - 5.5, { width: 16, align: 'center' });

      doc.fillColor(ink).font('Helvetica-Bold').fontSize(20).text('Payment Confirmed', margin + 40, y - 8);
      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(10.5)
        .text('Your payment has been successfully processed.', margin + 40, y + 14);

      y += 48;

      // ═══════════════════════════════════════════════════════════
      // AMOUNT CARD
      // ═══════════════════════════════════════════════════════════
      const cardH = 76;
      doc.roundedRect(margin, y, contentWidth, cardH, 10).fill(surface);
      doc.roundedRect(margin, y, contentWidth, cardH, 10).strokeColor(line).lineWidth(1).stroke();

      const amount = invoice.totalCents ?? transaction.amountCents;
      const currency = (invoice.currency || transaction.currency || 'USD').toUpperCase();
      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount / 100);

      doc.fillColor(muted).font('Helvetica-Bold').fontSize(9).text('AMOUNT PAID', margin + 20, y + 18);
      doc
        .fillColor(emeraldDark)
        .font('Helvetica-Bold')
        .fontSize(28)
        .text(formattedAmount, margin + 20, y + 34);

      doc
        .fillColor(muted)
        .font('Helvetica')
        .fontSize(9)
        .text('STATUS', pageWidth - margin - 140, y + 18);
      doc
        .fillColor(emeraldDark)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('Succeeded', pageWidth - margin - 140, y + 36);

      y += cardH + 28;

      // ═══════════════════════════════════════════════════════════
      // RECEIPT DETAILS TABLE
      // ═══════════════════════════════════════════════════════════
      doc.fillColor(faint).font('Helvetica-Bold').fontSize(9).text('RECEIPT DETAILS', margin, y);
      y += 18;

      const paidAt = invoice.paidAt || transaction.createdAt;
      const methodLabel = METHOD_LABELS[transaction.gatewaySlug || 'card'] || 'Credit / Debit Card';
      const customerName = transaction.customerName || invoice.client?.name || '—';
      const customerEmail = transaction.customerEmail || invoice.client?.email || '—';
      const invoiceNumber = invoice.invoiceNumber || invoice.id.slice(0, 8);

      const rows: [string, string][] = [
        ['Receipt / Invoice', invoiceNumber],
        ['Transaction ID', transaction.id],
        ['Date paid', paidAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })],
        ['Payment method', methodLabel],
        ['Billed to', customerName],
        ['Receipt email', customerEmail],
        ['Paid to', merchantName],
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
        .text('Thank you for your business!', margin, y);
      doc
        .fillColor(faint)
        .font('Helvetica')
        .fontSize(8)
        .text(
          'This receipt was issued by ThubPay on behalf of ' + merchantName + '. ' +
            'If you have any questions about this payment, please contact the merchant directly.',
          margin,
          y + 18,
          { width: contentWidth }
        );

      // Footer line at bottom
      doc
        .fillColor(faint)
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          `Receipt ${transaction.id} · Generated ${new Date().toISOString()}`,
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
