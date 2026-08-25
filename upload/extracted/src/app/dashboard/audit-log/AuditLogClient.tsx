'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Ban,
  RotateCcw,
  CheckCircle2,
  CreditCard,
  Settings,
  User,
  FileText,
  ExternalLink,
  AlertCircle,
  Download,
  Calendar,
  RefreshCw,
} from 'lucide-react';

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string; // pre-formatted date string
  user: { email: string; name: string | null } | null;
}

interface Props {
  entries: AuditLogEntry[];
  page: number;
  totalPages: number;
  totalCount: number;
  actions: string[];
  entities: string[];
  currentAction: string;
  currentEntity: string;
  currentFrom: string;
  currentTo: string;
}

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  'invoice.void': { label: 'Invoice Voided', color: 'text-red-400', bg: 'bg-red-500/10', icon: Ban },
  'invoice.paid': { label: 'Payment Received', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  'invoice.mark_paid': { label: 'Marked Paid', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  'refund.created': { label: 'Refund', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: RotateCcw },
  'refund.partial': { label: 'Partial Refund', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: RotateCcw },
  'gateway.create': { label: 'Gateway Created', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: CreditCard },
  'login.success': { label: 'Login', color: 'text-zinc-400', bg: 'bg-zinc-500/10', icon: User },
  'demo.login': { label: 'Demo Login', color: 'text-zinc-400', bg: 'bg-zinc-500/10', icon: User },
  'api_key.create': { label: 'API Key Created', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: CreditCard },
  'api_key.revoke': { label: 'API Key Revoked', color: 'text-red-400', bg: 'bg-red-500/10', icon: Ban },
  'webhook.create': { label: 'Webhook Created', color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: Settings },
  'webhook.delete': { label: 'Webhook Deleted', color: 'text-red-400', bg: 'bg-red-500/10', icon: Ban },
};

function getActionMeta(action: string) {
  return (
    ACTION_META[action] || {
      label: action,
      color: 'text-zinc-400',
      bg: 'bg-zinc-500/10',
      icon: Settings,
    }
  );
}

function parseMetadata(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function AuditLogClient({
  entries,
  page,
  totalPages,
  totalCount,
  actions,
  entities,
  currentAction,
  currentEntity,
  currentFrom,
  currentTo,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // ── Auto-refresh: poll the server every 30s for new entries ──
  // Uses `router.refresh()` which re-runs server components without a
  // full page reload. Paused when autoRefresh is off or the tab is
  // hidden (to avoid unnecessary requests).
  const refresh = useCallback(() => {
    router.refresh();
    setLastRefreshed(new Date());
  }, [router]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refresh();
      }
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, refresh]);

  // Filter entries by the search query (client-side, on the current page).
  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        (e.entity || '').toLowerCase().includes(q) ||
        (e.entityId || '').toLowerCase().includes(q) ||
        (e.user?.email || '').toLowerCase().includes(q) ||
        (e.user?.name || '').toLowerCase().includes(q) ||
        (e.metadata || '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete('page'); // reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    router.push(pathname);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    currentAction !== 'all' ||
    currentEntity !== 'all' ||
    currentFrom !== '' ||
    currentTo !== '';

  return (
    <div className="space-y-4">
      {/* ── Filters bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions, entities, users…"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Action filter */}
        <select
          value={currentAction}
          onChange={(e) => updateFilter('action', e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all" className="bg-[#0f0f11]">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a} className="bg-[#0f0f11]">
              {getActionMeta(a).label}
            </option>
          ))}
        </select>

        {/* Entity filter */}
        <select
          value={currentEntity}
          onChange={(e) => updateFilter('entity', e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="all" className="bg-[#0f0f11]">All entities</option>
          {entities.map((e) => (
            <option key={e} value={e} className="bg-[#0f0f11]">
              {e}
            </option>
          ))}
        </select>

        {/* Date range filter — from / to */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-zinc-600" />
          <input
            type="date"
            value={currentFrom}
            onChange={(e) => updateFilter('from', e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2.5 text-xs text-white transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 [color-scheme:dark]"
            title="Filter from date"
          />
          <span className="text-zinc-600 text-xs">→</span>
          <input
            type="date"
            value={currentTo}
            onChange={(e) => updateFilter('to', e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-2.5 text-xs text-white transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 [color-scheme:dark]"
            title="Filter to date"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-zinc-400 transition-all hover:border-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}

        {/* Export CSV — preserves the current action + entity + date filters */}
        <a
          href={`/api/dashboard/audit-log/export${(() => {
            const params = new URLSearchParams();
            if (currentAction !== 'all') params.set('action', currentAction);
            if (currentEntity !== 'all') params.set('entity', currentEntity);
            if (currentFrom) params.set('from', currentFrom);
            if (currentTo) params.set('to', currentTo);
            const qs = params.toString();
            return qs ? `?${qs}` : '';
          })()}`}
          download
          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-xs font-semibold text-emerald-400 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10"
          title="Export filtered audit log as CSV"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>

        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
            autoRefresh
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
              : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
          }`}
          title={autoRefresh ? 'Auto-refresh on (every 30s)' : 'Auto-refresh off'}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin-slow' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
          {autoRefresh ? 'Live' : 'Paused'}
        </button>

        {/* Manual refresh */}
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-zinc-400 transition-all hover:border-white/20 hover:text-white"
          title="Refresh now"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  User
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Details
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <AlertCircle className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
                    <p className="text-sm text-zinc-500">No audit log entries found</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {hasFilters
                        ? 'Try adjusting your filters.'
                        : 'Actions like voiding invoices, processing refunds, and marking payments will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const meta = getActionMeta(entry.action);
                  const Icon = meta.icon;
                  const details = parseMetadata(entry.metadata);
                  const invoiceId = entry.entity === 'invoice' ? entry.entityId : null;

                  return (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
                            <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                          </span>
                          <span className={`text-sm font-semibold ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-zinc-600" />
                          <span className="text-xs text-zinc-400">{entry.entity || '—'}</span>
                          {entry.entityId && (
                            <span className="font-mono text-[10px] text-zinc-600">
                              #{entry.entityId.slice(0, 12)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-medium text-zinc-300">
                            {entry.user?.name || entry.user?.email || 'System'}
                          </p>
                          {entry.user?.email && entry.user.name && (
                            <p className="text-[10px] text-zinc-600">{entry.user.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {details.invoiceNumber && (
                            <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                              {details.invoiceNumber}
                            </span>
                          )}
                          {typeof details.amountCents === 'number' && (
                            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                              ${(details.amountCents / 100).toFixed(2)}
                            </span>
                          )}
                          {details.previousStatus && (
                            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
                              was {details.previousStatus}
                            </span>
                          )}
                          {invoiceId && (
                            <a
                              href={`/invoice/${invoiceId}`}
                              className="flex items-center gap-0.5 rounded-md bg-emerald-500/5 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
                            >
                              View
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] text-zinc-500">
                          {entry.createdAt}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Page {page} of {totalPages} · {totalCount.toLocaleString()} total events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
