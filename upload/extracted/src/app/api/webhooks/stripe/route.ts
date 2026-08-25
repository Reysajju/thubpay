import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter, type GatewayCredential, type GatewaySlug } from '@/lib/gateways';

export const dynamic = 'force-dynamic';

/**
 * Resolve the workspace for an incoming webhook. Priority:
 *   1. `x-thubpay-workspace` header
 *   2. `workspace_id` query parameter
 * Returns null if neither resolves to an existing workspace.
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
 * POST /api/webhooks/stripe
 *
 * Inbound Stripe webhook. We don't have a real Stripe signing key in
 * the sandbox, so this endpoint:
 *   1. Resolves the workspace via header/query.
 *   2. Looks up a matching `GatewayCredential` (gatewaySlug === 'stripe').
 *   3. If the adapter exposes `verifyWebhook`, uses it; if the credential
 *      has no webhook secret, we accept the payload anyway (demo mode).
 *   4. Parses the event via the adapter's `parseWebhookEvent`.
 *   5. Persists a `WebhookEvent` row.
 *   6. If a matching `Transaction` (by `externalId`) exists, updates its
 *      status from the parsed event.
 *   7. Returns `{ received: true }`.
 *
 * If no workspace can be resolved, returns 401.
 */
export async function POST(req: NextRequest) {
  let workspaceId: string | null;
  try {
    workspaceId = await resolveWorkspace(req);
  } catch (error) {
    console.error('[api/webhooks/stripe] resolveWorkspace error:', error);
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
      req.headers.get('stripe-signature') ||
      req.headers.get('x-stripe-signature') ||
      '';

    // Look up a Stripe credential for the workspace
    const credential = await db.gatewayCredential.findFirst({
      where: { workspaceId, gatewaySlug: 'stripe' },
      orderBy: { createdAt: 'asc' },
    });

    const adapter = getAdapter('stripe' as GatewaySlug);

    // Build a GatewayCredential payload for the adapter
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

    // Verify signature (if adapter supports it and we have a credential).
    // In demo mode (no credential / no signature), we still accept.
    let verified = true;
    if (adapter?.verifyWebhook && credForAdapter) {
      try {
        verified = await adapter.verifyWebhook(credForAdapter, rawBody, signature);
      } catch (err) {
        console.error('[api/webhooks/stripe] verifyWebhook threw:', err);
        verified = false;
      }
    }

    // Parse the event (best-effort — don't fail the whole request on parse error)
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
        // Fallback: best-effort raw parse
        const evt = JSON.parse(rawBody || '{}');
        const obj = (evt as { data?: { object?: Record<string, unknown> } })?.data?.object || {};
        const objStatus = (obj.status as string) || 'pending';
        parsed = {
          eventType: (evt as { type?: string })?.type || 'unknown',
          externalId: (obj.id as string) || (evt as { id?: string })?.id || '',
          amountCents: Number((obj as { amount_received?: number; amount?: number })?.amount_received || (obj as { amount?: number })?.amount || 0),
          currency: String((obj as { currency?: string })?.currency || 'usd').toUpperCase(),
          status: objStatus === 'succeeded' ? 'succeeded' : objStatus === 'failed' ? 'failed' : 'pending',
          customerEmail: (obj as { receipt_email?: string })?.receipt_email,
          raw: evt as Record<string, unknown>,
        };
      }
    } catch (err) {
      console.error('[api/webhooks/stripe] parseWebhookEvent failed:', err);
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
        gateway: 'stripe',
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

          // If succeeded and tied to an invoice, mark the invoice paid
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
    console.error('[api/webhooks/stripe] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
