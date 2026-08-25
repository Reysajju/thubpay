// ─────────────────────────────────────────────────────────────
// Invoice Link Tracking Pixel
// GET /api/public/invoice/track/{token}?t=<cache-buster>
//
// • Looks up an invoice by its public `trackingToken` (NOT the invoice id).
// • Records an `InvoiceView` row + rolls up firstViewedAt / lastViewedAt /
//   viewCount on the invoice.
// • On the FIRST view, transitions a `sent` invoice to `viewed` and emits a
//   notification to the workspace owner ("Client viewed invoice …").
// • Returns a 1×1 transparent GIF so it can be embedded as an <img> tag
//   inside the public invoice / pay page without breaking layout.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 1×1 transparent GIF (base64-decoded). Tiny as possible so we don't bloat
// the client invoice page.
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
}

function summarizeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown';
  let browser = 'Unknown';
  let os = 'Unknown';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  if (/Windows NT 10/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  return `${browser} · ${os}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 16) {
    // Still return the pixel so the <img> doesn't show broken — but record nothing.
    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  try {
    const invoice = await db.invoice.findUnique({
      where: { trackingToken: token },
      include: { client: true },
    });

    if (!invoice) {
      // Token doesn't match — return pixel without recording anything.
      return new NextResponse(TRACKING_PIXEL, {
        status: 200,
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || null;
    const referrer = req.headers.get('referer') || req.headers.get('referrer') || null;
    const locationSummary = summarizeUserAgent(userAgent);

    // Persist one row per view (full audit trail).
    await db.invoiceView.create({
      data: {
        invoiceId: invoice.id,
        ipAddress: ip,
        userAgent,
        referrer,
        location: locationSummary,
      },
    });

    const now = new Date();
    const isFirstView = !invoice.firstViewedAt;

    // Roll up totals on the invoice row.
    await db.invoice.update({
      where: { id: invoice.id },
      data: {
        firstViewedAt: invoice.firstViewedAt ?? now,
        lastViewedAt: now,
        viewCount: { increment: 1 },
        lastViewerIp: ip,
        lastViewerUserAgent: userAgent,
        lastViewerLocation: locationSummary,
        // Auto-transition 'sent' → 'viewed' on first view (does not regress paid/overdue).
        status: isFirstView && invoice.status === 'sent' ? 'viewed' : invoice.status,
      },
    });

    // On the very first view, notify the workspace owner.
    if (isFirstView) {
      try {
        await db.notification.create({
          data: {
            workspaceId: invoice.workspaceId,
            title: 'Client opened your invoice',
            body: `${invoice.invoiceNumber || invoice.id.slice(0, 8)} was just viewed${
              invoice.client?.name ? ` by ${invoice.client.name}` : ''
            }${ip ? ` from ${ip}` : ''}.`,
            type: 'payment',
          },
        });
      } catch {
        // Non-fatal — pixel must succeed even if notification write fails.
      }

      // ── Emit a webhook event (invoice.viewed) ──
      // Lets developers wire up Slack, Discord, Zapier, custom scripts, etc.
      try {
        const eventPayload = {
          event: 'invoice.viewed',
          timestamp: now.toISOString(),
          data: {
            invoice_id: invoice.id,
            invoice_number: invoice.invoiceNumber,
            workspace_id: invoice.workspaceId,
            client_id: invoice.clientId,
            client_name: invoice.client?.name ?? null,
            client_email: invoice.client?.email ?? null,
            total_cents: invoice.totalCents,
            currency: invoice.currency,
            status: 'viewed',
            view: {
              ip_address: ip,
              user_agent: userAgent,
              referrer,
              location: locationSummary,
            },
          },
        };
        const webhookEvent = await db.webhookEvent.create({
          data: {
            workspaceId: invoice.workspaceId,
            eventType: 'invoice.viewed',
            gateway: null,
            status: 'success',
            payload: JSON.stringify(eventPayload),
          },
        });

        // Fan out to all configured WebhookEndpoints asynchronously.
        // Don't await — the tracking pixel must respond immediately.
        // The dispatcher handles its own audit + error reporting.
        import('@/lib/webhook-dispatch')
          .then((m) => m.dispatchWebhookEvent(webhookEvent.id))
          .catch(() => {
            // Non-fatal — delivery failures are recorded as WebhookDelivery rows.
          });
      } catch {
        // Non-fatal — pixel must succeed even if webhook write fails.
      }
    }
  } catch (err) {
    console.error('[api/public/invoice/track]', err);
    // Still return the pixel — the <img> tag must resolve regardless.
  }

  return new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
