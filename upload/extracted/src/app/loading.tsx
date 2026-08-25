/**
 * Root-level loading state — used during the very first paint
 * before any route resolves. Shows a centered pulsing ThubPay logo
 * on the dark background so the user immediately sees something
 * on-brand instead of a blank white screen.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 skeleton-page">
        <div className="animate-logo-pulse flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#059669] to-[#34D399]">
            <span className="text-sm font-black text-white">T</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">ThubPay</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-dot-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-dot-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-dot-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
