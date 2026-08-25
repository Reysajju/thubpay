'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import HelpButton from './HelpButton';
import HelpShortcutsOverlay from './HelpShortcutsOverlay';

/** g-prefix navigation map: g then <key> → route. */
const GOTO_MAP: Record<string, string> = {
  d: '/dashboard',
  t: '/dashboard/transactions',
  c: '/dashboard/customers',
  a: '/dashboard/analytics',
  f: '/dashboard/finance',
  s: '/dashboard/settings',
};

/** n-prefix action map: n then <key> → thubpay:action detail. */
const NEW_MAP: Record<string, string> = {
  p: 'create-payment-link',
  c: 'create-customer',
};

/**
 * HelpHost — single global mount for the Help FAB + shortcuts overlay.
 *
 * Owns three pieces of state:
 *  • `open`                  — the shortcuts overlay's visibility
 *  • `pendingGoto`           — true for 800ms after the user presses `g`,
 *                              waiting for a follow-up d/t/c/a/f/s key
 *  • `pendingNew`            — true for 800ms after the user presses `n`,
 *                              waiting for a follow-up p/c key
 *
 * The global keydown listener implements three classes of shortcuts:
 *
 *   1) Toggle help     — `?` (Shift+/)         → toggle the overlay
 *   2) g-prefix nav    — `g` then d/t/c/a/f/s  → router.push(...)
 *   3) n-prefix action — `n` then p/c          → dispatch thubpay:action
 *   4) standalone `c`                            → dispatch thubpay:action
 *                                                   (create-invoice)
 *
 * All four are gated on:
 *   • No ctrl/meta/alt modifiers held (shift is OK — needed for `?`).
 *   • The active element is not an input/textarea/select/contenteditable.
 *     (This also serves as the proxy for "CommandPalette is open" since
 *     the palette focuses its search input on mount.)
 *   • The help overlay is not currently open (the overlay handles its own
 *     Esc/Tab keys; `?` still toggles it closed).
 */
export default function HelpHost() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingHint, setPendingHint] = useState<'g' | 'n' | null>(null);

  // Use refs for the pending-state so the global keydown handler (which is
  // bound once) always sees the latest value without re-binding.
  const pendingGotoRef = useRef(false);
  const pendingNewRef = useRef(false);
  const gotoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  /** Clear any in-flight g-prefix timer + state. */
  const clearGoto = useCallback(() => {
    if (gotoTimerRef.current) {
      clearTimeout(gotoTimerRef.current);
      gotoTimerRef.current = null;
    }
    pendingGotoRef.current = false;
    setPendingHint(null);
  }, []);

  /** Clear any in-flight n-prefix timer + state. */
  const clearNew = useCallback(() => {
    if (newTimerRef.current) {
      clearTimeout(newTimerRef.current);
      newTimerRef.current = null;
    }
    pendingNewRef.current = false;
    setPendingHint(null);
  }, []);

  /** True if the event's target is an editable element (so we don't hijack typing). */
  const isEditable = useCallback((el: EventTarget | null): boolean => {
    if (!(el instanceof Element)) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }, []);

  // g-prefix navigation map (declared at module scope above).
  // n-prefix action map (declared at module scope above).

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K is owned by the CommandPalette — let it pass through.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // If the overlay is open, let the overlay's own key handler manage
      // Escape/Tab. `?` is still allowed to toggle it closed.
      if (openRef.current) {
        if (e.key === '?') {
          e.preventDefault();
          setOpen(false);
        }
        return;
      }

      // Don't hijack typing in inputs / textareas / contenteditable.
      if (isEditable(e.target)) return;

      const key = e.key;
      const lower = key.toLowerCase();

      // ── g-prefix: waiting for the second key of a `g then X` sequence ──
      if (pendingGotoRef.current) {
        // Cancel the pending timer regardless of what key was pressed next.
        clearGoto();
        const target = GOTO_MAP[lower];
        if (target) {
          e.preventDefault();
          router.push(target);
          return;
        }
        // Wrong second key — fall through so this key gets a chance to start
        // a new sequence (e.g. user pressed `g` then `n` — `n` should start
        // a new n-prefix sequence, not be silently swallowed).
      }

      // ── n-prefix: waiting for the second key of a `n then X` sequence ──
      if (pendingNewRef.current) {
        clearNew();
        const action = NEW_MAP[lower];
        if (action) {
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent('thubpay:action', { detail: action }),
          );
          return;
        }
      }

      // ── Standalone single-key shortcuts ──
      if (key === '?') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.shiftKey) return; // other shifted keys are not single-letter shortcuts

      if (lower === 'g') {
        pendingGotoRef.current = true;
        setPendingHint('g');
        if (gotoTimerRef.current) clearTimeout(gotoTimerRef.current);
        gotoTimerRef.current = setTimeout(() => {
          pendingGotoRef.current = false;
          setPendingHint((cur) => (cur === 'g' ? null : cur));
        }, 800);
        return;
      }
      if (lower === 'n') {
        pendingNewRef.current = true;
        setPendingHint('n');
        if (newTimerRef.current) clearTimeout(newTimerRef.current);
        newTimerRef.current = setTimeout(() => {
          pendingNewRef.current = false;
          setPendingHint((cur) => (cur === 'n' ? null : cur));
        }, 800);
        return;
      }
      if (lower === 'c') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('thubpay:action', { detail: 'create-invoice' }),
        );
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (gotoTimerRef.current) clearTimeout(gotoTimerRef.current);
      if (newTimerRef.current) clearTimeout(newTimerRef.current);
    };
  }, [router, clearGoto, clearNew, isEditable]);

  return (
    <>
      <HelpButton
        open={open}
        onOpenChange={setOpen}
        pendingHint={pendingHint}
      />
      <HelpShortcutsOverlay open={open} onOpenChange={setOpen} />
    </>
  );
}
