import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/gateways';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/charge
 *
 * Authenticated dashboard endpoint that creates a payment intent via the
 * workspace's active (default) gateway. The intent is persisted as a
 * `Transaction` row by `createPaymentIntent`.
 *
 * Body:
 *   amountCents: number  (required, > 0)
 *   currency: string     (required, e.g. "USD")
 *   invoiceId?: string
 *   customerEmail?: string
 *   customerName?: string
 *   description?: string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      amountCents,
      currency,
      invoiceId,
      customerEmail,
      customerName,
      description,
    } = body as {
      amountCents?: unknown;
      currency?: unknown;
      invoiceId?: unknown;
      customerEmail?: unknown;
      customerName?: unknown;
      description?: unknown;
    };

    if (typeof amountCents !== 'number' || !Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json(
        { error: 'amountCents must be a positive number' },
        { status: 400 }
      );
    }

    if (!currency || typeof currency !== 'string') {
      return NextResponse.json(
        { error: 'currency is required (e.g. "USD")' },
        { status: 400 }
      );
    }

    // createPaymentIntent resolves the workspace via requireWorkspace(),
    // picks the default/active gateway, calls the adapter, and persists
    // a Transaction row.
    const result = await createPaymentIntent({
      amountCents: Math.round(amountCents),
      currency: currency.toUpperCase(),
      invoiceId: typeof invoiceId === 'string' && invoiceId ? invoiceId : undefined,
      customerEmail: typeof customerEmail === 'string' && customerEmail ? customerEmail : undefined,
      customerName: typeof customerName === 'string' && customerName ? customerName : undefined,
      description: typeof description === 'string' && description ? description : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      intent: result.intent,
      gatewaySlug: result.gatewaySlug,
      gatewayId: result.gatewayId,
    });
  } catch (error) {
    console.error('[api/payments/charge] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
