// ─────────────────────────────────────────────────────────────
// Paginated Failed Webhook Deliveries — Cursor Pagination
// GET /api/dashboard/webhooks/deliveries?cursor=<ISO>&limit=25
//
// Phase 7 #33: powers the "Load more" button in the
// FailedDeliveriesCard client component. The parent dashboard page
// fetches the first 25 (well, 26 — to compute hasMoreInitial) rows
// server-side; this endpoint serves subsequent pages on demand.
//
// Cursor = the `attemptedAt` ISO string of the oldest currently-
// visible delivery (the list is ordered `attemptedAt desc`, so we
// query `attemptedAt < cursor`).
//
// Auth: workspace-scoped via `requireWorkspace`. Failed deliveries
// are never exposed to unauthenticated callers.
//
// Query params:
//   - cursor (required): ISO-8601 date string. Must parse to a
//     valid Date. Returns 400 if missing/invalid.
//   - limit  (optional): 1-100, defaults to 25.
//
// Response JSON:
//   { deliveries: FailedDelivery[], hasMore: boolean }
//
// We fetch `limit + 1` rows — if `limit + 1` come back, there's at
// least one more page, so we set hasMore=true and slice off the
// last row before returning. All Date fields are returned as ISO
// strings for JSON serializability.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Mirrors the `FailedDelivery` interface exported by the client
// component. We duplicate it here (rather than importing it from
// a client component) to keep the API route pure-server — Next.js
// disallows importing a `'use client'` module's exports into a
// server route in some build modes, and the lint rule
// `no-restricted-imports` is happier this way.
interface FailedDeliveryDTO {
  id: string;
  statusCode: number | null;
  status: string;
  error: string | null;
  attempts: number;
  nextRetryAt: string | null;
  idempotencyKey: string | null;
  attemptedAt: string;
  durationMs: number | null;
  webhookEvent: { eventType: string; gateway: string | null } | null;
  webhookEndpoint: { label: string; url: string } | null;
}

function toDTO(d: {
  id: string;
  statusCode: number | null;
  status: string;
  error: string | null;
  attempts: number;
  nextRetryAt: Date | null;
  idempotencyKey: string | null;
  attemptedAt: Date;
  durationMs: number | null;
  webhookEvent: { eventType: string; gateway: string | null } | null;
  webhookEndpoint: { label: string; url: string } | null;
}): FailedDeliveryDTO {
  return {
    id: d.id,
    statusCode: d.statusCode,
    status: d.status,
    error: d.error,
    attempts: d.attempts,
    nextRetryAt: d.nextRetryAt ? d.nextRetryAt.toISOString() : null,
    idempotencyKey: d.idempotencyKey,
    attemptedAt: d.attemptedAt.toISOString(),
    durationMs: d.durationMs,
    webhookEvent: d.webhookEvent,
    webhookEndpoint: d.webhookEndpoint,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const { workspaceId } = ctx.context;

  const url = req.nextUrl;
  const cursorRaw = url.searchParams.get('cursor');
  const limitRaw = url.searchParams.get('limit');

  // Validate cursor — must be a present, parseable ISO date.
  if (!cursorRaw) {
    return NextResponse.json(
      { error: 'Missing required query param: cursor' },
      { status: 400 }
    );
  }
  const cursorDate = new Date(cursorRaw);
  if (Number.isNaN(cursorDate.getTime())) {
    return NextResponse.json(
      { error: 'Invalid cursor — must be a valid ISO 8601 date string' },
      { status: 400 }
    );
  }

  // Validate limit — 1..100, default 25.
  let limit = 25;
  if (limitRaw !== null) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: 'Invalid limit — must be an integer between 1 and 100' },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  // Fetch `limit + 1` rows so we can detect "has more" without a count.
  const rows = await db.webhookDelivery.findMany({
    where: {
      workspaceId,
      status: 'failed',
      attemptedAt: { lt: cursorDate },
    },
    include: {
      webhookEvent: { select: { eventType: true, gateway: true } },
      webhookEndpoint: { select: { label: true, url: true } },
    },
    orderBy: { attemptedAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const deliveries = pageRows.map(toDTO);

  return NextResponse.json({ deliveries, hasMore });
}
