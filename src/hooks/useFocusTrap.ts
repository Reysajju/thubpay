'use client';

import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * useFocusTrap — trap keyboard focus inside the container element referenced
 * by `ref` while `active` is true. When activated, focus moves to the first
 * focusable child of the container. Tab / Shift+Tab cycle through the
 * container's focusable elements. When deactivated, focus is restored to the
 * element that was focused before activation (so the user's keyboard focus is
 * not lost).
 *
 * SSR-safe: no-ops when `document` is undefined or when `ref.current` is null.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!active) return;

    const container = ref.current;
    if (!container) return;

    const previouslyFocused =
      (document.activeElement as HTMLElement | null) ?? null;

    const getFocusable = (): HTMLElement[] => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => {
        if (el.hasAttribute('disabled')) return false;
        // Skip elements that are visually hidden / detached from the a11y tree.
        const hiddenStyle =
          typeof el.offsetParent === 'undefined' ? null : el.offsetParent;
        if (el.hasAttribute('hidden')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        return hiddenStyle !== null || el === document.activeElement;
      });
    };

    const initialFocusables = getFocusable();
    if (initialFocusables.length > 0) {
      initialFocusables[0]?.focus();
    } else {
      // Fall back to focusing the container itself if it is focusable.
      container.focus();
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const currentFocusables = getFocusable();
      if (currentFocusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      if (!first || !last) return;

      const activeIsOutside =
        !container.contains(document.activeElement) ||
        document.activeElement === null;

      if (event.shiftKey) {
        if (
          document.activeElement === first ||
          activeIsOutside
        ) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (
          document.activeElement === last ||
          activeIsOutside
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeydown);

    return () => {
      container.removeEventListener('keydown', handleKeydown);
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus();
      }
    };
  }, [ref, active]);
}

export default useFocusTrap;
