'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  HelpCircle,
  X,
  FileText,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Each shortcut row renders one or more <kbd> elements separated by a tiny "then" or "/" connector. */
interface ShortcutRow {
  /** Each entry is a sequence of single-key <kbd> elements (e.g. `['g', 'd']`).
   *  If two entries exist, they are rendered with a `/` between them (e.g. ⌘K / Ctrl+K). */
  keys: string[][];
  /** Optional connector between two key sequences: defaults to '/'. */
  connector?: '/' | 'then';
  desc: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: [['⌘', 'K'], ['Ctrl', 'K']], connector: '/', desc: 'Open Quick Search' },
  { keys: [['?']], desc: 'Open / close this help' },
  { keys: [['Esc']], desc: 'Close dialogs' },
  { keys: [['g', 'd']], connector: 'then', desc: 'Go to Dashboard' },
  { keys: [['g', 't']], connector: 'then', desc: 'Go to Transactions' },
  { keys: [['g', 'c']], connector: 'then', desc: 'Go to Customers' },
  { keys: [['g', 'a']], connector: 'then', desc: 'Go to Analytics' },
  { keys: [['g', 'f']], connector: 'then', desc: 'Go to Finance' },
  { keys: [['c']], desc: 'Create Invoice' },
  { keys: [['n', 'p']], connector: 'then', desc: 'New Payment Link' },
  { keys: [['n', 'c']], connector: 'then', desc: 'New Customer' },
];

interface QuickLink {
  label: string;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}

/**
 * HelpShortcutsOverlay — modal overlay listing keyboard shortcuts + quick
 * links. Controlled by parent via `open` / `onOpenChange`. Closes on backdrop
 * click or ESC key. Focus is trapped inside the panel while open.
 */
export default function HelpShortcutsOverlay({ open, onOpenChange }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Trap focus inside the panel while open. The hook also restores focus to
  // the previously-focused element (the Help FAB) on close.
  useFocusTrap(panelRef, open);

  // ESC closes (defensive — the parent's global listener also handles this,
  // but having a local handler on the panel makes the contract explicit and
  // works even if the global listener is overridden).
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onOpenChange]);

  if (!open) return null;

  const quickLinks: QuickLink[] = [
    {
      label: 'Documentation',
      href: '/dashboard/developers',
      icon: <FileText className="h-3.5 w-3.5" />,
    },
    {
      label: 'Audit Log',
      href: '/dashboard/audit-log',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
    {
      label: 'Settings',
      href: '/dashboard/settings',
      icon: <Settings className="h-3.5 w-3.5" />,
    },
    {
      label: 'Sign Out',
      icon: <LogOut className="h-3.5 w-3.5" />,
      onClick: () => {
        onOpenChange(false);
        void signOut({ callbackUrl: '/signin' });
      },
    },
  ];

  function handleQuickLinkClick(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-shortcuts-title"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-xl rounded-2xl border border-[#252529] bg-[#131316] shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#252529]/60 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <HelpCircle className="h-4 w-4" />
            </span>
            <h2
              id="help-shortcuts-title"
              className="truncate text-sm font-bold text-white"
            >
              Keyboard Shortcuts &amp; Quick Help
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <kbd className="bg-[#1a1a1f] border border-[#252529] text-zinc-400 font-mono text-[10px] px-1.5 py-0.5 rounded">
              ESC
            </kbd>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close help"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {/* Shortcuts section */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Keyboard Shortcuts
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SHORTCUTS.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:border-[#252529]/70 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex flex-shrink-0 items-center gap-1">
                  {row.keys.map((seq, si) => (
                    <React.Fragment key={si}>
                      {si > 0 && (
                        <span className="text-[10px] text-zinc-600">
                          {row.connector === 'then' ? 'then' : '/'}
                        </span>
                      )}
                      {seq.map((k, ki) => (
                        <kbd
                          key={ki}
                          className="bg-[#1a1a1f] border border-[#252529] text-zinc-300 font-mono text-[10px] px-1.5 py-0.5 rounded"
                        >
                          {k}
                        </kbd>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <span className="text-zinc-400 text-xs">{row.desc}</span>
              </div>
            ))}
          </div>

          {/* Quick links section */}
          <p className="mt-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Quick Links
          </p>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => {
              const inner = (
                <>
                  {link.icon}
                  <span>{link.label}</span>
                </>
              );
              const cls =
                'inline-flex items-center gap-2 bg-[#18181c] border border-[#252529] hover:border-emerald-500/40 hover:text-emerald-400 rounded-xl px-3 py-2 text-xs font-medium transition';
              if (link.href) {
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => handleQuickLinkClick(link.href!)}
                    className={cls}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={link.label}
                  type="button"
                  onClick={link.onClick}
                  className={cls}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#252529]/60 px-5 py-3">
          <span className="text-[11px] text-zinc-500">
            Press{' '}
            <kbd className="bg-[#1a1a1f] border border-[#252529] text-zinc-300 font-mono text-[10px] px-1.5 py-0.5 rounded">
              ?
            </kbd>{' '}
            anytime to open this dialog
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
            ThubPay v1.0
          </span>
        </div>
      </div>
    </div>
  );
}
