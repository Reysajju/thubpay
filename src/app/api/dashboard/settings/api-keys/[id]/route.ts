import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/dashboard/settings/api-keys/[id]
 *
 * Toggle an API key's `isActive` status (or set it explicitly via
 * `{ is_active: boolean }` in the body).
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing API key ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { is_active } = (body || {}) as { is_active?: unknown };

    // Verify ownership
    const existing = await db.apiKey.findFirst({
      where: { id, tenantId: ctx.context.workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // If is_active is provided, use it; otherwise toggle.
    const nextActive =
      typeof is_active === 'boolean' ? is_active : !existing.isActive;

    const updated = await db.apiKey.update({
      where: { id: existing.id },
      data: { isActive: nextActive },
    });

    return NextResponse.json({
      api_key: {
        id: updated.id,
        name: updated.name,
        label: updated.name,
        key_prefix: updated.keyPrefix,
        key_masked: updated.keyMasked,
        is_active: updated.isActive,
        last_used_at: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
        created_at: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[api/api-keys/[id]] PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/settings/api-keys/[id]
 *
 * Soft-deletes (deactivates) an API key. The row is preserved so audit
 * logs retain referential integrity, but the key is marked inactive and
 * can no longer be used for authentication.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing API key ID' }, { status: 400 });
    }

    const existing = await db.apiKey.findFirst({
      where: { id, tenantId: ctx.context.workspaceId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Soft-delete: deactivate. (Hard-delete would orphan audit references.)
    await db.apiKey.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    // ── Audit log entry for the API key revocation ──
    await db.auditLog.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        userId: ctx.context.userId,
        action: 'api_key.revoke',
        entity: 'api_key',
        entityId: existing.id,
        metadata: JSON.stringify({
          name: existing.name,
          keyPrefix: existing.keyPrefix,
          keyMasked: existing.keyMasked,
        }),
      },
    }).catch(() => {
      /* non-fatal — audit log is best-effort */
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[api/api-keys/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
