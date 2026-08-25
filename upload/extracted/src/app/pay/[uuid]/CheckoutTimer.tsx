'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CheckoutTimerProps {
  dueDate?: Date | string | null;
  createdAt?: Date | string | null;
}

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { diff, days, hours, minutes, seconds };
}

/**
 * A subtle countdown chip shown on the checkout card.
 *
 * If the invoice has a real `dueDate`, we count down to that deadline and
 * flip red when overdue. Otherwise we show a "session" timer (15 min from
 * mount) so the customer feels gentle urgency without a hard expiry.
 */
export default function CheckoutTimer({ dueDate, createdAt }: CheckoutTimerProps) {
  const [target] = useState(() => {
    if (dueDate) {
      const t = typeof dueDate === 'string' ? new Date(dueDate).getTime() : dueDate.getTime();
      return { kind: 'due' as const, ts: t };
    }
    // Fallback: 15-minute session timer from mount (resets per visit).
    return { kind: 'session' as const, ts: Date.now() + 15 * 60 * 1000 };
  });

  const [remaining, setRemaining] = useState(() => getRemaining(target.ts));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(getRemaining(target.ts));
    }, 1000);
    return () => clearInterval(id);
  }, [target.ts]);

  const expired = remaining.diff <= 0;
  const overdue = target.kind === 'due' && expired;

  // For the session timer, hide once it hits zero (don't nag).
  if (target.kind === 'session' && expired) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
        overdue
          ? 'border-red-500/30 bg-red-500/10 text-red-300'
          : target.kind === 'due'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400'
      }`}
      title={target.kind === 'due' ? 'Invoice due date' : 'Secure session timer'}
    >
      <Clock className={`h-3 w-3 ${overdue ? 'animate-pulse' : ''}`} />
      {overdue ? (
        <span>Overdue</span>
      ) : target.kind === 'due' ? (
        remaining.days > 0 ? (
          <span>
            Due in {remaining.days}d {pad(remaining.hours)}h
          </span>
        ) : (
          <span>
            Due in {pad(remaining.hours)}:{pad(remaining.minutes)}:{pad(remaining.seconds)}
          </span>
        )
      ) : (
        <span>
          Session {pad(remaining.minutes)}:{pad(remaining.seconds)}
        </span>
      )}
    </div>
  );
}
