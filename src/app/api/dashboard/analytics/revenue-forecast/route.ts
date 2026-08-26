import { NextResponse } from 'next/server';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Vercel serverless timeout hint. The 180-day Prisma query + regression
// math should comfortably finish within a few seconds on any reasonable
// workspace, but allow headroom for slow DB connections.
export const maxDuration = 30;

/* ──────────────────────────────────────────────────────────
   GET /api/dashboard/analytics/revenue-forecast?horizon=30

   Server-side 30-day (default) revenue forecast for the
   authenticated workspace. Replaces the previous client-side
   naive-linear-regression in RevenueForecastWidget.

   Algorithm:
   1. Load every `succeeded` transaction in the workspace for
      the last 180 days.
   2. Bucket by UTC day → daily totals (cents).
   3. Fill missing days with 0 → continuous 180-day time series.
   4. Compute:
      - 30-day moving average (recent)
      - 90-day moving average (baseline)
      - Least-squares linear regression on the last 90 days
        → slope + intercept.
   5. For forecast day i (i = 1..horizon):
        forecast[i] = max(0, 0.4 * (slope * (90 + i) + intercept)
                              + 0.6 * thirtyDayMA)
   6. Confidence interval: ±20% bounds (v1 heuristic).
   7. Return { horizon, forecast[], summary, methodology }.
   ────────────────────────────────────────────────────────── */

const DEFAULT_HORIZON = 30;
const MIN_HORIZON = 7;
const MAX_HORIZON = 90;
const HISTORY_DAYS = 180;
const RECENT_WINDOW_DAYS = 30;
const BASELINE_WINDOW_DAYS = 90;
const REGRESSION_WINDOW_DAYS = 90;
const BAND_PCT = 0.20; // ±20% confidence band

interface ForecastPoint {
  date: string; // yyyy-mm-dd (UTC)
  forecastCents: number;
  lowerBoundCents: number;
  upperBoundCents: number;
}

interface ForecastSummary {
  totalForecastCents: number;
  averageDailyForecastCents: number;
  trendSlope: number; // cents per day (rounded to 2 decimals)
  trendDirection: 'up' | 'down' | 'flat';
  thirtyDayMACents: number;
  ninetyDayMACents: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

interface ForecastResponse {
  horizon: number;
  forecast: ForecastPoint[];
  summary: ForecastSummary;
  methodology: string;
}

/* ── helpers ──────────────────────────────────────────── */

function utcDateKey(d: Date): string {
  // yyyy-mm-dd in UTC, zero-padded.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addUtcDays(dateStr: string, days: number): string {
  // dateStr is "yyyy-mm-dd" — parse strictly as UTC midnight.
  const [y, m, d] = dateStr.split('-').map(Number);
  const iso = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return utcDateKey(iso);
}

interface Regression {
  slope: number;
  intercept: number;
}

function leastSquares(values: number[]): Regression {
  const N = values.length;
  if (N === 0) return { slope: 0, intercept: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < N; i++) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = N * sumX2 - sumX * sumX;
  if (denom === 0) {
    // No x variance (e.g. all values collapsed to one point). Fall
    // back to a flat line at the mean so the forecast degrades to a
    // constant rather than a NaN.
    const mean = sumY / N;
    return { slope: 0, intercept: mean };
  }

  const slope = (N * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / N;
  return { slope, intercept };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseHorizon(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return DEFAULT_HORIZON;
  return clamp(Math.trunc(n), MIN_HORIZON, MAX_HORIZON);
}

/* ── main handler ─────────────────────────────────────── */

export async function GET(request: Request) {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    return NextResponse.json(
      { error: ctx.error },
      { status: ctx.status }
    );
  }

  try {
    const horizon = parseHorizon(
      new URL(request.url).searchParams.get('horizon')
    );
    const workspaceId = ctx.context.workspaceId;

    // 1. Load succeeded transactions for the last 180 days.
    const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const transactions = await db.transaction.findMany({
      where: {
        workspaceId,
        status: 'succeeded',
        createdAt: { gte: since },
      },
      select: { amountCents: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // 2. Bucket by UTC day.
    const dailyTotals = new Map<string, number>();
    let ninetyDayTxCount = 0;
    const ninetyDayCutoff =
      Date.now() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    for (const tx of transactions) {
      const key = utcDateKey(tx.createdAt);
      dailyTotals.set(
        key,
        (dailyTotals.get(key) ?? 0) + tx.amountCents
      );
      if (tx.createdAt.getTime() >= ninetyDayCutoff) {
        ninetyDayTxCount += 1;
      }
    }

    // 3. Build a continuous 180-day time series (oldest → newest),
    //    filling missing days with 0.
    const today = new Date();
    const todayKey = utcDateKey(today);
    const seriesKeys: string[] = [];
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - i
        )
      );
      seriesKeys.push(utcDateKey(d));
    }
    const series: number[] = seriesKeys.map(
      (k) => dailyTotals.get(k) ?? 0
    );

    // 4. Moving averages + regression on last 90 days.
    const last30 = series.slice(-RECENT_WINDOW_DAYS);
    const last90 = series.slice(-BASELINE_WINDOW_DAYS);
    const thirtyDayMA = last30.reduce((s, v) => s + v, 0) / last30.length;
    const ninetyDayMA = last90.reduce((s, v) => s + v, 0) / last90.length;
    const regressionInput = series.slice(-REGRESSION_WINDOW_DAYS);
    const { slope, intercept } = leastSquares(regressionInput);

    // 5. Forecast the next `horizon` days.
    const forecast: ForecastPoint[] = [];
    let totalForecast = 0;
    for (let i = 1; i <= horizon; i++) {
      const regressionPart = slope * (REGRESSION_WINDOW_DAYS + i) + intercept;
      const blended = 0.4 * regressionPart + 0.6 * thirtyDayMA;
      const fc = Math.max(0, Math.round(blended));
      const lower = Math.round(fc * (1 - BAND_PCT));
      const upper = Math.round(fc * (1 + BAND_PCT));
      forecast.push({
        date: addUtcDays(todayKey, i),
        forecastCents: fc,
        lowerBoundCents: lower,
        upperBoundCents: upper,
      });
      totalForecast += fc;
    }

    // 6. Summary stats.
    const ninetyDayAvgDaily = ninetyDayMA; // cents/day baseline
    const thresholdCents = ninetyDayAvgDaily * 0.01; // 1% of 90-day average
    let trendDirection: 'up' | 'down' | 'flat' = 'flat';
    if (slope > thresholdCents) trendDirection = 'up';
    else if (slope < -thresholdCents) trendDirection = 'down';

    let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
    if (ninetyDayTxCount >= 30 && slope >= 0) {
      confidenceLevel = 'high';
    } else if (ninetyDayTxCount >= 15) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    const summary: ForecastSummary = {
      totalForecastCents: totalForecast,
      averageDailyForecastCents:
        horizon > 0 ? Math.round(totalForecast / horizon) : 0,
      trendSlope: Math.round(slope * 100) / 100,
      trendDirection,
      thirtyDayMACents: Math.round(thirtyDayMA),
      ninetyDayMACents: Math.round(ninetyDayMA),
      confidenceLevel,
    };

    const body: ForecastResponse = {
      horizon,
      forecast,
      summary,
      methodology:
        'Weighted blend (40% linear regression + 60% 30-day moving average) over the last 90 days of succeeded transactions.',
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error('[api/analytics/revenue-forecast] GET error:', err);
    return NextResponse.json(
      { error: 'Forecast computation failed' },
      { status: 500 }
    );
  }
}
