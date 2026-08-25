'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, shows a small "g…" pending-navigation hint pill next to the button. */
  pendingHint?: 'g' | 'n' | null;
}

/**
 * HelpButton — floating action button fixed at the bottom-right corner of the
 * dashboard viewport. Clicking it opens the `HelpShortcutsOverlay`.
 *
 * z-index: `z-[60]` so it sits above normal page content (and the sidebar
 * footer), but below the overlay itself (z-[100]) and below Radix
 * dropdowns/dialogs (which default to z-50+, but the overlay's z-[100] wins).
 *
 * The button is always visible (it does not unmount when the overlay opens —
 * it just becomes the close affordance via aria-pressed).
 */
export default function HelpButton({
  open,
  onOpenChange,
  pendingHint = null,
}: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-2">
      {pendingHint && (
        <span
          aria-live="polite"
          className="pointer-events-none select-none rounded-full border border-emerald-500/30 bg-[#131316] px-2.5 py-1 font-mono text-[11px] text-emerald-300 shadow-lg shadow-emerald-950/40 animate-slideUp"
        >
          {pendingHint}…
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            aria-label="Help & Shortcuts (?)"
            aria-pressed={open}
            className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/40 transition-transform duration-200 hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c]"
          >
            <HelpCircle className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          sideOffset={8}
          className="border border-[#252529] bg-[#131316] text-zinc-200"
        >
          Help &amp; Shortcuts (?)
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
