import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdapter, type GatewaySlug } from '@/lib/gateways';
import { decryptSecret } from '@/lib/crypto';
import { rateLimit, RATE_LIMITS, cleanupRateLimitStore } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/pay
 *
 * Public checkout endpoint — does NOT require a NextAuth session.
 * The caller supplies a `workspaceId` (and optionally a `gatewaySlug`)
 * to scope the request to a particular merchant.
 * Rate-limited to 30 requests per minute per IP.
 *
 * Body:
 *   workspaceId: string (required)
 *   amountCents: number  (required, > 0)
 *   currency: string     (required, e.g. "USD")
 *   customerEmail?: string
 *   customerName?: string
 *   gatewaySlug?: string (optional — uses workspace default if omitted)
 *
 * The intent is persisted as a `Transaction` row tied to the workspace.
 */
export async function POST(req: NextRequest) {
  // Rate limit: 30 public pay requests per minute per IP
  cleanupRateLimitStore();
  const limited = rateLimit(req, 'public-pay', RATE_LIMITS.public);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      workspaceId,
      amountCents,
      currency,
      customerEmail,
      customerName,
      gatewaySlug,
    } = body as {
      workspaceId?: unknown;
      amountCents?: unknown;
      currency?: unknown;
      customerEmail?: unknown;
      customerName?: unknown;
      gatewaySlug?: unknown;
    };

    // ── Validate required fields ───────────────────────────────────
    if (typeof workspaceId !== 'string' || !workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required' },
        { status: 400 }
      );
    }

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

    // ── Validate workspace exists ──────────────────────────────────
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, baseCurrency: true },
    });
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // ── Resolve gateway credential ─────────────────────────────────
    // Type widened explicitly so the reassignment below type-checks.
    let credential: Awaited<
      ReturnType<typeof db.gatewayCredential.findFirst>
    > = null;

    if (typeof gatewaySlug === 'string' && gatewaySlug) {
      credential = await db.gatewayCredential.findFirst({
        where: {
          workspaceId,
          gatewaySlug,
          isActive: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!credential) {
        return NextResponse.json(
          { error: `No active "${gatewaySlug}" gateway connected for this workspace` },
          { status: 400 }
        );
      }
    } else {
      // Prefer the workspace's default gateway; fall back to any active one.
      credential = await db.gatewayCredential.findFirst({
        where: { workspaceId, isActive: true, isDefault: true },
      });
      if (!credential) {
        credential = await db.gatewayCredential.findFirst({
          where: { workspaceId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!credential) {
        return NextResponse.json(
          { error: 'No active payment gateway connected for this workspace' },
          { status: 400 }
        );
      }
    }

    // ── Look up the adapter ────────────────────────────────────────
    const adapter = getAdapter(credential.gatewaySlug as GatewaySlug);
    if (!adapter) {
      return NextResponse.json(
        { error: `Unsupported gateway: ${credential.gatewaySlug}` },
        { status: 400 }
      );
    }

    // ── Create the intent via the adapter ──────────────────────────
    const intentReq = {
      amountCents: Math.round(amountCents as number),
      currency: (currency as string).toUpperCase(),
      customerEmail:
        typeof customerEmail === 'string' && customerEmail ? customerEmail : undefined,
      customerName:
        typeof customerName === 'string' && customerName ? customerName : undefined,
    };

    const credentialForAdapter = {
      id: credential.id,
      gatewaySlug: credential.gatewaySlug,
      label: credential.label,
      publishableKey: credential.publishableKey,
      secretKey: decryptSecret(credential.secretKeyEnc),
      webhookSecret: decryptSecret(credential.webhookSecret) || credential.webhookSecret,
      mode: credential.mode,
      metadata: credential.metadata ? JSON.parse(credential.metadata) : null,
    };

    const intent = await adapter.createIntent(credentialForAdapter, intentReq);

    // ── Persist the transaction record ─────────────────────────────
    const transaction = await db.transaction.create({
      data: {
        workspaceId,
        gatewayId: credential.id,
        gatewaySlug: credential.gatewaySlug,
        externalId: intent.id,
        amountCents: intentReq.amountCents,
        currency: intentReq.currency,
        status: 'pending',
        customerEmail: intentReq.customerEmail || null,
        customerName: intentReq.customerName || null,
      },
    });

    return NextResponse.json({
      success: true,
      intent,
      transactionId: transaction.id,
      gatewaySlug: credential.gatewaySlug,
    });
  } catch (error) {
    console.error('[api/public/pay] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
