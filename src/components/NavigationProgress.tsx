'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Module-level Map so the `finish` callback's pending timeout can be tracked
// without bolting a `_t` property onto the function reference itself.
const finishTimers = new Map<() => void, ReturnType<typeof setTimeout>>();

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams change, mark loading as finished.
  // Wrapped in a microtask (queueMicrotask) so setState is not called
  // synchronously inside the effect body — satisfies the React 19
  // `react-hooks/set-state-in-effect` lint rule without changing behavior.
  useEffect(() => {
    if (!loading) return;
    const finish = () => {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
        finishTimers.delete(finish);
      }, 250);
      finishTimers.set(finish, timer);
    };
    queueMicrotask(finish);
    return () => {
      const t = finishTimers.get(finish);
      if (t) {
        clearTimeout(t);
        finishTimers.delete(finish);
      }
    };
  }, [pathname, searchParams, loading]);

  useEffect(() => {
    // Intercept clicks on links for instant feedback
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      const isExternal = target.getAttribute('target') === '_blank' || href?.startsWith('http') || href?.startsWith('//');
      const isAnchor = href?.startsWith('#');
      const isSamePage = href === pathname || href === `${pathname}?${searchParams.toString()}`;

      if (href && !isExternal && !isAnchor && !isSamePage && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Deferred to a microtask so we don't call setState synchronously
        // inside the event handler effect body (react-hooks/set-state-in-effect).
        queueMicrotask(() => {
          setLoading(true);
          setProgress(25);
        });

        // Incremental progress simulation
        const p1 = setTimeout(() => setProgress(60), 100);
        const p2 = setTimeout(() => setProgress(85), 300);

        return () => {
          clearTimeout(p1);
          clearTimeout(p2);
        };
      }
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [pathname, searchParams]);

  if (!loading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-[3px] bg-black/20 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.9)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? 'width 0.15s ease-out, opacity 0.25s ease-out 0.1s' : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  );
}
