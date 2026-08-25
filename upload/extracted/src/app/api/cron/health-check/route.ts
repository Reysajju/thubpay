// ─────────────────────────────────────────────────────────────
// Scheduled Webhook Endpoint Health Check
// GET/POST /api/cron/health-check
//
// Sweeps ALL active webhook endpoints across ALL workspaces and
// records a health check result for each. Intended to be called
// by an external scheduler (Vercel Cron, GitHub Actions, etc.)
// every 5-15 minutes.
//
// After the sweep, runs an SLA breach check — if any endpoint's
// uptime drops below 90% over the last 10 checks, a notification
// is created for the workspace owner.
//
// Auth: optional Bearer token via CRON_SECRET env var. Tolerates
// unauthenticated calls in dev.
//
// Returns aggregate stats: { total, healthy, failed, results[], slaBreaches }
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { sweepAllEndpoints } from '@/lib/health-check';
import { checkSlaBreaches } from '@/lib/sla-check';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Allow up to 60s for the sweep (large workspaces with many endpoints)
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
    const result = await sweepAllEndpoints('scheduled');

    // After the sweep, check for SLA breaches and create notifications
    // for any endpoint that dropped below the threshold.
    let slaBreaches: any[] = [];
    let slaAlertsCreated = 0;
    let slaRecoveries: any[] = [];
    let slaRecoveriesCreated = 0;
    try {
      const slaResults = await checkSlaBreaches();
      slaBreaches = slaResults.filter((r) => r.breached);
      slaAlertsCreated = slaResults.filter((r) => r.alertCreated).length;
      slaRecoveries = slaResults.filter((r) => r.recovered);
      slaRecoveriesCreated = slaResults.filter((r) => r.recoveryCreated).length;
    } catch (err) {
      // Non-fatal — don't fail the sweep over an SLA check error
      console.error('[api/cron/health-check] SLA check failed:', err);
    }

    const durationMs = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      ranAt: new Date().toISOString(),
      durationMs,
      total: result.total,
      healthy: result.healthy,
      failed: result.failed,
      results: result.results,
      slaBreaches,
      slaAlertsCreated,
      slaRecoveries,
      slaRecoveriesCreated,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Sweep failed',
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
