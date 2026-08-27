'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   RevenueForecastWidget
   - Fetches its forecast from the server-side endpoint
     GET /api/dashboard/analytics/revenue-forecast?horizon=30
     (weighted blend: 40% linear regression + 60% 30-day moving
     average, computed over the last 90 days of succeeded txs).
   - Renders loading skeleton, error card with retry, or the
     chart + summary stats depending on state.
   - The legacy `historicalData` prop is kept for backward
     compatibility with the existing AnalyticsChartsClient
     caller but is now IGNORED — the forecast is computed on
     the server against authoritative transaction data.
   ────────────────────────────────────────────────────────── */

/* ── shared types (mirror the server response shape) ──── */

interface ForecastPoint {
  date: string; // yyyy-mm-dd (UTC)
  forecastCents: number;
  lowerBoundCents: number;
  upperBoundCents: number;
}

interface ForecastSummary {
  totalForecastCents: number;
  averageDailyForecastCents: number;
  trendSlope: number;
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

/* ── legacy prop (deprecated — caller may still pass it) ─ */

interface HistoricalPoint {
  date: string;
  amount: number; // cents
}

interface RevenueForecastWidgetProps {
  /** @deprecated Forecast is now server-computed; this prop is ignored. */
  historicalData?: HistoricalPoint[];
}

interface ChartPoint {
  date: string;
  label: string;
  forecast: number | null;
  band: [number, number] | null; // [lower, upper]
}

const FORECAST_HORIZON = 30;

/* ── helpers ───────────────────────────────────────────── */

function formatCurrencyFull(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function formatCurrencyCompact(cents: number): string {
  const v = cents || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v}`;
}

function formatCurrencyAxis(cents: number): string {
  const v = cents || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatDateLabel(dateStr: string): string {
  // dateStr is "yyyy-mm-dd"
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/* ── confidence-level badge palette ───────────────────── */

const CONFIDENCE_STYLES: Record<
  ForecastSummary['confidenceLevel'],
  { badge: string; label: string }
> = {
  high: {
    badge:
      'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
    label: 'High',
  },
  medium: {
    badge:
      'text-amber-300 bg-amber-500/10 border-amber-500/25',
    label: 'Medium',
  },
  low: {
    badge: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/25',
    label: 'Low',
  },
};

/* ── custom tooltip ─────────────────────────────────────── */

type ForecastTooltipPayload = {
  dataKey?: string | number;
  value?: number | Array<number>;
  color?: string;
  name?: string;
};

function ForecastTooltip(props: TooltipProps<number, string>) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;

  const castPayload = payload as unknown as ForecastTooltipPayload[];

  const fcEntry = castPayload.find((p) => p.dataKey === 'forecast');
  const bandEntry = castPayload.find((p) => p.dataKey === 'band');

  const forecast: number | undefined =
    fcEntry && typeof fcEntry.value === 'number'
      ? fcEntry.value
      : undefined;

  let band: [number, number] | null = null;
  if (
    bandEntry &&
    Array.isArray(bandEntry.value) &&
    bandEntry.value.length === 2
  ) {
    band = [bandEntry.value[0] as number, bandEntry.value[1] as number];
  }

  return (
    <div
      style={{
        backgroundColor: '#131316',
        border: '1px solid #252529',
        borderRadius: '12px',
        color: '#fafafa',
        fontSize: '12px',
        padding: '8px 10px',
        minWidth: '160px',
      }}
    >
      <div
        style={{
          color: '#a1a1aa',
          marginBottom: '4px',
          fontSize: '11px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'inline-block',
          fontSize: '10px',
          fontWeight: 700,
          color: '#F59E0B',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '1px 6px',
          borderRadius: '4px',
          marginBottom: '6px',
        }}
      >
        Forecast
      </div>
      {typeof forecast === 'number' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '2px',
              background: '#F59E0B',
              display: 'inline-block',
            }}
          />
          <span style={{ color: '#fafafa', fontWeight: 600 }}>
            Forecast
          </span>
          <span
            style={{
              color: '#fafafa',
              marginLeft: 'auto',
              fontWeight: 700,
            }}
          >
            {formatCurrencyFull(forecast)}
          </span>
        </div>
      )}
      {band && (
        <div
          style={{
            marginTop: '4px',
            color: '#a1a1aa',
            fontSize: '11px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>Range</span>
          <span style={{ color: '#d4d4d8' }}>
            {formatCurrencyFull(band[0])} – {formatCurrencyFull(band[1])}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── main component ────────────────────────────────────── */

export default function RevenueForecastWidget(
  _props: RevenueForecastWidgetProps = {}
) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        '/api/dashboard/analytics/revenue-forecast?horizon=' +
          FORECAST_HORIZON,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: ForecastResponse = await res.json();
      setData(json);
    } catch {
      setError('Failed to load forecast');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── loading skeleton ─────────────────────────────── */
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn gradient-border-glow">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <LineChart className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Revenue Forecast
              </h2>
              <p className="text-[11px] text-zinc-500">
                {FORECAST_HORIZON}-day server-computed projection
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/70 bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/15">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
            </span>
            <span className="shimmer-text">Live</span>
          </span>
        </div>
        <div className="skeleton-shimmer h-[300px] rounded-xl" />
      </div>
    );
  }

  /* ── error card ───────────────────────────────────── */
  if (error || !data) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn gradient-border-glow">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Revenue Forecast
            </h2>
            <p className="text-[11px] text-zinc-500">
              {FORECAST_HORIZON}-day server-computed projection
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-center py-10 px-4">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 mb-3">
            <AlertCircle className="w-4 h-4 text-red-400" aria-hidden />
          </span>
          <p className="text-sm text-zinc-200 font-medium">
            {error || 'Failed to load forecast'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-sm">
            The server-side forecast endpoint could not be reached.
            Check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 focus-ring-emerald"
          >
            <RefreshCw className="w-3 h-3 icon-bounce" />
            Click to retry
          </button>
        </div>
      </div>
    );
  }

  /* ── empty state (no forecast data) ──────────────── */
  if (data.forecast.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn gradient-border-glow">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Revenue Forecast
            </h2>
            <p className="text-[11px] text-zinc-500">
              {FORECAST_HORIZON}-day server-computed projection
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center skeleton-pulse">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-amber-400/70" />
          </div>
          <p className="text-sm font-semibold text-zinc-300 mb-1">
            Need at least a few days of payment history to forecast
          </p>
          <p className="text-xs text-zinc-500 max-w-sm">
            Once you have succeeded transactions in the last 180 days,
            this card will project the next {FORECAST_HORIZON} days
            using a 40% linear-regression / 60% 30-day moving-average
            blend with a ±20% confidence band.
          </p>
        </div>
      </div>
    );
  }

  /* ── success state: render chart + summary ───────── */
  const chartData: ChartPoint[] = data.forecast.map((p) => ({
    date: p.date,
    label: formatDateLabel(p.date),
    forecast: p.forecastCents,
    band: [p.lowerBoundCents, p.upperBoundCents],
  }));

  const { summary } = data;
  const confStyle = CONFIDENCE_STYLES[summary.confidenceLevel];
  const TrendIcon =
    summary.trendDirection === 'up'
      ? TrendingUp
      : summary.trendDirection === 'down'
        ? TrendingDown
        : Minus;
  const trendColor =
    summary.trendDirection === 'up'
      ? 'text-emerald-400'
      : summary.trendDirection === 'down'
        ? 'text-red-400'
        : 'text-zinc-400';

  return (
    <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn gradient-border-glow">
      {/* header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Revenue Forecast
            </h2>
            <p className="text-[11px] text-zinc-500">
              {data.horizon}-day server-computed projection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${confStyle.badge}`}
            title={`Confidence based on 90-day transaction volume and trend slope`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="shimmer-text">Live</span>
            <span className="opacity-50">·</span>
            {confStyle.label} confidence
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-black/20 px-2 py-0.5 rounded-full border border-[#252529]/60">
            server-computed
          </span>
        </div>
      </div>

      {/* summary stats ribbon */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-black/20 border border-[#252529]/60">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Projected {data.horizon}-day Revenue
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-300 leading-none">
            {formatCurrencyFull(summary.totalForecastCents)}
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529]" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Avg / day
          </p>
          <p className="text-sm font-bold text-white leading-none">
            {formatCurrencyCompact(summary.averageDailyForecastCents)}
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529]" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Trend
          </p>
          <p
            className={`text-sm font-bold leading-none inline-flex items-center gap-1 ${trendColor}`}
          >
            <TrendIcon className="w-3.5 h-3.5 icon-bounce" />
            {summary.trendDirection}
            <span className="text-zinc-500 font-normal">
              {' '}
              · {summary.trendSlope >= 0 ? '+' : ''}
              {formatCurrencyCompact(Math.round(summary.trendSlope))}/d
            </span>
          </p>
        </div>
        <div className="h-8 w-px bg-[#252529] hidden sm:block" />
        <div className="min-w-0 hidden sm:block">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            MA 30 / 90
          </p>
          <p className="text-sm font-bold text-white leading-none">
            {formatCurrencyCompact(summary.thirtyDayMACents)}
            <span className="text-zinc-500 font-normal"> / </span>
            {formatCurrencyCompact(summary.ninetyDayMACents)}
          </p>
        </div>
      </div>

      {/* legend strip */}
      <div className="flex items-center gap-4 mb-3 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-[2px]"
            style={{
              background:
                'repeating-linear-gradient(90deg, #F59E0B 0 4px, transparent 4px 8px)',
            }}
          />
          Forecast
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ background: 'rgba(245, 158, 11, 0.25)' }}
          />
          ±20% confidence band
        </span>
      </div>

      {/* chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="rfcBandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#252529" />
          <XAxis
            dataKey="label"
            stroke="#52525b"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v) => formatCurrencyAxis(v as number)}
            stroke="#52525b"
            tick={{ fontSize: 11 }}
            width={48}
          />
          <Tooltip
            content={<ForecastTooltip />}
            cursor={{ stroke: '#52525b', strokeDasharray: '3 3' }}
          />

          {/* Confidence band (range area: [lower, upper]) */}
          <Area
            dataKey="band"
            stroke="none"
            fill="url(#rfcBandGradient)"
            fillOpacity={1}
            isAnimationActive={false}
            connectNulls
            dot={false}
            activeDot={false}
          />

          {/* Forecast dashed line */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#F59E0B"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#F59E0B', r: 3, strokeWidth: 0 }}
            activeDot={{
              r: 4,
              fill: '#F59E0B',
              stroke: '#131316',
              strokeWidth: 1,
            }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* methodology footer */}
      <div className="mt-4 pt-3 border-t border-[#252529]/60 flex items-center justify-between gap-3 text-[10px] text-zinc-500 flex-wrap">
        <span>
          <span className="font-semibold text-zinc-400">
            Methodology:
          </span>{' '}
          {data.methodology}
        </span>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors focus-ring-emerald rounded-md"
        >
          <RefreshCw className="w-3 h-3 icon-bounce" />
          Refresh
        </button>
      </div>
    </div>
  );
}
