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

    // Return sanitized transaction status
    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      status: transaction.status,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      invoice: transaction.invoice
        ? {
            id: transaction.invoice.id,
            invoiceNumber: transaction.invoice.invoiceNumber,
            status: transaction.invoice.status,
            paidAt: transaction.invoice.paidAt,
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
