import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import FailedDeliveriesCard from './FailedDeliveriesCard';

export const dynamic = 'force-dynamic';

// Base URL for the webhook endpoints shown to the merchant. Strips any
// trailing slash from NEXTAUTH_URL so the rendered URL is well-formed.
const WEBHOOK_BASE_URL = (
  process.env.NEXTAUTH_URL || 'http://localhost:3000'
).replace(/\/+$/, '');

function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  success: { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/25', icon: '✅' },
  failed: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/25', icon: '❌' },
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25', icon: '⏳' },
};

const GATEWAY_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  square: '⬜',
  adyen: '🔷',
  razorpay: '⚡',
  manual: '✋',
};

export default async function WebhooksPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const [events, gateways] = await Promise.all([
    db.webhookEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.gatewayCredential.findMany({
      where: { workspaceId },
      select: { id: true, gatewaySlug: true, label: true, webhookSecret: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Phase 6: fetch failed deliveries with retry info.
  // Phase 7 #33: take 26 (not 25) so we can detect "has more" without
  // an extra count query — if 26 rows come back, at least one more page
  // of failed deliveries exists on the server. We slice off the 26th
  // row before passing to the client component, and pass hasMoreInitial
  // as a separate prop.
  const failedDeliveries = await db.webhookDelivery.findMany({
    where: {
      workspaceId,
      status: 'failed',
    },
    include: {
      webhookEvent: { select: { eventType: true, gateway: true } },
      webhookEndpoint: { select: { label: true, url: true } },
    },
    orderBy: { attemptedAt: 'desc' },
    take: 26,
  });

  const hasMoreInitial = failedDeliveries.length > 25;
  const initialDeliveries = failedDeliveries.slice(0, 25);

  const stats = {
    total: events.length,
    success: events.filter((e) => e.status === 'success').length,
    failed: events.filter((e) => e.status === 'failed').length,
    pending: events.filter((e) => e.status === 'pending').length,
  };

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                {stats.total} events
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Webhook Events
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Real-time event log from your connected payment gateways.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="glass-card glass-card-hover rounded-xl p-3 text-center animate-stagger stagger-1">
            <p className="text-lg font-black text-white">{stats.total}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Total</p>
          </div>
          <div className="glass-card glass-card-hover rounded-xl p-3 text-center animate-stagger stagger-2">
            <p className="text-lg font-black text-green-400">{stats.success}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Success</p>
          </div>
          <div className="glass-card glass-card-hover rounded-xl p-3 text-center animate-stagger stagger-3">
            <p className="text-lg font-black text-red-400">{stats.failed}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Failed</p>
          </div>
          <div className="glass-card glass-card-hover rounded-xl p-3 text-center animate-stagger stagger-4">
            <p className="text-lg font-black text-amber-400">{stats.pending}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase">Pending</p>
          </div>
        </div>

        {/* Webhook Endpoints */}
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.86-.866a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364l1.757 1.757" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Webhook Endpoints</h2>
              <p className="text-[11px] text-zinc-500">Configure these URLs in your gateway dashboard</p>
            </div>
          </div>

          {gateways.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No gateways configured</p>
          ) : (
            <div className="space-y-2">
              {gateways.map((gw, i) => (
                <div
                  key={gw.id}
                  className={`flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50 animate-stagger stagger-${Math.min(i + 1, 6)}`}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#1a1a1f] border border-[#252529] flex items-center justify-center text-base">
                    {GATEWAY_ICONS[gw.gatewaySlug] || '🔗'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{gw.label}</p>
                    <p className="text-[11px] text-zinc-500 font-mono truncate">
                      {WEBHOOK_BASE_URL}/api/webhooks/{gw.gatewaySlug}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {gw.webhookSecret ? (
                      <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                        Secret set
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        No secret
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      gw.isActive ? 'text-green-400 bg-green-500/10' : 'text-zinc-500 bg-zinc-800'
                    }`}>
                      {gw.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Log */}
        <div className="glass-card rounded-2xl p-5 animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Event Log</h2>
                <p className="text-[11px] text-zinc-500">Last 100 webhook events</p>
              </div>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="py-12 text-center">
              <svg className="w-10 h-10 text-zinc-700 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
              </svg>
              <p className="text-sm text-zinc-500">No webhook events yet</p>
              <p className="text-xs text-zinc-600 mt-1">Events will appear here when payments are processed</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
              {events.map((event, i) => {
                const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.pending;
                let payload: any = {};
                try {
                  payload = JSON.parse(event.payload || '{}');
                } catch {}

                return (
                  <details
                    key={event.id}
                    className={`group rounded-xl bg-[#0a0a0b] border border-[#252529]/50 hover:border-[#10B981]/20 transition-all animate-stagger stagger-${Math.min((i % 6) + 1, 6)}`}
                  >
                    <summary className="flex items-center gap-3 p-3 cursor-pointer list-none">
                      <span className="text-base flex-shrink-0">
                        {GATEWAY_ICONS[event.gateway || ''] || '🔗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono text-[#10B981] truncate">
                            {event.eventType}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {statusCfg.icon} {event.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {event.gateway} · {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-zinc-600 group-open:rotate-90 transition-transform flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </summary>
                    <div className="px-3 pb-3 pt-1 border-t border-[#252529]/30">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Payload
                      </p>
                      <pre className="text-[11px] text-zinc-300 bg-[#131316] rounded-lg p-3 overflow-x-auto custom-scrollbar font-mono">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>

        {/* Phase 6: Failed Deliveries & Retries.
            Phase 7 #33: pass the initial page + hasMoreInitial flag so
            the client component can render a "Load more" button. */}
        <FailedDeliveriesCard
          initialFailedDeliveries={initialDeliveries}
          hasMoreInitial={hasMoreInitial}
        />
      </div>
    </section>
  );
}
