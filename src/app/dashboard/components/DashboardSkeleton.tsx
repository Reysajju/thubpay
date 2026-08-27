/**
 * Shared loading skeleton for dashboard routes.
 *
 * Used by `loading.tsx` files in every dashboard sub-route so that
 * navigating between pages doesn't show a blank screen — instead the
 * user sees a tasteful shimmer skeleton that matches the final layout.
 *
 * Variants:
 *   - "overview"     → stat cards + chart + table (default dashboard)
 *   - "table"        → page header + stat cards + big table
 *   - "minimal"      → page header only (for simple pages)
 */

type Variant = 'overview' | 'table' | 'minimal';

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`glass-card rounded-2xl p-4 sm:p-5 ${className}`}
      aria-hidden="true"
    >
      <div className="space-y-3">
        <div className="h-3 w-1/3 skeleton rounded-md" />
        <div className="h-5 w-2/3 skeleton rounded-md" />
        <div className="h-3 w-1/2 skeleton rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="py-3 border-b border-[#252529]/30 last:border-0">
      <div className="flex items-center gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-4 skeleton rounded-md"
            style={{ width: `${(100 / cols) * (i === 0 ? 0.6 : 0.9)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`glass-card rounded-2xl p-4 sm:p-6 ${height}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 skeleton rounded-md" />
          <div className="h-6 w-20 skeleton rounded-full" />
        </div>
        <div className="flex items-end gap-2 h-3/4 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 skeleton rounded-md"
              style={{ height: `${30 + Math.sin(i) * 30 + Math.random() * 30}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonHeader({ title = 'Loading…' }: { title?: string }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
      <div>
        <div className="h-3 w-32 skeleton rounded-full mb-2" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-700 tracking-tight">
          {title}
        </h1>
        <div className="h-3 w-48 skeleton rounded-md mt-2" />
      </div>
      <div className="h-10 w-32 skeleton rounded-xl" />
    </div>
  );
}

export default function DashboardSkeleton({ variant = 'table' }: { variant?: Variant }) {
  if (variant === 'minimal') {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <SkeletonHeader />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 h-64 skeleton" />
            <SkeletonCard />
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'overview') {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <SkeletonHeader title="Loading dashboard…" />

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} className={`animate-stagger stagger-${i + 1}`} />
            ))}
          </div>

          {/* Charts + target */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            <div className="lg:col-span-2">
              <SkeletonChart height="h-80" />
            </div>
            <SkeletonCard className="h-80" />
          </div>

          {/* Recent invoices table */}
          <div className="glass-card rounded-3xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="h-5 w-40 skeleton rounded-md" />
              <div className="h-4 w-16 skeleton rounded-md" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={5} />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: 'table' variant
  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <SkeletonHeader title="Loading…" />

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className={`animate-stagger stagger-${i + 1}`} />
          ))}
        </div>

        {/* Table */}
        <div className="glass-card rounded-3xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="h-5 w-40 skeleton rounded-md" />
            <div className="h-4 w-16 skeleton rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} cols={6} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
