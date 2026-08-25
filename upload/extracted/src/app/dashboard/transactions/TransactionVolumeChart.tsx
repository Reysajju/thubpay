'use client';

import { useMemo } from 'react';

interface DataPoint {
  date: string;
  volume: number;
  count: number;
  failed: number;
}

interface Props {
  data: DataPoint[];
}

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

export default function TransactionVolumeChart({ data }: Props) {
  const maxVolume = useMemo(() => {
    const max = Math.max(...data.map((d) => d.volume), 0);
    return max > 0 ? max : 1;
  }, [data]);

  const totalVolume = useMemo(
    () => data.reduce((s, d) => s + d.volume, 0),
    [data]
  );
  const totalCount = useMemo(
    () => data.reduce((s, d) => s + d.count, 0),
    [data]
  );
  const totalFailed = useMemo(
    () => data.reduce((s, d) => s + d.failed, 0),
    [data]
  );

  // Show every Nth label depending on data length
  const labelInterval = data.length > 20 ? Math.ceil(data.length / 8) : data.length > 10 ? 2 : 1;

  return (
    <div className="glass-card rounded-2xl p-5 animate-fadeIn">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#10B981]/10">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            Transaction Volume
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">Last 30 days</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Volume</p>
            <p className="text-sm font-black text-green-400">{toUsd(totalVolume)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Payments</p>
            <p className="text-sm font-black text-white">{totalCount}</p>
          </div>
          {totalFailed > 0 && (
            <div>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Failed</p>
              <p className="text-sm font-black text-red-400">{totalFailed}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="relative h-40 flex items-end gap-0.5">
        {data.map((d, i) => {
          const heightPct = (d.volume / maxVolume) * 100;
          const showLabel = i % labelInterval === 0 || i === data.length - 1;
          return (
            <div
              key={i}
              className="flex-1 group relative flex flex-col justify-end"
              style={{ minWidth: '4px' }}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-[#1a1a1f] border border-[#252529] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                  <p className="text-[10px] font-bold text-zinc-300">{d.date}</p>
                  <p className="text-[11px] text-green-400 font-semibold">{toUsd(d.volume)}</p>
                  <p className="text-[10px] text-zinc-500">{d.count} payment{d.count !== 1 ? 's' : ''}</p>
                  {d.failed > 0 && (
                    <p className="text-[10px] text-red-400">{d.failed} failed</p>
                  )}
                </div>
              </div>

              {/* Bar */}
              <div
                className={`w-full rounded-t transition-all duration-300 ${
                  d.volume > 0
                    ? 'bg-gradient-to-t from-[#10B981]/40 to-[#10B981]/80 group-hover:from-[#10B981]/60 group-hover:to-[#34D399]'
                    : 'bg-[#1a1a1f]'
                }`}
                style={{
                  height: `${Math.max(heightPct, d.volume > 0 ? 3 : 1)}%`,
                  minHeight: '2px',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2">
        {data.map((d, i) => {
          const showLabel = i % labelInterval === 0 || i === data.length - 1;
          if (!showLabel) return <div key={i} className="flex-1" />;
          return (
            <div key={i} className="flex-1 text-center">
              <span className="text-[9px] text-zinc-600">{d.date}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-[#252529]/40">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-[#10B981]/40 to-[#10B981]/80" />
          <span className="text-[10px] text-zinc-500">Succeeded volume</span>
        </div>
      </div>
    </div>
  );
}
