import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { db } from '@/lib/db';
import AuditLogClient from './AuditLogClient';
import { ScrollText } from 'lucide-react';

export const dynamic = 'force-dynamic';

type AuditLogPageProps = {
  searchParams: Promise<{
    page?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
  }>;
};

const PAGE_SIZE = 25;

function formatDateTime(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const ws = await requireWorkspace();
  if (!ws.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ws.context;

  const { page: pageRaw, action: actionFilter, entity: entityFilter, from: fromRaw, to: toRaw } = await searchParams;
  const page = Math.max(1, parseInt(pageRaw || '1', 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  // Build the where clause from filters.
  const where: {
    workspaceId: string;
    action?: string;
    entity?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    workspaceId,
  };
  if (actionFilter && actionFilter !== 'all') {
    where.action = actionFilter;
  }
  if (entityFilter && entityFilter !== 'all') {
    where.entity = entityFilter;
  }

  // Date range filter — `from` is inclusive (start of day), `to` is
  // inclusive (end of day). Both are parsed as local dates then
  // converted to Date objects.
  if (fromRaw || toRaw) {
    const dateRange: { gte?: Date; lte?: Date } = {};
    if (fromRaw) {
      const from = new Date(fromRaw + 'T00:00:00');
      if (!Number.isNaN(from.getTime())) dateRange.gte = from;
    }
    if (toRaw) {
      const to = new Date(toRaw + 'T23:59:59.999');
      if (!Number.isNaN(to.getTime())) dateRange.lte = to;
    }
    if (dateRange.gte || dateRange.lte) {
      where.createdAt = dateRange;
    }
  }

  // Fetch the audit log entries + total count in parallel.
  const [entries, totalCount, distinctActions, distinctEntities] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where: { workspaceId },
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    }).then((rows) => rows.map((r) => r.action).filter(Boolean) as string[]),
    db.auditLog.findMany({
      where: { workspaceId },
      select: { entity: true },
      distinct: ['entity'],
      orderBy: { entity: 'asc' },
    }).then((rows) => rows.map((r) => r.entity).filter(Boolean) as string[]),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Serialize for the client component (Date → pre-formatted string,
  // since functions can't be passed across the server/client boundary).
  const serializedEntries = entries.map((e) => ({
    id: e.id,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId,
    metadata: e.metadata,
    ipAddress: e.ipAddress,
    createdAt: formatDateTime(e.createdAt),
    user: e.user
      ? { email: e.user.email, name: e.user.name }
      : null,
  }));

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 animate-fadeIn">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20">
            <ScrollText className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white text-gradient-emerald">Audit Log</h1>
            <p className="text-sm text-zinc-500">
              Track every invoice, refund, and payment action across your workspace.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total events" value={totalCount} />
          <StatCard label="This page" value={serializedEntries.length} />
          <StatCard label="Action types" value={distinctActions.length} />
          <StatCard label="Entity types" value={distinctEntities.length} />
        </div>

        {/* Client component (filters + table + pagination) */}
        <AuditLogClient
          entries={serializedEntries}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          actions={distinctActions}
          entities={distinctEntities}
          currentAction={actionFilter || 'all'}
          currentEntity={entityFilter || 'all'}
          currentFrom={fromRaw || ''}
          currentTo={toRaw || ''}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-black text-white">{value.toLocaleString()}</p>
    </div>
  );
}
