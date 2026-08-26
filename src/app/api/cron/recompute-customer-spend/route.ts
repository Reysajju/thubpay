// ─────────────────────────────────────────────────────────────
// Recompute Client totalSpendCents / transactionCount
// GET/POST /api/cron/recompute-customer-spend
//
// Walks every workspace and recomputes the denormalized
// `Client.totalSpendCents` / `Client.transactionCount` columns
// from the transactions table. Use this as a periodic maintenance
// task (e.g. daily) OR after backfilling historical transactions.
//
// Auth: optional Bearer token via CRON_SECRET env var. Tolerates
// unauthenticated calls in dev.
//
// Returns aggregate stats: { workspaces, totalClients, updated, unchanged }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recomputeClientSpendColumns } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Allow up to 60s for the recompute (large workspaces with many clients)
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return runRecompute(req);
}

export async function POST(req: NextRequest) {
  return runRecompute(req);
}

async function runRecompute(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // Optionally scope to a single workspace via ?workspaceId=ws_x
    const workspaceId = req.nextUrl.searchParams.get('workspaceId');

    // Phase 7 #32: Optional ?batchSize= query param to tune the
    // db.$transaction([...]) chunk size inside recomputeClientSpendColumns.
    // Default 50. Validated to 1-500 (500 is the SQLite safe upper bound
    // for array-form transactions — each client.update uses ~3 params and
    // SQLite's per-query parameter limit is 999, so ~333 is the hard cap;
    // 500 leaves headroom for future field additions per update).
    const batchSizeRaw = req.nextUrl.searchParams.get('batchSize');
    let batchSize = 50;
    if (batchSizeRaw !== null) {
      const parsed = Number(batchSizeRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid batchSize — must be an integer between 1 and 500',
            ranAt: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
          },
          { status: 400 }
        );
      }
      batchSize = parsed;
    }

    let workspaces: { id: string; name: string }[] = [];
    if (workspaceId) {
      const w = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true },
      });
      if (!w) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      workspaces = [w];
    } else {
      workspaces = await db.workspace.findMany({
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const results: Array<{ workspaceId: string; workspaceName: string; totalClients: number; updated: number; unchanged: number; durationMs: number }> = [];
    let totalClients = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;

    for (const w of workspaces) {
      const wsStart = Date.now();
      try {
        const r = await recomputeClientSpendColumns(w.id, batchSize);
        results.push({
          workspaceId: w.id,
          workspaceName: w.name,
          ...r,
          durationMs: Date.now() - wsStart,
        });
        totalClients += r.totalClients;
        totalUpdated += r.updated;
        totalUnchanged += r.unchanged;
      } catch (err: any) {
        results.push({
          workspaceId: w.id,
          workspaceName: w.name,
          totalClients: 0,
          updated: 0,
          unchanged: 0,
          durationMs: Date.now() - wsStart,
        });
      }
    }

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      workspaces: workspaces.length,
      totalClients,
      updated: totalUpdated,
      unchanged: totalUnchanged,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Recompute failed',
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
