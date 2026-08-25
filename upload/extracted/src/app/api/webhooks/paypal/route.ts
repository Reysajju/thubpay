import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter, type GatewayCredential, type GatewaySlug } from '@/lib/gateways';

export const dynamic = 'force-dynamic';

/**
 * Resolve the workspace for an incoming webhook. Priority:
 *   1. `x-thubpay-workspace` header
 *   2. `workspace_id` query parameter
 */
async function resolveWorkspace(req: NextRequest): Promise<string | null> {
  const headerId = req.headers.get('x-thubpay-workspace');
  if (headerId) {
    const ws = await db.workspace.findUnique({
      where: { id: headerId },
      select: { id: true },
    });
    if (ws) return ws.id;
  }

  const queryId = req.nextUrl.searchParams.get('workspace_id');
  if (queryId) {
    const ws = await db.workspace.findUnique({
      where: { id: queryId },
      select: { id: true },
    });
    if (ws) return ws.id;
  }

  return null;
}

/**
 * POST /api/webhooks/paypal
 *
 * Inbound PayPal webhook. Same flow as the Stripe webhook but for the
 * PayPal gateway adapter. Returns `{ received: true }` on success.
 */
export async function POST(req: NextRequest) {
  let workspaceId: string | null;
  try {
    workspaceId = await resolveWorkspace(req);
  } catch (error) {
    console.error('[api/webhooks/paypal] resolveWorkspace error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'Unable to resolve workspace — provide x-thubpay-workspace header or workspace_id query param' },
      { status: 401 }
    );
  }

  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('paypal-transmission-sig') ||
      req.headers.get('paypal-auth-algo') ||
      req.headers.get('x-paypal-signature') ||
      '';

    // Look up a PayPal credential for the workspace
    const credential = await db.gatewayCredential.findFirst({
      where: { workspaceId, gatewaySlug: 'paypal' },
      orderBy: { createdAt: 'asc' },
    });

    const adapter = getAdapter('paypal' as GatewaySlug);

    const credForAdapter: GatewayCredential | null = credential
      ? {
          id: credential.id,
          gatewaySlug: credential.gatewaySlug,
          label: credential.label,
          publishableKey: credential.publishableKey,
          secretKey: credential.secretKeyEnc,
          webhookSecret: credential.webhookSecret,
          mode: credential.mode,
          metadata: credential.metadata ? JSON.parse(credential.metadata) : null,
        }
      : null;

    // Verify signature (if adapter supports it and we have a credential)
    let verified = true;
    if (adapter?.verifyWebhook && credForAdapter) {
      try {
        verified = await adapter.verifyWebhook(credForAdapter, rawBody, signature);
      } catch (err) {
        console.error('[api/webhooks/paypal] verifyWebhook threw:', err);
        verified = false;
      }
    }

    // Parse the event
    let parsed: {
      eventType: string;
      externalId: string;
      amountCents: number;
      currency: string;
      status: 'succeeded' | 'failed' | 'pending' | 'refunded';
      customerEmail?: string;
      raw: Record<string, unknown>;
    };

    try {
      if (adapter?.parseWebhookEvent && credForAdapter) {
        parsed = await adapter.parseWebhookEvent(credForAdapter, rawBody);
      } else {
        // Fallback: best-effort raw parse for PayPal's event format
        const evt = JSON.parse(rawBody || '{}');
        const resource = (evt as { resource?: Record<string, unknown> })?.resource || {};
        const amount = (resource.amount as { total?: string; currency?: string }) || {};
        const evtType = (evt as { event_type?: string })?.event_type || 'unknown';
        parsed = {
          eventType: evtType,
          externalId: (resource.id as string) || (evt as { id?: string })?.id || '',
          amountCents: Math.round(Number(amount.total || 0) * 100),
          currency: String(amount.currency || 'USD').toUpperCase(),
          status: evtType.includes('CAPTURE.COMPLETED')
            ? 'succeeded'
            : evtType.includes('DENIED')
            ? 'failed'
            : 'pending',
          customerEmail: (resource.payer as { email_address?: string })?.email_address,
          raw: evt as Record<string, unknown>,
        };
      }
    } catch (err) {
      console.error('[api/webhooks/paypal] parseWebhookEvent failed:', err);
      parsed = {
        eventType: 'parse_error',
        externalId: '',
        amountCents: 0,
        currency: 'USD',
        status: 'pending',
        raw: { raw: rawBody.slice(0, 4096) },
      };
    }

    // Persist the webhook event
    const webhookEvent = await db.webhookEvent.create({
      data: {
        workspaceId,
        eventType: parsed.eventType,
        gateway: 'paypal',
        status: verified ? 'success' : 'failed',
        payload: JSON.stringify(parsed.raw).slice(0, 65535),
      },
    });

    // Update the matching Transaction (by externalId) if any atomically
    if (parsed.externalId) {
      const tx = await db.transaction.findFirst({
        where: { workspaceId, externalId: parsed.externalId },
      });
      if (tx) {
        const nextStatus =
          parsed.status === 'succeeded'
            ? 'succeeded'
            : parsed.status === 'failed'
            ? 'failed'
            : parsed.status === 'refunded'
            ? 'refunded'
            : tx.status;

        await db.$transaction(async (prisma) => {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { status: nextStatus },
          });

          if (nextStatus === 'succeeded' && tx.invoiceId) {
            const invoice = await prisma.invoice.findUnique({
              where: { id: tx.invoiceId },
            });
            if (invoice && invoice.status !== 'paid') {
              await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                  status: 'paid',
                  paidAt: new Date(),
                  paidViaGateway: tx.gatewaySlug,
                },
              });
              if (invoice.clientId) {
                await prisma.client.update({
                  where: { id: invoice.clientId },
                  data: {
                    totalSpendCents: { increment: invoice.totalCents },
                    transactionCount: { increment: 1 },
                  },
                });
              }
            }
          }
        });
      }
    }

    return NextResponse.json({
      received: true,
      eventId: webhookEvent.id,
      verified,
    });
  } catch (error) {
    console.error('[api/webhooks/paypal] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
