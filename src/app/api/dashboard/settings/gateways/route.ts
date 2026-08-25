import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const SUPPORTED_SLUGS = new Set([
  'stripe',
  'paypal',
  'square',
  'adyen',
  'razorpay',
  'authorize_net',
  'braintree',
  'mollie',
  'custom',
]);

/**
 * Strip sensitive fields from a GatewayCredential row before returning
 * it to the client. NEVER expose `secretKeyEnc`. Mask the webhook secret
 * (if any) so the user can tell whether one is set without leaking it.
 */
function sanitizeGateway(row: {
  id: string;
  workspaceId: string;
  gatewaySlug: string;
  label: string;
  publishableKey: string | null;
  webhookSecret: string | null;
  mode: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata: string | null;
}) {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    gateway_slug: row.gatewaySlug,
    label: row.label,
    publishable_key: row.publishableKey,
    webhook_secret_set: Boolean(row.webhookSecret),
    webhook_secret: row.webhookSecret ? '***...***' : null,
    mode: row.mode,
    is_active: row.isActive,
    is_default: row.isDefault,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

/**
 * GET /api/dashboard/settings/gateways
 * List all gateway credentials for the authenticated workspace.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const rows = await db.gatewayCredential.findMany({
      where: { workspaceId: ctx.context.workspaceId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return NextResponse.json({
      gateways: rows.map(sanitizeGateway),
    });
  } catch (error) {
    console.error('[api/gateways] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/settings/gateways
 * Create a new GatewayCredential for the authenticated workspace.
 *
 * Body:
 *   gateway_slug: string     (required — one of SUPPORTED_SLUGS)
 *   label: string            (required)
 *   publishable_key?: string
 *   secret_key?: string      (encrypted before storage)
 *   webhook_secret?: string
 *   mode?: 'test' | 'live'   (default 'test')
 *   is_default?: boolean      (default false)
 *   metadata?: Record<string, unknown>
 */
export async function POST(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      gateway_slug,
      label,
      publishable_key,
      secret_key,
      webhook_secret,
      mode,
      is_default,
      metadata,
    } = body as {
      gateway_slug?: unknown;
      label?: unknown;
      publishable_key?: unknown;
      secret_key?: unknown;
      webhook_secret?: unknown;
      mode?: unknown;
      is_default?: unknown;
      metadata?: unknown;
    };

    if (typeof gateway_slug !== 'string' || !SUPPORTED_SLUGS.has(gateway_slug)) {
      return NextResponse.json(
        { error: `gateway_slug must be one of: ${Array.from(SUPPORTED_SLUGS).join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof label !== 'string' || !label.trim()) {
      return NextResponse.json(
        { error: 'label is required' },
        { status: 400 }
      );
    }

    const resolvedMode = mode === 'live' ? 'live' : 'test';
    const makeDefault = is_default === true;

    // Serialize metadata (if any) to JSON for storage
    const metadataJson =
      metadata && typeof metadata === 'object'
        ? JSON.stringify(metadata)
        : null;

    // Encrypt the secret key at rest
    const secretKeyEnc =
      typeof secret_key === 'string' && secret_key
        ? encryptSecret(secret_key)
        : null;

    // If this gateway is being marked default, unset default on the others
    if (makeDefault) {
      await db.gatewayCredential.updateMany({
        where: {
          workspaceId: ctx.context.workspaceId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const created = await db.gatewayCredential.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        gatewaySlug: gateway_slug,
        label: label.trim(),
        publishableKey:
          typeof publishable_key === 'string' && publishable_key ? publishable_key : null,
        secretKeyEnc,
        // M8 fix: encrypt the webhook secret at rest (same v2:AES-256-GCM
        // path as secretKeyEnc). The previous code stored it in plaintext,
        // which meant a DB read = full webhook forging capability.
        webhookSecret:
          typeof webhook_secret === 'string' && webhook_secret
            ? encryptSecret(webhook_secret)
            : null,
        mode: resolvedMode,
        isActive: true,
        isDefault: makeDefault,
        metadata: metadataJson,
      },
    });

    // ── Audit log entry for the gateway creation ──
    await db.auditLog.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        userId: ctx.context.userId,
        action: 'gateway.create',
        entity: 'gateway',
        entityId: created.id,
        metadata: JSON.stringify({
          gatewaySlug: created.gatewaySlug,
          label: created.label,
          mode: created.mode,
          isDefault: created.isDefault,
        }),
      },
    }).catch(() => {
      /* non-fatal — audit log is best-effort */
    });

    return NextResponse.json(
      { gateway: sanitizeGateway(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/gateways] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
