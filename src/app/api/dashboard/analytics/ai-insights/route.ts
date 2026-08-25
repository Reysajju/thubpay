import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import {
  getMonthlyRevenue,
  getGatewayRevenue,
  getTopCustomers,
} from '@/lib/demo-data';
import ZAI from 'z-ai-web-dev-sdk';

export const dynamic = 'force-dynamic';
// The ZAI SDK call can take a while, and we cache its result for 5 minutes,
// so allow the route to run up to 60s. (Next.js default is 10s on Vercel,
// unlimited on self-hosted — this is just a hint.)
export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────

type InsightSeverity = 'positive' | 'warning' | 'critical' | 'info';

interface AiInsight {
  text: string;
  severity: InsightSeverity;
}

interface AnalyticsSummary {
  period: string;
  totalRevenue: number;
  totalTransactions: number;
  succeeded: number;
  failed: number;
  successRate: number;
  topGateway: { name: string; amount: number; count: number } | null;
  topCustomer: {
    name: string;
    spend: number;
    transactions: number;
  } | null;
  overdueInvoices: number;
  overdueAmount: number;
  gatewayCount: number;
  activeClients: number;
  trend: string;
}

interface CacheEntry {
  insights: AiInsight[];
  generatedAt: string;
  expiresAt: number;
}

// ─── In-memory 5-minute cache (per workspace) ────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const insightCache = new Map<string, CacheEntry>();

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Build a compact, LLM-friendly summary of the workspace's analytics.
 * Reuses the same query layer as the existing analytics endpoints
 * (demo-data.ts + direct Prisma counts) so the numbers match what the
 * charts show.
 */
async function buildSummary(workspaceId: string): Promise<AnalyticsSummary> {
  // 1. Revenue (monthly buckets — sum the last 12 months)
  const monthlyRevenue = await getMonthlyRevenue(workspaceId);
  const totalRevenueCents = monthlyRevenue.reduce((s, d) => s + d.amount, 0);

  // 2. Success / failure counts + trend
  const [succeeded, failed, pending] = await Promise.all([
    db.transaction.count({
      where: { workspaceId, status: 'succeeded' },
    }),
    db.transaction.count({
      where: { workspaceId, status: 'failed' },
    }),
    db.transaction.count({
      where: {
        workspaceId,
        status: { in: ['pending', 'refunded', 'disputed'] },
      },
    }),
  ]);
  const totalTransactions = succeeded + failed + pending;
  const successRate =
    totalTransactions > 0
      ? Number(((succeeded / totalTransactions) * 100).toFixed(1))
      : 0;

  // 3. Gateway revenue (top gateway by amount)
  const gatewayRevenue = await getGatewayRevenue(workspaceId);
  const topGatewayEntry = gatewayRevenue.length
    ? gatewayRevenue.reduce((a, b) => (a.revenue > b.revenue ? a : b))
    : null;
  const topGateway = topGatewayEntry
    ? {
        name: topGatewayEntry.gateway,
        amount: Number((topGatewayEntry.revenue / 100).toFixed(2)),
        count: topGatewayEntry.count,
      }
    : null;

  // 4. Top customer (by lifetime spend)
  const topCustomers = await getTopCustomers(workspaceId);
  const topCustomerRow = topCustomers[0];
  const topCustomer = topCustomerRow
    ? {
        name: topCustomerRow.name,
        spend: Number((topCustomerRow.totalSpend / 100).toFixed(2)),
        transactions: topCustomerRow.transactionCount,
      }
    : null;

  // 5. Overdue invoices (count + total amount)
  const overdueRows = await db.invoice.findMany({
    where: { workspaceId, status: 'overdue' },
    select: { totalCents: true },
  });
  const overdueInvoices = overdueRows.length;
  const overdueAmountCents = overdueRows.reduce((s, r) => s + r.totalCents, 0);

  // 6. Active clients (lifetime clients in this workspace)
  const activeClients = await db.client.count({ where: { workspaceId } });

  // 7. Trend: compare most-recent month vs prior month
  // monthlyRevenue is ordered oldest → newest; last two are current + prior.
  const latest = monthlyRevenue[monthlyRevenue.length - 1]?.amount ?? 0;
  const prior = monthlyRevenue[monthlyRevenue.length - 2]?.amount ?? 0;
  let trend = 'insufficient trend data';
  if (latest > 0 && prior > 0) {
    const pct = ((latest - prior) / prior) * 100;
    const direction = pct >= 0 ? 'grew' : 'dropped';
    const abs = Math.abs(pct).toFixed(1);
    trend = `revenue ${direction} ${abs}% month-over-month`;
  } else if (latest > 0 && prior === 0) {
    trend = 'revenue is fresh — first payments this month';
  }

  return {
    period: 'last 30 days',
    totalRevenue: Number((totalRevenueCents / 100).toFixed(2)),
    totalTransactions,
    succeeded,
    failed,
    successRate,
    topGateway,
    topCustomer,
    overdueInvoices,
    overdueAmount: Number((overdueAmountCents / 100).toFixed(2)),
    gatewayCount: gatewayRevenue.length,
    activeClients,
    trend,
  };
}

/**
 * Minimal structural type for the chat-completion response we get back
 * from `zai.chat.completions.create`. The SDK returns `any`, so we
 * declare a narrow shape and validate before reading.
 */
interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null } | null;
  } | null> | null;
}

/**
 * Ask the LLM for 4-6 short insights in JSON form. Returns the raw
 * string content from the LLM — the caller is responsible for parsing.
 */
async function callLlm(summary: AnalyticsSummary): Promise<string> {
  const zai = await ZAI.create();

  const systemPrompt =
    'You are a payments analyst for ThubPay, a multi-gateway payment platform. ' +
    'Based on the workspace\'s analytics summary, produce 4-6 short, actionable insights in plain English. ' +
    'Each insight should be 1 sentence (max 20 words). ' +
    'Focus on trends, anomalies, opportunities, and risks. ' +
    'Format your response as a JSON array of objects: [{ "text": "...", "severity": "positive|warning|critical|info" }]. ' +
    'No prose outside the JSON array.';

  const userPrompt = JSON.stringify(summary);

  const completion = (await zai.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    thinking: { type: 'disabled' },
  })) as ChatCompletionResponse;

  return completion?.choices?.[0]?.message?.content ?? '';
}

/**
 * Parse the LLM response into structured insights.
 *
 * Strategy:
 * 1. Try strict JSON.parse of the trimmed response.
 * 2. If that fails, try to extract a JSON array via regex
 *    (the LLM sometimes wraps JSON in prose / markdown fences).
 * 3. If that also fails, fall back to splitting on newlines and
 *    stripping bullet / numeric prefixes.
 *
 * Always returns at most 6 insights; never throws.
 */
function parseInsights(raw: string): AiInsight[] {
  const cleaned = raw.trim();
  if (!cleaned) return [];

  // Attempt 1: direct JSON parse
  const direct = tryParseJsonArray(cleaned);
  if (direct.length) return direct.slice(0, 6);

  // Attempt 2: extract first JSON array from the text (handles markdown
  // fences ```json ... ``` or surrounding prose)
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const parsed = tryParseJsonArray(arrayMatch[0]);
    if (parsed.length) return parsed.slice(0, 6);
  }

  // Attempt 3: bullet-line fallback
  return parseBullets(cleaned).slice(0, 6);
}

function tryParseJsonArray(text: string): AiInsight[] {
  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    return data
      .map((item): AiInsight | null => {
        if (!item || typeof item !== 'object') return null;
        const text = typeof item.text === 'string' ? item.text.trim() : '';
        if (!text) return null;
        const severity = normalizeSeverity(item.severity);
        return { text, severity };
      })
      .filter((x): x is AiInsight => x !== null);
  } catch {
    return [];
  }
}

function normalizeSeverity(value: unknown): InsightSeverity {
  if (typeof value !== 'string') return 'info';
  const v = value.toLowerCase();
  if (v === 'positive' || v === 'warning' || v === 'critical' || v === 'info') {
    return v;
  }
  // Lenient mapping for common synonyms the LLM might emit.
  if (v.includes('crit')) return 'critical';
  if (v.includes('warn')) return 'warning';
  if (v.includes('pos') || v.includes('good') || v.includes('success')) {
    return 'positive';
  }
  return 'info';
}

function parseBullets(text: string): AiInsight[] {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*([-•*]|\d+\.)\s*/, '')
        .trim()
    )
    .filter((line) => line.length > 0)
    .map((line) => ({
      text: line.replace(/\.$/, '') + '.', // normalize trailing period
      severity: 'info' as const,
    }));
}

// ─── Route handler ───────────────────────────────────────────

export async function GET() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json(
      { error: ctx.error },
      { status: ctx.status }
    );
  }

  // 403 if the resilient fallback fired (no real workspace membership
  // for a non-demo user). The fallback context still returns ok:true,
  // so we additionally check for the demo placeholder id.
  if (ctx.context.workspaceId === 'ws-demo-workspace') {
    return NextResponse.json(
      { error: 'No active workspace for this account.' },
      { status: 403 }
    );
  }

  const workspaceId = ctx.context.workspaceId;

  // 1. Check the in-memory cache first
  const cached = insightCache.get(workspaceId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return NextResponse.json({
      insights: cached.insights,
      generatedAt: cached.generatedAt,
      cached: true,
    });
  }

  try {
    // 2. Build the analytics summary
    const summary = await buildSummary(workspaceId);

    // 3. Call the LLM
    let insights: AiInsight[] = [];
    try {
      const raw = await callLlm(summary);
      insights = parseInsights(raw);
    } catch (llmErr) {
      console.error('[api/analytics/ai-insights] LLM call failed:', llmErr);
    }

    // 4. Fallback to a single default insight if the LLM produced nothing usable
    if (insights.length === 0) {
      insights = [
        {
          text: 'Analytics data is being processed. Check back shortly.',
          severity: 'info',
        },
      ];
    }

    // 5. Cache and respond
    const generatedAt = new Date().toISOString();
    insightCache.set(workspaceId, {
      insights,
      generatedAt,
      expiresAt: now + CACHE_TTL_MS,
    });

    return NextResponse.json({
      insights,
      generatedAt,
      cached: false,
    });
  } catch (error) {
    console.error('[api/analytics/ai-insights] GET error:', error);
    // Never crash the page — return a single default insight on any
    // unexpected server error.
    return NextResponse.json({
      insights: [
        {
          text: 'Analytics data is being processed. Check back shortly.',
          severity: 'info' as const,
        },
      ],
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  }
}
