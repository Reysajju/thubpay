// ─────────────────────────────────────────────────────────────
// Public Credit Note PDF Download
// GET /api/public/credit-note/[txId]/pdf
//
// Looks up a refunded transaction by id, fetches the related
// invoice + client + workspace, and streams a branded credit note
// PDF. No auth required — the transaction id is treated as a public
// receipt token (cuids are unguessable).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCreditNotePdf } from '@/lib/credit-note-pdf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40) || 'credit-note';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  const { txId } = await params;

  if (!txId || txId.length < 10) {
    return NextResponse.json({ error: 'Invalid transaction id' }, { status: 400 });
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
    console.error('[credit-note/pdf] DB error:', err);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  if (!tx || tx.status !== 'refunded') {
    return NextResponse.json(
      { error: 'Credit note not found or transaction not refunded' },
      { status: 404 }
    );
  }

  if (!tx.invoice) {
    return NextResponse.json({ error: 'Invoice record missing' }, { status: 404 });
  }

  // Parse the refund details from the failureReason field
  // (format: "Refunded: <reason> (refund ID: <id>)" or
  //  "Partially refunded <cents> cents: <reason> (refund ID: <id>)")
  const failureReason = tx.failureReason || '';
  const refundIdMatch = failureReason.match(/refund ID: ([^)]+)/);
  const refundId = refundIdMatch?.[1] || `re_${tx.id.slice(-12)}`;
  const isPartial = failureReason.toLowerCase().includes('partially refunded');
  const partialAmountMatch = failureReason.match(/partially refunded (\d+) cents/i);
  const partialAmountCents = partialAmountMatch ? Number(partialAmountMatch[1]) : tx.amountCents;
  const reasonMatch = failureReason.match(/(?:Refunded|Partially refunded \d+ cents): ([^(]+)/);
  const reason = reasonMatch?.[1]?.trim() || '—';

  try {
    const pdfBuffer = await generateCreditNotePdf({
      transaction: tx,
      invoice: tx.invoice,
      refundId,
      refundAmountCents: isPartial ? partialAmountCents : tx.amountCents,
      reason,
      isFullRefund: !isPartial,
      issuedAt: tx.updatedAt,
    });

    const invoiceNumber = tx.invoice.invoiceNumber || tx.id.slice(0, 8);
    const filename = `thubpay-credit-note-${safeFilename(invoiceNumber)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('[credit-note/pdf] Generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate credit note PDF' },
      { status: 500 }
    );
  }
}
