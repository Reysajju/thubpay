import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import { generateApiKey } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * Strip a stored ApiKey row down to what's safe to return to the client
 * after the initial creation response. Never returns `keyHash`.
 */
function sanitizeApiKey(row: {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  keyMasked: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    name: row.name,
    label: row.name,
    key_prefix: row.keyPrefix,
    key_masked: row.keyMasked,
    key_suffix: row.keyMasked.slice(-4),
    is_active: row.isActive,
    last_used_at: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * GET /api/dashboard/settings/api-keys
 * List all API keys for the authenticated workspace.
 */
export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  try {
    const rows = await db.apiKey.findMany({
      where: { tenantId: ctx.context.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      api_keys: rows.map(sanitizeApiKey),
    });
  } catch (error) {
    console.error('[api/api-keys] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/settings/api-keys
 *
 * Generate a new API key. The full key is returned ONCE in the response
 * (under `apiKey.full_key`); only the hash + masked form are persisted.
 *
 * Body:
 *   name: string  (required — friendly label for the key)
 *   prefix?: 'live' | 'test'  (default 'live')
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

    const { name, label, prefix } = body as {
      name?: unknown;
      label?: unknown;
      prefix?: unknown;
    };

    // Accept either `name` or `label` for friendliness — clients send both
    const resolvedName =
      typeof name === 'string' && name.trim()
        ? name.trim()
        : typeof label === 'string' && label.trim()
        ? label.trim()
        : '';

    if (!resolvedName) {
      return NextResponse.json(
        { error: 'A name (or label) is required' },
        { status: 400 }
      );
    }

    const keyPrefix = prefix === 'test' ? 'test' : 'live';
    const { fullKey, keyHash, keyMasked } = generateApiKey(keyPrefix);

    const created = await db.apiKey.create({
      data: {
        tenantId: ctx.context.workspaceId,
        name: resolvedName,
        keyPrefix: keyPrefix,
        keyHash,
        keyMasked,
        isActive: true,
      },
    });

    // ── Audit log entry for the API key creation ──
    await db.auditLog.create({
      data: {
        workspaceId: ctx.context.workspaceId,
        userId: ctx.context.userId,
        action: 'api_key.create',
        entity: 'api_key',
        entityId: created.id,
        metadata: JSON.stringify({
          name: created.name,
          keyPrefix: created.keyPrefix,
          keyMasked: created.keyMasked,
        }),
      },
    }).catch(() => {
      /* non-fatal — audit log is best-effort */
    });

    // Return the full key ONCE — never expose it again after this response.
    return NextResponse.json(
      {
        apiKey: {
          ...sanitizeApiKey(created),
          full_key: fullKey,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/api-keys] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
