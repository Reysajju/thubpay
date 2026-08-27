// ─────────────────────────────────────────────────────────────
// Auto-Reminder Cron Endpoint
// GET/POST /api/cron/reminder-check
//
// Scans all sent invoices that have NOT been viewed and creates
// reminder notifications for the workspace owner. Three tiers:
//
//   • 1 day after send  → "gentle nudge"
//   • 3 days after send → "follow-up"
//   • 7 days after send → "final reminder" + auto-mark overdue
//
// Idempotent: each (invoiceId, type) pair is checked against the
// `InvoiceReminder` table — never sends the same reminder twice.
//
// In production this would be hit by Vercel Cron / a worker. In
// this demo it's exposed so a frontend "Send Reminders Now" button
// or an external scheduler can trigger it.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const REMINDER_TIERS = [
  { afterHours: 24, type: 'unviewed', label: 'reminder' },
  { afterHours: 72, type: 'followup', label: 'follow-up' },
  { afterHours: 168, type: 'final', label: 'final reminder' },
] as const;

export async function POST(req: NextRequest) {
  return runReminderSweep(req);
}

export async function GET(req: NextRequest) {
  return runReminderSweep(req);
}

async function runReminderSweep(req: NextRequest) {
  // Allow a Bearer token for production use, but tolerate unauthenticated
  // calls in dev (the demo environment has no auth for cron).
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results = {
    scanned: 0,
    remindersSent: 0,
    byTier: { unviewed: 0, followup: 0, final: 0 } as Record<string, number>,
    invoicesMarkedOverdue: 0,
    errors: [] as string[],
  };

  try {
    // Find all sent/viewed invoices that haven't been paid or voided.
    // We only remind on invoices that are NOT yet viewed (link tracking matters!).
    const candidates = await db.invoice.findMany({
      where: {
        sentAt: { not: null },
        status: { in: ['sent', 'viewed', 'overdue'] },
        firstViewedAt: null, // only unviewed invoices
      },
      include: { client: true, workspace: true },
    });
    results.scanned = candidates.length;

    for (const inv of candidates) {
      if (!inv.sentAt) continue;

      const hoursSinceSent = (now.getTime() - inv.sentAt.getTime()) / 3600000;

      for (const tier of REMINDER_TIERS) {
        if (hoursSinceSent < tier.afterHours) continue;

        // Idempotency: have we already sent this tier?
        const already = await db.invoiceReminder.findFirst({
          where: { invoiceId: inv.id, type: tier.type },
          select: { id: true },
        });
        if (already) continue;

        // Send reminder — create notification + record
        const message = buildReminderMessage(tier.type, inv, tier.afterHours);
        try {
          await db.$transaction([
            db.notification.create({
              data: {
                workspaceId: inv.workspaceId,
                title: `Invoice ${tier.label} — ${inv.invoiceNumber || inv.id.slice(0, 8)}`,
                body: message,
                type: tier.type === 'final' ? 'warning' : 'info',
              },
            }),
            db.invoiceReminder.create({
              data: {
                invoiceId: inv.id,
                workspaceId: inv.workspaceId,
                type: tier.type,
                message,
              },
            }),
          ]);

          results.remindersSent++;
          results.byTier[tier.type] = (results.byTier[tier.type] ?? 0) + 1;

          // On the "final" tier (7 days), auto-mark as overdue if not already.
          if (tier.type === 'final' && inv.status !== 'overdue') {
            await db.invoice.update({
              where: { id: inv.id },
              data: { status: 'overdue' },
            });
            results.invoicesMarkedOverdue++;
          }
        } catch (err: any) {
          results.errors.push(`${inv.id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    results.errors.push(`sweep error: ${err.message}`);
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    ...results,
  });
}

function buildReminderMessage(
  type: string,
  inv: {
    invoiceNumber: string | null;
    id: string;
    totalCents: number;
    currency: string;
    sentAt: Date | null;
    client: { name: string | null; email: string | null } | null;
    workspace: { name: string | null } | null;
  },
  afterHours: number
): string {
  const invoiceLabel = inv.invoiceNumber || inv.id.slice(0, 8);
  const clientLabel = inv.client?.name || inv.client?.email || 'your client';
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: inv.currency || 'USD',
  }).format(inv.totalCents / 100);
  const daysSent = Math.floor(afterHours / 24);

  switch (type) {
    case 'unviewed':
      return `${invoiceLabel} (${amount}) sent to ${clientLabel} hasn't been opened in 1 day. Consider following up.`;
    case 'followup':
      return `${invoiceLabel} (${amount}) is still unopened after ${daysSent} days. Time for a personal nudge.`;
    case 'final':
      return `${invoiceLabel} (${amount}) is now ${daysSent} days past send and remains unopened. Marked as overdue. Payment link: /pay/${inv.id}`;
    default:
      return `${invoiceLabel} reminder`;
  }
}
