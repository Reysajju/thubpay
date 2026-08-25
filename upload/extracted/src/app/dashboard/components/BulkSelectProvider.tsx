'use client';

import { useState, useCallback, useEffect, createContext, useContext, useMemo } from 'react';
import BulkVoidButton from './BulkVoidButton';
import { CheckSquare, Square, X } from 'lucide-react';

interface InvoiceRow {
  id: string;
  status: string;
}

interface BulkSelectContextValue {
  selectedIds: string[];
  isAllSelected: boolean;
  toggleAll: () => void;
  toggleOne: (id: string) => void;
  isSelected: (id: string) => boolean;
  clearSelection: () => void;
}

const BulkSelectContext = createContext<BulkSelectContextValue | null>(null);

export function useBulkSelect(): BulkSelectContextValue {
  const ctx = useContext(BulkSelectContext);
  if (!ctx) {
    // Return a no-op context if used outside the provider — keeps the
    // table cells safe even if the provider isn't mounted.
    return {
      selectedIds: [],
      isAllSelected: false,
      toggleAll: () => {},
      toggleOne: () => {},
      isSelected: () => false,
      clearSelection: () => {},
    };
  }
  return ctx;
}

interface BulkSelectProviderProps {
  /** All invoice IDs + statuses on the current page. */
  invoices: InvoiceRow[];
  /** Only these statuses can be voided (and thus selected). */
  voidableStatuses?: string[];
  /** Regular children (NOT a render prop — Next.js 16 disallows functions as children). */
  children: React.ReactNode;
}

/**
 * Manages checkbox selection state for a table of invoices and
 * renders a floating bulk action bar when invoices are selected.
 *
 * Wrap the table + any children. Descendant cells consume the
 * selection state via the `useBulkSelect()` hook + the exported
 * `<SelectAllCheckbox />` and `<RowCheckbox />` components.
 */
export default function BulkSelectProvider({
  invoices,
  voidableStatuses = ['draft', 'sent', 'viewed', 'overdue'],
  children,
}: BulkSelectProviderProps) {
  const STORAGE_KEY = 'thubpay-bulk-selection';

  // Initialize from sessionStorage so selection persists across page navigations.
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {
      /* sessionStorage may be unavailable */
    }
    return new Set();
  });

  // Persist selection to sessionStorage whenever it changes.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
    } catch {
      /* non-fatal */
    }
  }, [selected]);

  // Only voidable invoices on the current page are selectable.
  const selectableIds = useMemo(
    () =>
      invoices
        .filter((inv) => voidableStatuses.includes(inv.status))
        .map((inv) => inv.id),
    [invoices, voidableStatuses]
  );

  const isAllSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (selectableIds.every((id) => next.has(id))) {
        for (const id of selectableIds) next.delete(id);
      } else {
        for (const id of selectableIds) next.add(id);
      }
      return next;
    });
  }, [selectableIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedIds = Array.from(selected);

  const value: BulkSelectContextValue = {
    selectedIds,
    isAllSelected,
    toggleAll,
    toggleOne,
    isSelected,
    clearSelection,
  };

  return (
    <BulkSelectContext.Provider value={value}>
      {children}

      {/* ── Floating bulk action bar ──────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-fadeIn">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0f0f11]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-sm font-black text-emerald-400">
                {selectedIds.length}
              </span>
              <span className="text-xs font-semibold text-white">
                {selectedIds.length} invoice{selectedIds.length === 1 ? '' : 's'} selected
              </span>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <BulkVoidButton invoiceIds={selectedIds} compact />

            <button
              onClick={clearSelection}
              aria-label="Clear selection"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </BulkSelectContext.Provider>
  );
}

// ── Checkbox cell components (consume the context) ────────────────

export function SelectAllCheckbox() {
  const { isAllSelected, toggleAll } = useBulkSelect();
  return (
    <button
      onClick={toggleAll}
      aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
      className="flex h-5 w-5 items-center justify-center rounded border transition-all"
      style={{
        borderColor: isAllSelected ? '#10b981' : '#52525b',
        background: isAllSelected ? '#10b981' : 'transparent',
      }}
    >
      {isAllSelected ? (
        <CheckSquare className="h-3.5 w-3.5 text-white" />
      ) : (
        <Square className="h-3.5 w-3.5 text-transparent" />
      )}
    </button>
  );
}

export function RowCheckbox({ id }: { id: string }) {
  const { isSelected, toggleOne } = useBulkSelect();
  const selected = isSelected(id);
  return (
    <button
      onClick={() => toggleOne(id)}
      aria-label={selected ? 'Deselect row' : 'Select row'}
      className="flex h-5 w-5 items-center justify-center rounded border transition-all"
      style={{
        borderColor: selected ? '#10b981' : '#52525b',
        background: selected ? '#10b981' : 'transparent',
      }}
    >
      {selected ? (
        <CheckSquare className="h-3.5 w-3.5 text-white" />
      ) : (
        <Square className="h-3.5 w-3.5 text-transparent" />
      )}
    </button>
  );
}
