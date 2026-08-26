// ─────────────────────────────────────────────────────────────
// Scheduled Webhook Delivery Retry Sweep
// GET/POST /api/cron/webhook-retry
//
// Scans ALL failed WebhookDelivery rows across ALL workspaces where
// `nextRetryAt <= now` AND `attempts < MAX_WEBHOOK_ATTEMPTS`, and
// retries each one with exponential backoff.
//
// Intended to be called by an external scheduler (Vercel Cron, GitHub
// Actions, etc.) every 1-5 minutes.
//
// Auth: optional Bearer token via CRON_SECRET env var. Tolerates
// unauthenticated calls in dev.
//
// Returns aggregate stats: { total, retried, succeeded, failed, exhausted, results[] }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { retryDueDeliveries } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Allow up to 60s for the retry sweep (large workspaces with many failed deliveries)
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return runSweep(req);
}

export async function POST(req: NextRequest) {
  return runSweep(req);
}

async function runSweep(req: NextRequest) {
  // Auth check (tolerates unauthenticated in dev)
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // Cap batch size at 100 per sweep to bound runtime. If there are more
    // due deliveries, the next scheduled sweep will pick them up.
    const result = await retryDueDeliveries(100);

    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      durationMs,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Retry sweep failed',
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
