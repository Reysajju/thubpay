export default function AuditLogLoading() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-32 rounded bg-white/[0.04] animate-pulse" />
            <div className="h-3 w-48 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse mb-2" />
              <div className="h-5 w-8 rounded bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>

        <div className="h-12 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse mb-4" />

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-white/[0.04] px-4 py-4 last:border-0"
            >
              <div className="h-7 w-7 rounded-lg bg-white/[0.04] animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-2 w-48 rounded bg-white/[0.04] animate-pulse" />
              </div>
              <div className="h-3 w-24 rounded bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
