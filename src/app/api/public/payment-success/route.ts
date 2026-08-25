import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyInvoiceToken } from '@/lib/crypto';
import { rateLimit, RATE_LIMITS, cleanupRateLimitStore } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/payment-success
 *
 * Secure transaction status query & verified settlement confirmation endpoint.
 *
 * SECURITY:
 *   - Unauthenticated requests can QUERY the settlement status of a transaction.
 *   - State mutations to 'succeeded' require a cryptographically valid verification token
 *     or are processed through verified gateway webhooks / server actions.
 */
export async function POST(req: NextRequest) {
  cleanupRateLimitStore();
  const limited = rateLimit(req, 'payment-success', RATE_LIMITS.public);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { transactionId, verificationToken } = body as {
      transactionId?: unknown;
      verificationToken?: unknown;
    };

    if (typeof transactionId !== 'string' || !transactionId.trim()) {
      return NextResponse.json(
        { error: 'transactionId is required' },
        { status: 400 }
      );
    }

    // ── Load the transaction ───────────────────────────────────────
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId.trim() },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalCents: true,
            currency: true,
            paidAt: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // If verification token is provided, verify cryptographic signature before mutation
    if (typeof verificationToken === 'string' && verificationToken) {
      const verification = verifyInvoiceToken(verificationToken);
      if (verification.ok && transaction.invoiceId === verification.invoiceId) {
        if (transaction.status !== 'succeeded') {
          await db.$transaction([
            db.transaction.update({
              where: { id: transaction.id },
              data: { status: 'succeeded' },
            }),
            db.invoice.update({
              where: { id: verification.invoiceId },
              data: {
                status: 'paid',
                paidAt: new Date(),
                paidViaGateway: transaction.gatewaySlug,
              },
            }),
          ]);
        }
      }
    }

    // C4 fix: re-fetch the transaction AFTER the mutation block above.
    // The previous code returned `transaction.status` from the pre-mutation
    // snapshot, so a caller who just paid would see `status: 'pending'` even
    // though the DB now has `status: 'succeeded'` — leading them to retry /
    // double-pay. Now we always return the freshest DB state.
    const fresh = await db.transaction.findUnique({
      where: { id: transaction.id },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            totalCents: true,
            currency: true,
            paidAt: true,
          },
        },
      },
    });

    if (!fresh) {
      // Race: row was deleted between the two reads. Return what we have.
      return NextResponse.json({
        success: true,
        transactionId: transaction.id,
        status: transaction.status,
        amountCents: transaction.amountCents,
        currency: transaction.currency,
        invoice: null,
      });
    }

    // Return sanitized transaction status (from the fresh snapshot).
    return NextResponse.json({
      success: true,
      transactionId: fresh.id,
      status: fresh.status,
      amountCents: fresh.amountCents,
      currency: fresh.currency,
      invoice: fresh.invoice
        ? {
            id: fresh.invoice.id,
            invoiceNumber: fresh.invoice.invoiceNumber,
            status: fresh.invoice.status,
            paidAt: fresh.invoice.paidAt,
          }
        : null,
    });
  } catch (error) {
    console.error('[api/public/payment-success] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
