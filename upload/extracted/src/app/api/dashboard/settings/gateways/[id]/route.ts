import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * Strip sensitive fields from a GatewayCredential row before returning
 * it to the client. NEVER expose `secretKeyEnc`.
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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/dashboard/settings/gateways/[id]
 * Fetch a single gateway credential (scoped to the workspace).
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing gateway ID' }, { status: 400 });
    }

    const row = await db.gatewayCredential.findFirst({
      where: { id, workspaceId: ctx.context.workspaceId },
    });

    if (!row) {
      return NextResponse.json(
        { error: 'Gateway not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ gateway: sanitizeGateway(row) });
  } catch (error) {
    console.error('[api/gateways/[id]] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/dashboard/settings/gateways/[id]
 *
 * Update an existing gateway. Accepts partial updates:
 *   label?: string
 *   publishable_key?: string
 *   secret_key?: string       (re-encrypted if provided)
 *   webhook_secret?: string
 *   mode?: 'test' | 'live'
 *   is_active?: boolean
 *   is_default?: boolean      (unsets is_default on other gateways if true)
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing gateway ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const {
      label,
      publishable_key,
      secret_key,
      webhook_secret,
      mode,
      is_active,
      is_default,
      metadata,
    } = body as {
      label?: unknown;
      publishable_key?: unknown;
      secret_key?: unknown;
      webhook_secret?: unknown;
      mode?: unknown;
      is_active?: unknown;
      is_default?: unknown;
      metadata?: unknown;
    };

    // Ensure the gateway exists and belongs to the workspace
    const existing = await db.gatewayCredential.findFirst({
      where: { id, workspaceId: ctx.context.workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Gateway not found' },
        { status: 404 }
      );
    }

    // Build the update payload (only fields that were provided)
    const update: Record<string, unknown> = {};
    if (typeof label === 'string' && label.trim()) update.label = label.trim();
    if (publishable_key !== undefined) {
      update.publishableKey =
        typeof publishable_key === 'string' && publishable_key ? publishable_key : null;
    }
    if (typeof secret_key === 'string' && secret_key) {
      update.secretKeyEnc = encryptSecret(secret_key);
    }
    if (webhook_secret !== undefined) {
      update.webhookSecret =
        typeof webhook_secret === 'string' && webhook_secret ? webhook_secret : null;
    }
    if (mode === 'test' || mode === 'live') update.mode = mode;
    if (typeof is_active === 'boolean') update.isActive = is_active;
    if (typeof is_default === 'boolean') update.isDefault = is_default;
    if (metadata !== undefined) {
      update.metadata =
        metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : null;
    }

    // If marking as default, unset default on sibling gateways first
    if (update.isDefault === true) {
      await db.gatewayCredential.updateMany({
        where: {
          workspaceId: ctx.context.workspaceId,
          isDefault: true,
          NOT: { id: existing.id },
        },
        data: { isDefault: false },
      });
    }

    const updated = await db.gatewayCredential.update({
      where: { id: existing.id },
      data: update,
    });

    return NextResponse.json({ gateway: sanitizeGateway(updated) });
  } catch (error) {
    console.error('[api/gateways/[id]] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/settings/gateways/[id]
 * Permanently delete a gateway credential (scoped to the workspace).
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing gateway ID' }, { status: 400 });
    }

    // Confirm ownership before deleting
    const existing = await db.gatewayCredential.findFirst({
      where: { id, workspaceId: ctx.context.workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Gateway not found' },
        { status: 404 }
      );
    }

    await db.gatewayCredential.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/gateways/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
