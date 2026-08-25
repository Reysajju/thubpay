// ─────────────────────────────────────────────────────────────
// Webhook Dispatcher
//
// When a WebhookEvent is created (e.g. invoice.viewed, payment.succeeded),
// this module fans it out to all active WebhookEndpoints that subscribe
// to the event type. Each delivery attempt is recorded as a
// WebhookDelivery row for audit + retry.
//
// Key features:
//   • HMAC-SHA256 payload signing (X-ThubPay-Signature header)
//   • Configurable timeout (5s default)
//   • Per-endpoint subscription filter (events="*" or comma-separated)
//   • Delivery audit row with HTTP status, duration, response snippet
//   • Non-blocking — failures don't propagate to the caller
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import crypto from 'crypto';

const DEFAULT_TIMEOUT_MS = 5000;
const RESPONSE_SNIPPET_MAX = 4096;

interface DispatchResult {
  endpointId: string;
  status: 'ok' | 'failed';
  statusCode: number | null;
  error?: string;
  durationMs: number;
  responseSnippet?: string;
}

/**
 * Dispatch a single WebhookEvent to all matching endpoints.
 * Records one WebhookDelivery row per attempt.
 *
 * Usage:
 *   const event = await db.webhookEvent.create({ ... });
 *   await dispatchWebhookEvent(event.id);
 */
export async function dispatchWebhookEvent(webhookEventId: string): Promise<void> {
  const event = await db.webhookEvent.findUnique({
    where: { id: webhookEventId },
  });
  if (!event) return;

  // Find all active endpoints that subscribe to this event type.
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      workspaceId: event.workspaceId,
      isActive: true,
    },
  });

  const matchingEndpoints = endpoints.filter((ep) => isSubscribed(ep.events, event.eventType));
  if (matchingEndpoints.length === 0) return;

  // Fire all deliveries in parallel (each is independently audited).
  const results = await Promise.allSettled(
    matchingEndpoints.map((ep) => deliverOne(event, ep)),
  );

  // Update each endpoint's lastTriggeredAt + lastStatus
  for (let i = 0; i < matchingEndpoints.length; i++) {
    const ep = matchingEndpoints[i];
    const result = results[i];
    const outcome: DispatchResult | null =
      result.status === 'fulfilled' ? result.value : null;
    try {
      await db.webhookEndpoint.update({
        where: { id: ep.id },
        data: {
          lastTriggeredAt: new Date(),
          lastStatus: outcome?.status === 'ok' ? 'success' : 'failed',
        },
      });
    } catch {
      // Non-fatal
    }
  }
}

function isSubscribed(eventsCsv: string | null, eventType: string): boolean {
  if (!eventsCsv || eventsCsv.trim() === '*' || eventsCsv.trim() === '') return true;
  const subscribed = eventsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (subscribed.length === 0) return true;
  // Support wildcard suffix: "invoice.*" matches "invoice.viewed"
  return subscribed.some((s) => {
    if (s === eventType) return true;
    if (s.endsWith('.*')) {
      const prefix = s.slice(0, -2);
      return eventType.startsWith(prefix + '.');
    }
    return false;
  });
}

async function deliverOne(
  event: {
    id: string;
    workspaceId: string;
    eventType: string;
    payload: string;
  },
  endpoint: {
    id: string;
    url: string;
    secret: string | null;
  }
): Promise<DispatchResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  // Compute HMAC-SHA256 signature of the payload (if a secret is set).
  const body = event.payload;
  const signature =
    endpoint.secret && endpoint.secret.length > 0
      ? crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex')
      : null;

  let statusCode: number | null = null;
  let status: 'ok' | 'failed' = 'failed';
  let errorMsg: string | undefined;
  let responseSnippet: string | undefined;

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ThubPay-Event': event.eventType,
        'X-ThubPay-Event-Id': event.id,
        'User-Agent': 'ThubPay-Webhook/1.0',
        ...(signature ? { 'X-ThubPay-Signature': `sha256=${signature}` } : {}),
      },
      body,
      signal: controller.signal,
      // Don't follow redirects — security.
      redirect: 'error',
    });

    statusCode = res.status;
    status = res.status >= 200 && res.status < 300 ? 'ok' : 'failed';

    // Capture a small response snippet for debugging.
    try {
      const text = await res.text();
      responseSnippet = text.slice(0, RESPONSE_SNIPPET_MAX) || undefined;
    } catch {
      responseSnippet = undefined;
    }

    if (status === 'failed') {
      errorMsg = `HTTP ${res.status} ${res.statusText}`;
    }
  } catch (err: any) {
    status = 'failed';
    errorMsg = err?.name === 'AbortError'
      ? `Timeout after ${DEFAULT_TIMEOUT_MS}ms`
      : (err?.message || 'Connection failed');
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startedAt;

  // Persist the delivery audit row.
  try {
    await db.webhookDelivery.create({
      data: {
        workspaceId: event.workspaceId,
        webhookEventId: event.id,
        webhookEndpointId: endpoint.id,
        statusCode,
        status,
        error: errorMsg,
        responseSnippet,
        durationMs,
      },
    });
  } catch {
    // Non-fatal — don't fail the dispatch over a write error.
  }

  return {
    endpointId: endpoint.id,
    status,
    statusCode,
    error: errorMsg,
    durationMs,
    responseSnippet,
  };
}
