import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import {
  getApiKeys,
  getWebhookEvents,
  getGateways,
  getWebhookEndpoints,
  getWebhookDeliveries,
  getWebhookEndpointStats,
  getWebhookDeliveryTrend,
  getAllEndpointUptimeStats,
  getEndpointSlaStatuses,
} from '@/lib/demo-data';
import DeveloperToolsClient from './DeveloperToolsClient';
import HealthCheckPanel from '../components/HealthCheckPanel';
import EndpointComparisonChart from '../components/EndpointComparisonChart';
import UptimeHistoryChart from '../components/UptimeHistoryChart';
import SlaPanel from '../components/SlaPanel';
import LatencyOverlayChart from '../components/LatencyOverlayChart';

export const dynamic = 'force-dynamic';

// Safe wrapper that returns null instead of throwing on edge cases
async function getEndpointUptimeStatsSafe(workspaceId: string, endpointId: string, historyLimit: number) {
  try {
    const { getEndpointUptimeStats } = await import('@/lib/demo-data');
    return await getEndpointUptimeStats(workspaceId, endpointId, historyLimit);
  } catch {
    return null;
  }
}

export default async function DevelopersPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const [apiKeys, webhookEvents, dbGateways, webhookEndpoints, webhookDeliveries, endpointStats, slaStatuses] = await Promise.all([
    getApiKeys(workspaceId),
    getWebhookEvents(workspaceId),
    getGateways(workspaceId),
    getWebhookEndpoints(workspaceId),
    getWebhookDeliveries(workspaceId, 30),
    getWebhookEndpointStats(workspaceId),
    getEndpointSlaStatuses(workspaceId),
  ]);

  // Fetch per-endpoint delivery trend (sparkline data) + uptime stats in parallel
  const endpointTrends: Record<string, any> = {};
  const endpointUptime: Record<string, any> = {};
  await Promise.all(
    webhookEndpoints.map(async (ep) => {
      const [trend, uptime] = await Promise.all([
        getWebhookDeliveryTrend(workspaceId, ep.id, 30),
        getEndpointUptimeStatsSafe(workspaceId, ep.id, 50),
      ]);
      endpointTrends[ep.id] = trend;
      endpointUptime[ep.id] = uptime;
    })
  );

  // Map demo data to the shapes DeveloperToolsClient expects
  const mappedApiKeys = apiKeys.map(ak => ({
    id: ak.id,
    label: ak.name,
    key_prefix: ak.key_prefix,
    key_hash: ak.key_masked,
    scopes: ['read', 'write'],
    is_active: ak.is_active,
    last_used_at: ak.last_used_at,
    created_at: ak.created_at,
  }));

  const mappedWebhookEvents = webhookEvents.map(we => ({
    id: we.id,
    gateway_name: we.gateway ?? '',
    event_id: we.id,
    event_type: we.event_type,
    processed_at: we.status === 'success' ? we.created_at : null,
    created_at: we.created_at,
  }));

  const mappedGateways = dbGateways.map(g => ({
    id: g.id,
    gateway_slug: g.gateway_slug,
    label: g.label,
    publishable_key: g.publishable_key,
    is_live: g.mode === 'live',
    is_active: g.is_active,
    created_at: g.created_at,
  }));

  const mappedEndpoints = webhookEndpoints.map(ep => ({
    id: ep.id,
    url: ep.url,
    label: ep.label,
    events: ep.events,
    is_active: ep.is_active,
    has_secret: ep.has_secret,
    last_triggered_at: ep.last_triggered_at,
    last_status: ep.last_status,
    created_at: ep.created_at,
  }));

  const mappedDeliveries = webhookDeliveries.map(d => ({
    id: d.id,
    webhook_event_id: d.webhook_event_id,
    webhook_endpoint_id: d.webhook_endpoint_id,
    status: d.status,
    status_code: d.status_code,
    error: d.error,
    duration_ms: d.duration_ms,
    attempted_at: d.attempted_at,
  }));

  // Map endpoint stats into a lookup keyed by endpoint id
  const statsByEndpoint: Record<string, any> = {};
  for (const s of endpointStats) {
    statsByEndpoint[s.endpoint_id] = {
      total_deliveries: s.total_deliveries,
      successful: s.successful,
      failed: s.failed,
      success_rate: s.success_rate,
      avg_latency_ms: s.avg_latency_ms,
      p95_latency_ms: s.p95_latency_ms,
      p99_latency_ms: s.p99_latency_ms,
      min_latency_ms: s.min_latency_ms,
      max_latency_ms: s.max_latency_ms,
      last_delivery_at: s.last_delivery_at,
    };
  }

  // Pass only active endpoints to the health check panel
  const activeEndpointsForHealthCheck = webhookEndpoints
    .filter((ep) => ep.is_active)
    .map((ep) => ({ id: ep.id, label: ep.label, url: ep.url }));

  // Build the comparison chart data (only when there are >= 2 endpoints with trends)
  const comparisonEndpoints = webhookEndpoints
    .map((ep) => ({
      id: ep.id,
      label: ep.label,
      url: ep.url,
      trend: endpointTrends[ep.id] || [],
    }))
    .filter((ep) => ep.trend.length > 0);

  return (
    <>
      {slaStatuses.length > 0 && (
        <SlaPanel endpoints={slaStatuses} />
      )}
      {activeEndpointsForHealthCheck.length > 0 && (
        <HealthCheckPanel endpoints={activeEndpointsForHealthCheck} />
      )}
      <DeveloperToolsClient
        apiKeys={mappedApiKeys}
        webhookEvents={mappedWebhookEvents}
        gateways={mappedGateways}
        webhookEndpoints={mappedEndpoints}
        webhookDeliveries={mappedDeliveries}
        endpointStats={statsByEndpoint}
        endpointTrends={endpointTrends}
        endpointUptime={endpointUptime}
        workspaceId={workspaceId}
      />
      {comparisonEndpoints.length >= 2 && (
        <EndpointComparisonChart endpoints={comparisonEndpoints} />
      )}
      {comparisonEndpoints.length >= 2 && (
        <LatencyOverlayChart endpoints={comparisonEndpoints} />
      )}
    </>
  );
}
