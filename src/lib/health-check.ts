// ─────────────────────────────────────────────────────────────
// Webhook Endpoint Health Check (shared core logic)
//
// Used by:
//   • `pingWebhookEndpoint` server action (manual UI trigger)
//   • `/api/cron/health-check` endpoint (scheduled sweep)
//
// Sends a HEAD request to the endpoint URL with a 5s timeout and
// records the result as an `EndpointHealthCheck` row for the
// uptime history chart.
//
// Health logic:
//   • 2xx, 3xx, 4xx (except 429) = "healthy" (endpoint exists + responds)
//   • 5xx, 429, connection failure, timeout = "unhealthy"
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db';

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export interface HealthCheckResult {
  endpointId: string;
  workspaceId: string;
  healthy: boolean;
  statusCode: number | null;
  durationMs: number;
  error?: string;
}

/**
 * Perform a single health check on a webhook endpoint.
 * Persists the result as an EndpointHealthCheck row.
 *
 * @param endpointId  The endpoint to ping.
 * @param workspaceId The workspace that owns the endpoint (for persistence).
 * @param triggeredBy "manual" (UI button) or "scheduled" (cron sweep).
 */
export async function performHealthCheck(
  endpointId: string,
  workspaceId: string,
  triggeredBy: 'manual' | 'scheduled' = 'manual'
): Promise<HealthCheckResult> {
  const ep = await db.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { id: true, url: true, workspaceId: true },
  });

  if (!ep || ep.workspaceId !== workspaceId) {
    return {
      endpointId,
      workspaceId,
      healthy: false,
      statusCode: null,
      durationMs: 0,
      error: 'Endpoint not found or access denied',
    };
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  let statusCode: number | null = null;
  let isHealthy = false;
  let errorMsg: string | undefined;

  try {
    const res = await fetch(ep.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'User-Agent': 'ThubPay-HealthCheck/1.0',
      },
    });
    statusCode = res.status;
    isHealthy = !(res.status >= 500 || res.status === 429);
    if (!isHealthy) {
      errorMsg = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err: any) {
    isHealthy = false;
    errorMsg =
      err?.name === 'AbortError'
        ? `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms`
        : err?.message || 'Connection failed';
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startedAt;
  const status = isHealthy ? 'healthy' : 'unhealthy';

  // Persist the health check result for the uptime history chart.
  try {
    await db.endpointHealthCheck.create({
      data: {
        workspaceId,
        webhookEndpointId: endpointId,
        statusCode,
        status,
        durationMs,
        error: errorMsg,
        triggeredBy,
      },
    });
  } catch {
    // Non-fatal — don't fail the check over a write error.
  }

  // Update the endpoint's lastTriggeredAt + lastStatus so the UI reflects the check.
  try {
    await db.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: isHealthy ? 'success' : 'failed',
      },
    });
  } catch {
    // Non-fatal
  }

  return {
    endpointId,
    workspaceId,
    healthy: isHealthy,
    statusCode,
    durationMs,
    error: errorMsg,
  };
}

/**
 * Sweep all active endpoints across all workspaces. Used by the
 * scheduled cron endpoint to periodically check every endpoint.
 *
 * Returns aggregate stats for logging / monitoring.
 */
export async function sweepAllEndpoints(triggeredBy: 'manual' | 'scheduled' = 'scheduled') {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { isActive: true },
    select: { id: true, workspaceId: true },
  });

  const results: HealthCheckResult[] = [];
  // Sequential pings to avoid hammering the network
  for (const ep of endpoints) {
    const result = await performHealthCheck(ep.id, ep.workspaceId, triggeredBy);
    results.push(result);
  }

  const healthy = results.filter((r) => r.healthy).length;
  const failed = results.length - healthy;

  return {
    total: results.length,
    healthy,
    failed,
    results,
  };
}
