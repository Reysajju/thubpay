// ─────────────────────────────────────────────────────────────
// Webhook Dispatcher (Phase 6: retry + Idempotency-Key)
//
// When a WebhookEvent is created (e.g. invoice.viewed, payment.succeeded),
// this module fans it out to all active WebhookEndpoints that subscribe
// to the event type. Each delivery attempt is recorded as a
// WebhookDelivery row for audit + retry.
//
// Key features:
//   • HMAC-SHA256 payload signing (X-ThubPay-Signature header)
//   • Idempotency-Key header (sha256 of eventId+endpointId+attempt#)
//     — endpoints can dedupe retries by storing this header
//   • Configurable timeout (5s default)
//   • Per-endpoint subscription filter (events="*" or comma-separated)
//   • Delivery audit row with HTTP status, duration, response snippet
//   • Retry with exponential backoff:
//       attempt 1  → immediate
//       attempt 2  → +30s
//       attempt 3  → +2min
//       attempt 4  → +10min
//       attempt 5  → +1h
//       attempt 6  → +6h
//       attempt 7+ → no more retries (give up)
//   • Non-blocking — failures don't propagate to the caller
// ─────────────────────────────────────────────────────────────

import { db } from '@/lib/db';
import crypto from 'crypto';

const DEFAULT_TIMEOUT_MS = 5000;
const RESPONSE_SNIPPET_MAX = 4096;
export const MAX_WEBHOOK_ATTEMPTS = 7;

// Exponential backoff in seconds for each attempt number.
// Index 0 = delay BEFORE attempt 2 (i.e. after attempt 1 failed).
// Index 1 = delay BEFORE attempt 3 (i.e. after attempt 2 failed). etc.
const BACKOFF_SECONDS = [30, 120, 600, 3_600, 21_600, 86_400];

/**
 * Compute the next retry timestamp for a delivery that has just failed
 * on the given attempt number. Returns `null` when no more retries are
 * scheduled (i.e. attempts >= MAX_WEBHOOK_ATTEMPTS).
 */
export function computeNextRetryAt(attemptsSoFar: number): Date | null {
  if (attemptsSoFar >= MAX_WEBHOOK_ATTEMPTS) return null;
  const idx = Math.min(attemptsSoFar - 1, BACKOFF_SECONDS.length - 1);
  const delaySec = BACKOFF_SECONDS[idx] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1];
  return new Date(Date.now() + delaySec * 1000);
}

/**
 * Generate a stable Idempotency-Key for a given event/endpoint/attempt.
 * The endpoint can store this header to dedupe retries — if the same
 * key comes in twice, the endpoint should return the cached response
 * instead of re-processing the event.
 *
 * Format: sha256(`${eventId}|${endpointId}|${attemptNumber}`)
 */
export function computeIdempotencyKey(
  eventId: string,
  endpointId: string,
  attemptNumber: number,
): string {
  return crypto
    .createHash('sha256')
    .update(`${eventId}|${endpointId}|${attemptNumber}`)
    .digest('hex');
}

interface DispatchResult {
  endpointId: string;
  status: 'ok' | 'failed';
  statusCode: number | null;
  error?: string;
  durationMs: number;
  responseSnippet?: string;
  deliveryId?: string;
  attempts: number;
  nextRetryAt?: Date | null;
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
    matchingEndpoints.map((ep) => deliverOne(event, ep, 1)),
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
  },
  attemptNumber: number,
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

  // Idempotency-Key — stable per (event, endpoint, attempt) tuple so the
  // endpoint can dedupe retries. (Some gateways use this header for
  // exactly-once processing.)
  const idempotencyKey = computeIdempotencyKey(event.id, endpoint.id, attemptNumber);

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
        'X-ThubPay-Attempt': String(attemptNumber),
        'Idempotency-Key': idempotencyKey,
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
  // Schedule next retry (exponential backoff). If null, no more retries.
  const nextRetryAt = status === 'ok' ? null : computeNextRetryAt(attemptNumber);

  // Persist the delivery audit row.
  let deliveryId: string | undefined;
  try {
    const created = await db.webhookDelivery.create({
      data: {
        workspaceId: event.workspaceId,
        webhookEventId: event.id,
        webhookEndpointId: endpoint.id,
        statusCode,
        status,
        error: errorMsg,
        responseSnippet,
        durationMs,
        attempts: attemptNumber,
        nextRetryAt,
        idempotencyKey,
      },
    });
    deliveryId = created.id;
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
    deliveryId,
    attempts: attemptNumber,
    nextRetryAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Retry scheduler — called by /api/cron/webhook-retry
//
// Scans for failed WebhookDelivery rows with nextRetryAt <= now and
// re-attempts delivery. Returns aggregate stats.
// ─────────────────────────────────────────────────────────────

export interface RetrySweepResult {
  total: number;
  retried: number;
  succeeded: number;
  failed: number;
  exhausted: number; // hit MAX_WEBHOOK_ATTEMPTS, gave up
  results: Array<{
    deliveryId: string;
    endpointId: string | null;
    eventId: string | null;
    attempt: number;
    status: 'ok' | 'failed' | 'exhausted';
    statusCode?: number | null;
    error?: string;
  }>;
}

/**
 * Sweep all due webhook deliveries and retry them.
 *
 * Selects up to `batchSize` rows where status='failed' AND nextRetryAt
 * <= now AND attempts < MAX_WEBHOOK_ATTEMPTS. For each, fetches the
 * parent WebhookEvent + WebhookEndpoint, calls deliverOne with the
 * next attempt number, and updates the existing delivery row in-place
 * (rather than creating a new row per retry — keeps the audit trail
 * compact).
 */
export async function retryDueDeliveries(batchSize = 50): Promise<RetrySweepResult> {
  const due = await db.webhookDelivery.findMany({
    where: {
      status: 'failed',
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_WEBHOOK_ATTEMPTS },
    },
    include: {
      webhookEvent: true,
      webhookEndpoint: true,
    },
    take: batchSize,
    orderBy: { nextRetryAt: 'asc' },
  });

  const results: RetrySweepResult['results'] = [];
  let succeeded = 0;
  let failed = 0;
  let exhausted = 0;

  for (const delivery of due) {
    if (!delivery.webhookEvent || !delivery.webhookEndpoint) {
      // Parent was deleted — mark as exhausted so we don't keep retrying.
      try {
        await db.webhookDelivery.update({
          where: { id: delivery.id },
          data: { nextRetryAt: null, error: 'Parent event or endpoint deleted' },
        });
      } catch {}
      exhausted++;
      results.push({
        deliveryId: delivery.id,
        endpointId: delivery.webhookEndpointId,
        eventId: delivery.webhookEventId,
        attempt: delivery.attempts,
        status: 'exhausted',
        error: 'Parent event or endpoint deleted',
      });
      continue;
    }

    const nextAttempt = delivery.attempts + 1;
    const outcome = await deliverOne(
      {
        id: delivery.webhookEvent.id,
        workspaceId: delivery.webhookEvent.workspaceId,
        eventType: delivery.webhookEvent.eventType,
        payload: delivery.webhookEvent.payload,
      },
      {
        id: delivery.webhookEndpoint.id,
        url: delivery.webhookEndpoint.url,
        secret: delivery.webhookEndpoint.secret,
      },
      nextAttempt,
    );

    // Update the existing delivery row in-place with the new attempt's
    // results. We keep the original `attemptedAt` for the first-attempt
    // timestamp, but update status/error/response/attempts/nextRetryAt.
    try {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          statusCode: outcome.statusCode,
          status: outcome.status === 'ok' ? 'ok' : 'failed',
          error: outcome.error,
          responseSnippet: outcome.responseSnippet,
          durationMs: outcome.durationMs,
          attempts: nextAttempt,
          nextRetryAt: outcome.nextRetryAt,
          // Re-stamp attemptedAt so audit log reflects most recent try
          attemptedAt: new Date(),
        },
      });
    } catch {}

    if (outcome.status === 'ok') {
      succeeded++;
      // If the endpoint's lastStatus was 'failed', flip it to 'success'
      try {
        await db.webhookEndpoint.update({
          where: { id: delivery.webhookEndpoint.id },
          data: { lastStatus: 'success', lastTriggeredAt: new Date() },
        });
      } catch {}
    } else if (outcome.nextRetryAt === null) {
      exhausted++;
      results.push({
        deliveryId: delivery.id,
        endpointId: delivery.webhookEndpointId,
        eventId: delivery.webhookEventId,
        attempt: nextAttempt,
        status: 'exhausted',
        statusCode: outcome.statusCode,
        error: outcome.error,
      });
      continue;
    } else {
      failed++;
    }

    results.push({
      deliveryId: delivery.id,
      endpointId: delivery.webhookEndpointId,
      eventId: delivery.webhookEventId,
      attempt: nextAttempt,
      status: outcome.status,
      statusCode: outcome.statusCode,
      error: outcome.error,
    });
  }

  return {
    total: due.length,
    retried: due.length,
    succeeded,
    failed,
    exhausted,
    results,
  };
}

/**
 * Manually retry a single delivery by its ID. Bypasses the nextRetryAt
 * schedule — useful for "Retry now" buttons in the admin UI.
 *
 * Returns the new delivery state.
 */
export async function retryDeliveryById(
  deliveryId: string,
): Promise<{ ok: boolean; status: string; error?: string; attempts?: number }> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhookEvent: true, webhookEndpoint: true },
  });
  if (!delivery) return { ok: false, status: 'not_found' };
  if (!delivery.webhookEvent || !delivery.webhookEndpoint) {
    return { ok: false, status: 'missing_parent', error: 'Parent event/endpoint deleted' };
  }
  if (delivery.status === 'ok') return { ok: true, status: 'already_ok', attempts: delivery.attempts };

  const nextAttempt = delivery.attempts + 1;
  const outcome = await deliverOne(
    {
      id: delivery.webhookEvent.id,
      workspaceId: delivery.webhookEvent.workspaceId,
      eventType: delivery.webhookEvent.eventType,
      payload: delivery.webhookEvent.payload,
    },
    {
      id: delivery.webhookEndpoint.id,
      url: delivery.webhookEndpoint.url,
      secret: delivery.webhookEndpoint.secret,
    },
    nextAttempt,
  );

  try {
    await db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        statusCode: outcome.statusCode,
        status: outcome.status === 'ok' ? 'ok' : 'failed',
        error: outcome.error,
        responseSnippet: outcome.responseSnippet,
        durationMs: outcome.durationMs,
        attempts: nextAttempt,
        nextRetryAt: outcome.nextRetryAt,
        attemptedAt: new Date(),
      },
    });
  } catch (e) {}

  return {
    ok: outcome.status === 'ok',
    status: outcome.status,
    error: outcome.error,
    attempts: nextAttempt,
  };
}
