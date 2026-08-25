'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import { LineChart, TrendingUp } from 'lucide-react';

/* ──────────────────────────────────────────────────────────
   RevenueForecastWidget
   - Least-squares linear regression over daily historical revenue
   - Projects next 14 days with a 95% prediction-interval band
   - Pure client-side, no new API calls
   ────────────────────────────────────────────────────────── */

interface HistoricalPoint {
  date: string;
  amount: number; // cents
}

interface RevenueForecastWidgetProps {
  historicalData: HistoricalPoint[];
}

interface ChartPoint {
  date: string;
  label: string;
  historical: number | null;
  forecast: number | null;
  band: [number, number] | null; // [lower, upper]
  isForecast: boolean;
}

interface ForecastPoint {
  date: string;
  forecast: number;
  lower: number;
  upper: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  residualStdDev: number;
  xMean: number;
  ssDev: number; // Σ(x_i − xMean)²
  N: number;
}

const FORECAST_DAYS = 14;
const MIN_HISTORY_DAYS = 5;

/* ── helpers ───────────────────────────────────────────── */

function formatCurrencyFull(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function formatCurrencyAxis(cents: number): string {
  const v = cents || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function formatDateLabel(dateStr: string): string {
  // dateStr may be "yyyy-mm-dd" or an ISO timestamp
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function addDays(dateStr: string, days: number): string {
  const base = new Date(dateStr);
  // Use UTC manipulation to avoid timezone drift when source is "yyyy-mm-dd"
  const iso = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days)
  );
  return iso.toISOString().slice(0, 10);
}

/* ── regression math ────────────────────────────────────
   For N points (x_i, y_i), x_i = 0..N-1, y_i = amount (cents):
     slope     = (N·Σ(xy) − Σx·Σy) / (N·Σ(x²) − (Σx)²)
     intercept = (Σy − slope·Σx) / N
     residualStdDev = sqrt(Σ(y_i − predicted_i)² / (N − 2))   (0 if N < 3)
   Prediction interval margin for forecast day j:
     margin = 1.96 · residualStdDev · sqrt(1 + 1/N + (j − xMean)² / Σ(x_i − xMean)²)
   Caps:
     upper = min(forecast · 2, forecast + margin)
     lower = max(0, forecast − margin)
   ─────────────────────────────────────────────────────── */

function runRegression(history: HistoricalPoint[]): RegressionResult | null {
  const N = history.length;
  if (N === 0) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < N; i++) {
    const x = i;
    const y = history[i].amount;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = N * sumX2 - sumX * sumX;
  // No variance in x (all dates identical) → degenerate
  if (denom === 0) return null;

  const slope = (N * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / N;
  const xMean = sumX / N;

  let ssDev = 0;
  for (let i = 0; i < N; i++) {
    ssDev += (i - xMean) * (i - xMean);
  }

  // Residual standard deviation (only valid for N >= 3)
  let residualStdDev = 0;
  if (N >= 3) {
    let ssRes = 0;
    for (let i = 0; i < N; i++) {
      const predicted = intercept + slope * i;
      ssRes += (history[i].amount - predicted) ** 2;
    }
    residualStdDev = Math.sqrt(ssRes / (N - 2));
  }

  return { slope, intercept, residualStdDev, xMean, ssDev, N };
}

function forecastForDay(reg: RegressionResult, j: number): {
  forecast: number;
  lower: number;
  upper: number;
} {
  const forecast = Math.max(0, reg.intercept + reg.slope * j);
  const leverage =
    reg.ssDev > 0
      ? Math.sqrt(1 + 1 / reg.N + ((j - reg.xMean) ** 2) / reg.ssDev)
      : Math.sqrt(1 + 1 / reg.N);
  const margin = 1.96 * reg.residualStdDev * leverage;
  let upper = forecast + margin;
  let lower = forecast - margin;
  upper = Math.min(forecast * 2, Math.max(0, upper));
  lower = Math.max(0, lower);
  // Make sure lower ≤ forecast ≤ upper
  if (lower > forecast) lower = forecast;
  if (upper < forecast) upper = forecast;
  return { forecast, lower, upper };
}

/* ── custom tooltip ─────────────────────────────────────── */

type ForecastTooltipPayload = {
  dataKey?: string | number;
  value?: number | Array<number>;
  color?: string;
  name?: string;
};

function ForecastTooltip(
  props: TooltipProps<number, string>
) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;

  const castPayload = payload as unknown as ForecastTooltipPayload[];

  const histEntry = castPayload.find((p) => p.dataKey === 'historical');
  const fcEntry = castPayload.find((p) => p.dataKey === 'forecast');
  const bandEntry = castPayload.find((p) => p.dataKey === 'band');

  const isForecast = !histEntry && (!!fcEntry || !!bandEntry);

  const value: number | undefined =
    histEntry && typeof histEntry.value === 'number'
      ? histEntry.value
      : fcEntry && typeof fcEntry.value === 'number'
      ? fcEntry.value
      : undefined;

  let band: [number, number] | null = null;
  if (bandEntry && Array.isArray(bandEntry.value) && bandEntry.value.length === 2) {
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
      <div style={{ color: '#a1a1aa', marginBottom: '4px', fontSize: '11px' }}>
        {label}
      </div>
      {isForecast && (
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
      )}
      {typeof value === 'number' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '2px',
              background: isForecast ? '#F59E0B' : '#10B981',
              display: 'inline-block',
            }}
          />
          <span style={{ color: '#fafafa', fontWeight: 600 }}>
            {isForecast ? 'Forecast' : 'Revenue'}
          </span>
          <span style={{ color: '#fafafa', marginLeft: 'auto', fontWeight: 700 }}>
            {formatCurrencyFull(value)}
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

export default function RevenueForecastWidget({
  historicalData,
}: RevenueForecastWidgetProps) {
  const computed = useMemo(() => {
    if (!historicalData || historicalData.length < MIN_HISTORY_DAYS) {
      return null;
    }
    const reg = runRegression(historicalData);
    if (!reg) return null;

    const mean = historicalData.reduce((s, p) => s + p.amount, 0) / reg.N;
    // Degenerate empty-data guard: flat zero history
    if (Math.abs(reg.slope) < 1 && mean === 0) return null;

    const lastDate = historicalData[historicalData.length - 1].date;

    // Forecast points for next FORECAST_DAYS days (j = N, N+1, ..., N+13)
    const forecast: ForecastPoint[] = [];
    for (let k = 1; k <= FORECAST_DAYS; k++) {
      const j = reg.N - 1 + k; // day index
      const { forecast: f, lower, upper } = forecastForDay(reg, j);
      forecast.push({
        date: addDays(lastDate, k),
        forecast: f,
        lower,
        upper,
      });
    }

    const projectedTotal = forecast.reduce((s, p) => s + p.forecast, 0);

    // Build chart data: historical + forecast
    const chartData: ChartPoint[] = [
      ...historicalData.map((d) => ({
        date: d.date,
        label: formatDateLabel(d.date),
        historical: d.amount,
        forecast: null as number | null,
        band: null as [number, number] | null,
        isForecast: false,
      })),
      ...forecast.map((p) => ({
        date: p.date,
        label: formatDateLabel(p.date),
        historical: null as number | null,
        forecast: p.forecast,
        band: [p.lower, p.upper] as [number, number],
        isForecast: true,
      })),
    ];

    // "Today" divider — sits at the boundary between last historical and first forecast
    const todayLabel = formatDateLabel(lastDate);

    return {
      projectedTotal,
      forecast,
      chartData,
      todayLabel,
      reg,
    };
  }, [historicalData]);

  /* ── empty state ─────────────────────────────────────── */
  if (!computed) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Revenue Forecast</h2>
            <p className="text-[11px] text-zinc-500">14-day projection</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-6 h-6 text-amber-400/70" />
          </div>
          <p className="text-sm font-semibold text-zinc-300 mb-1">
            Need at least 5 days of data to forecast
          </p>
          <p className="text-xs text-zinc-500 max-w-sm">
            Once you have 5+ days of historical revenue, this card will project
            the next 14 days using a least-squares trend line with a confidence
            band.
          </p>
        </div>
      </div>
    );
  }

  const { projectedTotal, chartData, todayLabel, reg } = computed;

  return (
    <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
      {/* header */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Revenue Forecast</h2>
            <p className="text-[11px] text-zinc-500">
              14-day least-squares projection
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">
            Projected 14-day Revenue
          </p>
          <p className="text-xl sm:text-2xl font-black text-amber-300 leading-none">
            {formatCurrencyFull(projectedTotal)}
          </p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Based on {reg.N} days of historical data
          </p>
        </div>
      </div>

      {/* legend strip */}
      <div className="flex items-center gap-4 mb-3 text-[11px] text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ background: '#10B981' }}
          />
          Historical
        </span>
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
          95% band
        </span>
      </div>

      {/* chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="rfcHistGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
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

          {/* Today divider */}
          <ReferenceLine
            x={todayLabel}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
            label={{
              value: 'Today',
              position: 'top',
              fill: '#F59E0B',
              fontSize: 10,
              fontWeight: 600,
            }}
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

          {/* Historical area */}
          <Area
            type="monotone"
            dataKey="historical"
            stroke="#10B981"
            strokeWidth={2}
            fill="url(#rfcHistGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#10B981', stroke: '#131316', strokeWidth: 1 }}
            isAnimationActive={false}
            connectNulls={false}
          />

          {/* Forecast dashed line */}
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#F59E0B"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: '#F59E0B', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: '#F59E0B', stroke: '#131316', strokeWidth: 1 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
