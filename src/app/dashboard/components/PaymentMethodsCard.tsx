import Link from 'next/link';
import { CreditCard, ArrowUpRight } from 'lucide-react';

export interface GatewayBreakdown {
  gateway: string;
  count: number;
  volume: number;
}

interface Props {
  breakdown: Record<string, { count: number; volume: number }>;
  totalVolume: number;
}

function toUsdFull(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

// Deterministic color rotation — emerald-family + a couple accent stops
const COLOR_PALETTE: { bar: string; dot: string; text: string }[] = [
  { bar: 'bg-[#10B981]', dot: 'bg-[#10B981]', text: 'text-emerald-400' },
  { bar: 'bg-[#06B6D4]', dot: 'bg-[#06B6D4]', text: 'text-cyan-400' },
  { bar: 'bg-[#a855f7]', dot: 'bg-[#a855f7]', text: 'text-purple-400' },
  { bar: 'bg-[#f59e0b]', dot: 'bg-[#f59e0b]', text: 'text-amber-400' },
  { bar: 'bg-[#ec4899]', dot: 'bg-[#ec4899]', text: 'text-pink-400' },
  { bar: 'bg-[#22d3ee]', dot: 'bg-[#22d3ee]', text: 'text-sky-300' },
  { bar: 'bg-[#84cc16]', dot: 'bg-[#84cc16]', text: 'text-lime-400' },
  { bar: 'bg-[#fb923c]', dot: 'bg-[#fb923c]', text: 'text-orange-400' },
];

function gatewayLabel(slug: string): string {
  const map: Record<string, string> = {
    stripe: 'Stripe',
    paypal: 'PayPal',
    square: 'Square',
    adyen: 'Adyen',
    razorpay: 'Razorpay',
    authorize_net: 'Authorize.Net',
    braintree: 'Braintree',
    mollie: 'Mollie',
    manual: 'Manual',
    custom: 'Custom',
  };
  return map[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default function PaymentMethodsCard({ breakdown, totalVolume }: Props) {
  const entries = Object.entries(breakdown)
    .map(([gateway, data]) => ({
      gateway,
      label: gatewayLabel(gateway),
      count: data.count,
      volume: data.volume,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 6);

  const total = entries.reduce((sum, e) => sum + e.volume, 0);
  const cap = total > 0 ? total : 1;

  return (
    <section className="glass-card rounded-3xl p-4 sm:p-6 animate-fadeIn hover-lift">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/15 to-cyan-500/5 border border-emerald-500/20">
            <CreditCard className="w-4 h-4 text-emerald-400" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-white leading-none">Payment Methods</h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              Volume by gateway · {entries.length} active
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/transactions"
          className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors group"
        >
          Transactions
          <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-10">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#10B981]/10 border border-[#10B981]/20 mb-3">
            <CreditCard className="w-5 h-5 text-[#10B981]/50" />
          </span>
          <p className="text-sm font-semibold text-zinc-300">No transactions yet</p>
          <p className="text-xs text-zinc-600 mt-1">
            Once payments start flowing in, gateway breakdown will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Stacked horizontal bar */}
          <div className="mb-5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-black/30 border border-[#252529]/60">
              {entries.map((e, i) => {
                const pct = (e.volume / cap) * 100;
                if (pct <= 0) return null;
                const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
                return (
                  <div
                    key={e.gateway}
                    className={`${color.bar} h-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                    title={`${e.label}: ${toUsdFull(e.volume)} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-zinc-500">
              <span>
                Total: <span className="text-white font-semibold">{toUsdFull(totalVolume)}</span>
              </span>
              <span>{entries.reduce((s, e) => s + e.count, 0)} transactions</span>
            </div>
          </div>

          {/* Legend + per-gateway rows */}
          <ul className="space-y-2">
            {entries.map((e, i) => {
              const pct = total > 0 ? (e.volume / total) * 100 : 0;
              const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
              return (
                <li
                  key={e.gateway}
                  className={`flex items-center gap-3 py-1.5 animate-stagger stagger-${Math.min(i + 1, 6)}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${color.dot} flex-shrink-0`} aria-hidden />
                  <span className="text-sm font-medium text-zinc-200 flex-shrink-0 w-24 sm:w-28 truncate">
                    {e.label}
                  </span>
                  {/* Mini bar */}
                  <div className="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                    <div
                      className={`${color.bar} h-full rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${color.text} tabular-nums w-12 text-right`}>
                    {pct.toFixed(1)}%
                  </span>
                  <span className="text-xs font-semibold text-white tabular-nums w-16 sm:w-20 text-right hidden sm:block">
                    {toUsdFull(e.volume)}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
