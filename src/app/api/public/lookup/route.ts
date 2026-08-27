// ─────────────────────────────────────────────────────────────
// Public Receipt Lookup API
// POST /api/public/lookup
//
// Lets a customer find their past receipts by entering EITHER:
//   • the email they paid with (returns up to 25 receipts), OR
//   • a specific transaction ID (returns exactly 1 receipt).
//
// Returns a sanitized list (no sensitive merchant data, no internal
// IDs beyond the transaction + invoice ids needed to open the receipt).
//
// Rate-limited to 10 requests per 15 minutes per IP to prevent
// email / transaction enumeration attacks.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, cleanupRateLimitStore } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export interface PublicReceipt {
  transactionId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amountCents: number;
  currency: string;
  paidAt: string | null; // ISO string (serialized for JSON)
  method: string;
  merchantName: string;
}

// Stricter limit than the default `public` config: 10 lookups / 15 min / IP.
// This is a sensitive endpoint (email enumeration surface) so we keep it tight.
const LOOKUP_RATE_LIMIT = { windowMs: 15 * 60 * 1000, maxRequests: 10 };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidTxId(id: string): boolean {
  // CUIDs are 24+ chars; we also accept the seeded short IDs (txn-XXX).
  return /^[a-zA-Z0-9_-]{6,40}$/.test(id);
}

function toPublicReceipt(t: any): PublicReceipt {
  return {
    transactionId: t.id,
    invoiceId: t.invoiceId || t.invoice?.id || '',
    invoiceNumber: t.invoice?.invoiceNumber ?? null,
    amountCents: t.amountCents,
    currency: t.currency,
    paidAt: (t.invoice?.paidAt ?? t.createdAt)?.toISOString() ?? null,
    method: t.gatewaySlug,
    merchantName: t.invoice?.workspace?.name || 'ThubPay Merchant',
  };
}

const invoiceInclude = {
  select: {
    id: true,
    invoiceNumber: true,
    paidAt: true,
    workspace: { select: { name: true } },
  },
};

export async function POST(req: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────
  cleanupRateLimitStore();
  const limited = rateLimit(req, 'receipt-lookup', LOOKUP_RATE_LIMIT);
  if (limited) {
    return limited; // 429 with Retry-After header
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const txId = typeof body.txId === 'string' ? body.txId.trim() : '';

    // ── Mode A: search by transaction ID ────────────────────────
    if (txId) {
      if (!isValidTxId(txId)) {
        return NextResponse.json(
          { ok: false, error: 'Please enter a valid transaction ID.' },
          { status: 400 }
        );
      }

      const tx = await db.transaction.findFirst({
        where: {
          id: txId,
          status: 'succeeded',
        },
        include: { invoice: invoiceInclude },
      });

      const receipts: PublicReceipt[] = tx ? [toPublicReceipt(tx)] : [];
      return NextResponse.json({
        ok: true,
        receipts,
        count: receipts.length,
      });
    }

    // ── Mode B: search by email (default) ──────────────────────
    if (!email) {
      return NextResponse.json(
        { ok: false, error: 'Email or transaction ID is required.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const txs = await db.transaction.findMany({
      where: {
        status: 'succeeded',
        customerEmail: email,
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: { invoice: invoiceInclude },
    });

    const receipts: PublicReceipt[] = txs.map(toPublicReceipt);

    return NextResponse.json({
      ok: true,
      receipts,
      count: receipts.length,
    });
  } catch (err) {
    console.error('[api/public/lookup] DB error:', err);
    return NextResponse.json(
      { ok: false, error: 'Could not reach the receipt database. Please try again.' },
      { status: 503 }
    );
  }
}

// OPTIONS handler for preflight (in case of cross-origin usage).
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
