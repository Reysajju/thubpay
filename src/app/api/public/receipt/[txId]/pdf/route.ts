// ─────────────────────────────────────────────────────────────
// Public Receipt PDF Download
// GET /api/public/receipt/[txId]/pdf
//
// Looks up a succeeded transaction by id, fetches the related
// invoice + client + workspace, and streams a branded PDF
// receipt. No auth required — the transaction id is treated as
// a public receipt token (cuids are unguessable).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReceiptPdf } from '@/lib/receipt-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40) || 'receipt';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  const { txId } = await params;

  if (!txId || txId.length < 10) {
    return NextResponse.json({ error: 'Invalid receipt id' }, { status: 400 });
  }

  let tx;
  try {
    tx = await db.transaction.findUnique({
      where: { id: txId },
      include: {
        invoice: {
          include: {
            client: true,
            workspace: { select: { name: true, logoUrl: true } },
          },
        },
      },
    });
  } catch (err) {
    console.error('[receipt/pdf] DB error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  if (!tx || tx.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'Receipt not found or payment not completed' },
      { status: 404 }
    );
  }

  if (!tx.invoice) {
    return NextResponse.json({ error: 'Invoice record missing' }, { status: 404 });
  }

  try {
    const pdfBuffer = await generateReceiptPdf({
      transaction: tx,
      invoice: tx.invoice,
    });

    const invoiceNumber = tx.invoice.invoiceNumber || tx.id.slice(0, 8);
    const filename = `thubpay-receipt-${safeFilename(invoiceNumber)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        // Allow the success page + lookup page (same origin) to link directly.
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[receipt/pdf] Generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate receipt PDF' },
      { status: 500 }
    );
  }
}
