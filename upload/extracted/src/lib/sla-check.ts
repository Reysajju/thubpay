// ─────────────────────────────────────────────────────────────
// Uptime SLA Breach Detector + Recovery Notifier
//
// After each scheduled health check sweep, this module checks every
// endpoint's recent uptime rate. Two outcomes per endpoint:
//
//   • BREACH: uptime < workspace's slaThreshold (default 90%) over
//     the last 10 checks → creates an error Notification (idempotent
//     within 1 hour to prevent spam).
//
//   • RECOVERY: an endpoint that was previously breaching (had a
//     recent "SLA breach:" notification) is now back above threshold
//     → creates a success Notification "SLA recovered:" (idempotent
//     — only fires once per breach cycle).
//
// The SLA threshold is configurable per workspace (Workspace.slaThreshold).
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db';

const SLA_WINDOW_CHECKS = 10; // last 10 checks
const SLA_ALERT_TITLE_PREFIX = 'SLA breach:';
const SLA_RECOVERY_TITLE_PREFIX = 'SLA recovered:';
const SLA_RECOVERY_WINDOW_HOURS = 24; // look back this far for a breach notification to recover from

export interface SlaCheckResult {
  endpointId: string;
  workspaceId: string;
  endpointLabel: string;
  uptimeRate: number;
  healthyChecks: number;
  totalChecks: number;
  threshold: number;
  breached: boolean;
  recovered: boolean;
  alertCreated: boolean;
  recoveryCreated: boolean;
}

/**
 * Check all endpoints for SLA breaches AND recoveries.
 *
 * For each endpoint with uptime < workspace's slaThreshold, create
 * a breach Notification (idempotent within 1 hour).
 *
 * For each endpoint that was previously breaching (has a recent
 * "SLA breach:" notification) but is now above threshold, create
 * a recovery Notification (idempotent — only fires once per breach
 * cycle).
 */
export async function checkSlaBreaches(): Promise<SlaCheckResult[]> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { isActive: true },
    select: { id: true, workspaceId: true, label: true, url: true, slaThresholdOverride: true },
  });

  // Cache workspace SLA thresholds to avoid repeated queries
  const workspaceThresholdCache = new Map<string, number>();
  async function getWorkspaceThreshold(workspaceId: string): Promise<number> {
    if (workspaceThresholdCache.has(workspaceId)) {
      return workspaceThresholdCache.get(workspaceId)!;
    }
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { slaThreshold: true },
    });
    const threshold = ws?.slaThreshold ?? 90;
    workspaceThresholdCache.set(workspaceId, threshold);
    return threshold;
  }

  // Per-endpoint threshold = override ?? workspace default
  async function getEndpointThreshold(ep: { workspaceId: string; slaThresholdOverride: number | null }): Promise<number> {
    if (ep.slaThresholdOverride != null) return ep.slaThresholdOverride;
    return getWorkspaceThreshold(ep.workspaceId);
  }

  const results: SlaCheckResult[] = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recoveryWindowStart = new Date(Date.now() - SLA_RECOVERY_WINDOW_HOURS * 60 * 60 * 1000);

  for (const ep of endpoints) {
    const threshold = await getEndpointThreshold(ep);

    // Pull the last N health checks for this endpoint
    const checks = await db.endpointHealthCheck.findMany({
      where: { webhookEndpointId: ep.id },
      orderBy: { checkedAt: 'desc' },
      take: SLA_WINDOW_CHECKS,
      select: { status: true, checkedAt: true },
    });

    if (checks.length < 3) {
      // Not enough data to evaluate SLA — skip
      results.push({
        endpointId: ep.id,
        workspaceId: ep.workspaceId,
        endpointLabel: ep.label,
        uptimeRate: 100,
        healthyChecks: checks.filter((c) => c.status === 'healthy').length,
        totalChecks: checks.length,
        threshold,
        breached: false,
        recovered: false,
        alertCreated: false,
        recoveryCreated: false,
      });
      continue;
    }

    const healthy = checks.filter((c) => c.status === 'healthy').length;
    const uptimeRate = Math.round((healthy / checks.length) * 100);
    const breached = uptimeRate < threshold;

    let alertCreated = false;
    let recoveryCreated = false;

    if (breached) {
      // Idempotency: check if we already alerted for this endpoint in the last hour
      const existingAlert = await db.notification.findFirst({
        where: {
          workspaceId: ep.workspaceId,
          title: { startsWith: SLA_ALERT_TITLE_PREFIX },
          body: { contains: ep.label },
          createdAt: { gte: oneHourAgo },
        },
        select: { id: true },
      });

      if (!existingAlert) {
        try {
          await db.notification.create({
            data: {
              workspaceId: ep.workspaceId,
              title: `${SLA_ALERT_TITLE_PREFIX} ${ep.label}`,
              body: `Endpoint "${ep.label}" uptime dropped to ${uptimeRate}% over the last ${checks.length} health checks (${healthy}/${checks.length} healthy). Threshold: ${threshold}%.`,
              type: 'error',
            },
          });
          alertCreated = true;
        } catch {
          // Non-fatal
        }
      }
    } else {
      // Endpoint is currently above threshold — check if it was recently breaching.
      // If so, fire a recovery notification (idempotent — only if no recovery
      // notification exists for this endpoint in the recovery window).
      const recentBreach = await db.notification.findFirst({
        where: {
          workspaceId: ep.workspaceId,
          title: { startsWith: SLA_ALERT_TITLE_PREFIX },
          body: { contains: ep.label },
          createdAt: { gte: recoveryWindowStart },
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      if (recentBreach) {
        // Check we haven't already sent a recovery notification for this breach
        const existingRecovery = await db.notification.findFirst({
          where: {
            workspaceId: ep.workspaceId,
            title: { startsWith: SLA_RECOVERY_TITLE_PREFIX },
            body: { contains: ep.label },
            createdAt: { gte: recentBreach.createdAt },
          },
          select: { id: true },
        });

        if (!existingRecovery) {
          try {
            await db.notification.create({
              data: {
                workspaceId: ep.workspaceId,
                title: `${SLA_RECOVERY_TITLE_PREFIX} ${ep.label}`,
                body: `Endpoint "${ep.label}" has recovered — uptime is now ${uptimeRate}% over the last ${checks.length} health checks (${healthy}/${checks.length} healthy). Above threshold: ${threshold}%.`,
                type: 'success',
              },
            });
            recoveryCreated = true;
          } catch {
            // Non-fatal
          }
        }
      }
    }

    results.push({
      endpointId: ep.id,
      workspaceId: ep.workspaceId,
      endpointLabel: ep.label,
      uptimeRate,
      healthyChecks: healthy,
      totalChecks: checks.length,
      threshold,
      breached,
      recovered: recoveryCreated,
      alertCreated,
      recoveryCreated,
    });
  }

  return results;
}
