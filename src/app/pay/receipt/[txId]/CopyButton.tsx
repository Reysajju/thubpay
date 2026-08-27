'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  icon?: 'copy' | 'share';
}

export default function CopyButton({
  text,
  label = 'Copy',
  icon = 'copy',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked in some contexts — fail silently.
    }
  }

  const Icon = icon === 'share' ? Share2 : Copy;

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`${label} to clipboard`}
      className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all ${
        copied
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
      }`}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" /> Copied
        </>
      ) : (
        <>
          <Icon className="h-3 w-3" /> {label}
        </>
      )}
    </button>
  );
}
