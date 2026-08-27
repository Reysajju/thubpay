'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CreditCard,
  FileText,
  FileX,
  Inbox,
  Key,
  Link2,
  LogIn,
  Plug,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Undo2,
  Unplug,
  UserPlus,
  Webhook,
  Zap,
  type LucideIcon,
} from 'lucide-react';

interface DashboardActivity {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface ActivityResponse {
  activities: DashboardActivity[];
  error?: string;
}

interface IconConfig {
  Icon: LucideIcon;
  /** Tailwind text color class, e.g. "text-emerald-400". */
  color: string;
  /** Tailwind background color class, e.g. "bg-emerald-500/10". */
  bg: string;
  /** Tailwind border color class, e.g. "border-emerald-500/20". */
  border: string;
}

const ICON_BY_ACTION: Record<string, IconConfig> = {
  // Invoices
  'invoice.created': { Icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'invoice.paid': { Icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'invoice.mark_paid': { Icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'invoice.sent': { Icon: FileText, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  'invoice.void': { Icon: FileX, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'invoice.refunded': { Icon: Undo2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },

  // Payments
  'payment.received': { Icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'payment.succeeded': { Icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'payment.failed': { Icon: CreditCard, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },

  // Refunds
  'refund.created': { Icon: Undo2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'refund.partial': { Icon: Undo2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'refund.issued': { Icon: Undo2, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },

  // Clients
  'client.created': { Icon: UserPlus, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },

  // Gateways — purple is banned, fall back to teal-400 (allowed).
  'gateway.connected': { Icon: Plug, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  'gateway.create': { Icon: Plug, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  'gateway.disconnected': { Icon: Unplug, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'gateway.delete': { Icon: Unplug, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },

  // Automation
  'automation.triggered': { Icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'automation.fired': { Icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },

  // Webhooks — sky-400 (no blue/indigo, per project rule).
  'webhook.delivered': { Icon: Webhook, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'webhook.create': { Icon: Webhook, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'webhook.delete': { Icon: Webhook, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },

  // Payment links
  'payment_link.created': { Icon: Link2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },

  // Subscriptions — indigo banned, use cyan-400.
  'subscription.activated': { Icon: Repeat, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'subscription.created': { Icon: Repeat, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'subscription.cancelled': { Icon: Repeat, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },

  // Disputes
  'dispute.opened': { Icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'dispute.resolved': { Icon: ShieldAlert, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },

  // API keys
  'api_key.create': { Icon: Key, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  'api_key.revoke': { Icon: Key, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },

  // Login
  'login.success': { Icon: LogIn, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

const DEFAULT_ICON: IconConfig = {
  Icon: Activity,
  color: 'text-zinc-400',
  bg: 'bg-zinc-500/10',
  border: 'border-zinc-500/20',
};

function iconFor(action: string): IconConfig {
  return ICON_BY_ACTION[action] ?? DEFAULT_ICON;
}

/** Map an audit-log action to a short, human-readable title (no actor). */
function actionLabel(action: string, entityType: string | null): string {
  switch (action) {
    case 'invoice.created':
      return 'Invoice created';
    case 'invoice.paid':
    case 'invoice.mark_paid':
      return 'Payment received';
    case 'invoice.void':
      return 'Invoice voided';
    case 'invoice.refunded':
      return 'Invoice refunded';
    case 'invoice.sent':
      return 'Invoice sent';
    case 'payment.received':
    case 'payment.succeeded':
      return 'Payment received';
    case 'payment.failed':
      return 'Payment failed';
    case 'refund.created':
      return 'Refund issued';
    case 'refund.partial':
      return 'Partial refund issued';
    case 'refund.issued':
      return 'Refund issued';
    case 'client.created':
      return 'Client created';
    case 'gateway.connected':
    case 'gateway.create':
      return 'Gateway connected';
    case 'gateway.disconnected':
    case 'gateway.delete':
      return 'Gateway disconnected';
    case 'automation.triggered':
    case 'automation.fired':
      return 'Automation rule fired';
    case 'webhook.delivered':
      return 'Webhook delivered';
    case 'webhook.create':
      return 'Webhook endpoint created';
    case 'webhook.delete':
      return 'Webhook endpoint deleted';
    case 'payment_link.created':
      return 'Payment link created';
    case 'subscription.activated':
      return 'Subscription activated';
    case 'subscription.created':
      return 'Subscription created';
    case 'subscription.cancelled':
      return 'Subscription cancelled';
    case 'dispute.opened':
      return 'Dispute opened';
    case 'dispute.resolved':
      return 'Dispute resolved';
    case 'api_key.create':
      return 'API key created';
    case 'api_key.revoke':
      return 'API key revoked';
    case 'login.success':
      return 'Signed in';
    default: {
      // Fall back to a friendlier rendering of the raw action.
      if (action) {
        const [head, ...rest] = action.split(/[._]/);
        const tail = rest.join(' ');
        const headCap = head ? head.charAt(0).toUpperCase() + head.slice(1) : 'Activity';
        return tail ? `${headCap} ${tail}` : headCap;
      }
      return entityType ? `${entityType} activity` : 'Activity';
    }
  }
}

/** Build a short, human-readable subject string from metadata. */
function subjectFromMetadata(
  action: string,
  metadata: Record<string, unknown> | null
): string | null {
  if (!metadata) return null;
  const getStr = (key: string): string | null => {
    const v = metadata[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const invoiceNumber = getStr('invoiceNumber');
  const customerName = getStr('customerName') ?? getStr('name');
  const label = getStr('label');
  const amountCents = metadata['amountCents'];
  const amountNum = typeof amountCents === 'number' ? amountCents : null;
  const currency = getStr('currency') ?? 'USD';

  const formatAmount = (cents: number): string =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(cents / 100);

  switch (action) {
    case 'invoice.created':
    case 'invoice.paid':
    case 'invoice.mark_paid':
    case 'invoice.void':
    case 'invoice.refunded':
    case 'invoice.sent':
    case 'payment_link.created':
      return invoiceNumber ?? null;
    case 'refund.created':
    case 'refund.partial':
    case 'refund.issued':
      return [invoiceNumber, amountNum ? formatAmount(amountNum) : null]
        .filter(Boolean)
        .join(' · ') || null;
    case 'payment.received':
    case 'payment.succeeded':
    case 'payment.failed':
      return [customerName, amountNum ? formatAmount(amountNum) : null]
        .filter(Boolean)
        .join(' · ') || null;
    case 'client.created':
      return customerName ?? null;
    case 'gateway.connected':
    case 'gateway.create':
    case 'gateway.disconnected':
    case 'gateway.delete':
      return label ?? null;
    case 'webhook.create':
    case 'webhook.delete':
    case 'webhook.delivered':
      return label ?? null;
    case 'automation.triggered':
    case 'automation.fired':
      return label ?? null;
    case 'subscription.activated':
    case 'subscription.created':
    case 'subscription.cancelled':
      return getStr('planName') ?? label ?? null;
    case 'dispute.opened':
    case 'dispute.resolved':
      return invoiceNumber ?? null;
    case 'api_key.create':
    case 'api_key.revoke':
      return label ?? null;
    default:
      return null;
  }
}

/** Resolve a contextual in-app link for the event. */
function linkFor(
  action: string,
  entityId: string | null
): string | null {
  const [domain] = action.split(/[._]/);
  switch (domain) {
    case 'invoice':
    case 'payment_link':
      return entityId ? `/invoice/${entityId}` : null;
    case 'payment':
    case 'refund':
      return '/dashboard/transactions';
    case 'client':
      return '/dashboard/customers';
    case 'gateway':
      return '/dashboard/settings';
    case 'automation':
      return '/dashboard/automation';
    case 'webhook':
      return '/dashboard/developers';
    case 'subscription':
      return '/dashboard/subscriptions';
    case 'dispute':
      return '/dashboard/disputes';
    case 'api_key':
      return '/dashboard/settings';
    case 'login':
      return null;
    default:
      return '/dashboard/audit-log';
  }
}

/** Format a past timestamp as "2 minutes ago" / "1 hour ago" / "3 days ago". */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk} week${wk === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

type LoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: DashboardActivity[]; error: null }
  | { status: 'error'; data: null; error: string };

const POLL_INTERVAL_MS = 30_000;

export default function RecentActivityTimeline() {
  const [state, setState] = useState<LoadState>({
    status: 'loading',
    data: null,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/activity', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        setState({ status: 'error', data: null, error: 'Unauthorized' });
        return;
      }
      if (res.status === 403) {
        setState({
          status: 'error',
          data: null,
          error: 'No workspace access',
        });
        return;
      }
      if (!res.ok) {
        setState({
          status: 'error',
          data: null,
          error: `Request failed (${res.status})`,
        });
        return;
      }
      const json = (await res.json()) as ActivityResponse;
      setState({ status: 'ready', data: json.activities ?? [], error: null });
    } catch (err) {
      // Avoid PII — just surface a generic message.
      console.error('[RecentActivityTimeline] fetch failed:', err);
      setState({
        status: 'error',
        data: null,
        error: 'Network error',
      });
    }
  }, []);

  useEffect(() => {
    // Defer the initial fetch past the synchronous effect body. `load`
    // is async and all its setState calls happen behind the first
    // `await`, but the `react-hooks/set-state-in-effect` rule can't
    // reason through that boundary — `queueMicrotask` is the proven
    // workaround used elsewhere in this codebase (BulkSelectProvider).
    queueMicrotask(() => {
      void load();
    });
    const id = setInterval(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="rounded-2xl bg-[#0d0d0e] border border-[#1f1f23] p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" aria-hidden />
          <h2 className="text-base font-bold text-white tracking-tight">
            Recent Activity
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
          title="Updates every 30 seconds"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="shimmer-text">Live</span>
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 max-h-[600px] overflow-y-auto custom-scrollbar pr-1 -mr-1">
        {state.status === 'loading' && <LoadingSkeleton />}
        {state.status === 'error' && (
          <ErrorState message={state.error} onRetry={load} />
        )}
        {state.status === 'ready' && state.data.length === 0 && <EmptyState />}
        {state.status === 'ready' && state.data.length > 0 && (
          <Timeline activities={state.data.slice(0, 10)} />
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#1f1f23]">
        <Link
          href="/dashboard/audit-log"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors group"
        >
          View full audit log
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function Timeline({ activities }: { activities: DashboardActivity[] }) {
  return (
    <ol className="relative">
      {/* Vertical connector line — rendered behind the icons. */}
      <span
        className="absolute left-[15px] top-2 bottom-2 w-px bg-[#1f1f23]"
        aria-hidden
      />
      {activities.map((act, i) => {
        const cfg = iconFor(act.action);
        const subject = subjectFromMetadata(act.action, act.metadata);
        const actor = act.userName ?? act.userEmail;
        const href = linkFor(act.action, act.entityId);
        const title = actionLabel(act.action, act.entityType);

        // Compose the row's title text.
        const rowTitle = [title, subject].filter(Boolean).join(' · ');
        const rowSub = actor ? `by ${actor}` : null;

        const createdDate = new Date(act.createdAt);
        const relative = Number.isNaN(createdDate.getTime())
          ? null
          : formatRelativeTime(createdDate);

        const rowInner = (
          <>
            <span
              className={cn(
                'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border',
                cfg.bg,
                cfg.border
              )}
              aria-hidden
            >
              <cfg.Icon className={cn('w-3.5 h-3.5', cfg.color)} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-100 font-medium truncate">
                {rowTitle}
                {rowSub && (
                  <span className="text-zinc-500 font-normal">
                    {' '}
                    {rowSub}
                  </span>
                )}
              </p>
              {relative && (
                <p className="text-[11px] text-zinc-500 mt-0.5">{relative}</p>
              )}
            </div>
          </>
        );

        return (
          <li key={act.id}>
            {href ? (
              <Link
                href={href}
                className="flex items-start gap-3 py-2 px-1 -mx-1 rounded-lg hover:bg-white/[0.03] transition-colors group"
              >
                {rowInner}
              </Link>
            ) : (
              <div className="flex items-start gap-3 py-2 px-1 -mx-1">
                {rowInner}
              </div>
            )}
            {i < activities.length - 1 && (
              <div className="ml-11 h-px bg-[#1f1f23]/40" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function LoadingSkeleton() {
  return (
    <ol className="space-y-3" aria-label="Loading activity">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 skeleton-shimmer">
          <span className="flex-shrink-0 w-8 h-8 rounded-full skeleton-shimmer border border-[#1f1f23]" />
          <div className="flex-1 space-y-1.5">
            <span className="block h-3 w-3/4 rounded skeleton-shimmer" />
            <span className="block h-2 w-1/3 rounded skeleton-shimmer" />
          </div>
        </li>
      ))}
    </ol>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#1a1a1e] border border-[#1f1f23] mb-3">
        <Inbox className="w-5 h-5 text-zinc-500" aria-hidden />
      </span>
      <p className="text-sm text-zinc-300 font-medium">No activity yet</p>
      <p className="text-xs text-zinc-500 mt-1 max-w-[220px]">
        Create an invoice or connect a gateway to get started.
      </p>
      <Link
        href="/dashboard/transactions"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        Go to invoices
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 mb-3">
        <AlertCircle className="w-4 h-4 text-red-400" aria-hidden />
      </span>
      <p className="text-sm text-zinc-200 font-medium">
        Failed to load activity
      </p>
      {message && (
        <p className="text-[11px] text-zinc-500 mt-1">{message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1"
      >
        <RefreshCw className="w-3 h-3" />
        Click to retry
      </button>
    </div>
  );
}
