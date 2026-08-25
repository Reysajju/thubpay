'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, X, Check, CheckCheck } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  payment: '💰',
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  dispute: '⚖️',
};

const TYPE_COLORS: Record<string, string> = {
  payment: 'border-green-500/30 bg-green-500/5',
  info: 'border-cyan-500/30 bg-cyan-500/5',
  success: 'border-green-500/30 bg-green-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  error: 'border-red-500/30 bg-red-500/5',
  dispute: 'border-red-500/30 bg-red-500/5',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/settings/notifications');
      if (res.ok) {
        const data = await res.json();
        const notifs = data.notifications || [];
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = async () => {
    // ── Optimistic update ──
    // Capture the previous state so we can roll back on failure.
    const prevNotifications = notifications;
    const prevUnreadCount = unreadCount;

    // Instantly update the UI
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      const res = await fetch('/api/dashboard/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Success — state is already updated, nothing more to do.
    } catch {
      // Roll back on failure
      setNotifications(prevNotifications);
      setUnreadCount(prevUnreadCount);
    }
  };

  const markOneRead = async (id: string) => {
    // ── Optimistic update ──
    // Capture previous state for rollback.
    const prevNotifications = notifications;
    const prevUnreadCount = unreadCount;

    // Only update if the notification is currently unread
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;

    // Instantly update the UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/dashboard/settings/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Success — state is already updated, nothing more to do.
    } catch {
      // Roll back on failure
      setNotifications(prevNotifications);
      setUnreadCount(prevUnreadCount);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-br from-[#10B981] to-[#a68447] text-[9px] font-bold text-black animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#131316] rounded-2xl border border-[#252529] shadow-2xl overflow-hidden z-50 animate-slideUp">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#252529]/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-[#10B981] disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-[#10B981]/30 border-t-[#10B981] rounded-full animate-spin" />
                <p className="text-xs text-zinc-500 mt-2">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No notifications yet</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Payment alerts and activity will appear here
                </p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markOneRead(n.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#252529]/30 transition-all duration-200 hover:bg-white/[0.03] group ${
                    !n.is_read ? 'bg-[#10B981]/[0.04]' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm border transition-all ${
                        TYPE_COLORS[n.type] || 'border-zinc-500/30 bg-zinc-500/5'
                      }`}
                    >
                      {TYPE_ICONS[n.type] || '🔔'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold truncate transition-colors ${n.is_read ? 'text-zinc-400' : 'text-zinc-200'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Command Palette (Cmd+K) ─────────────────────────────────

const COMMANDS = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊', section: 'Navigation' },
  { name: 'Transactions', href: '/dashboard/transactions', icon: '💳', section: 'Navigation' },
  { name: 'Customers', href: '/dashboard/customers', icon: '👥', section: 'Navigation' },
  { name: 'Analytics', href: '/dashboard/analytics', icon: '📈', section: 'Navigation' },
  { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: '🔄', section: 'Navigation' },
  { name: 'Disputes', href: '/dashboard/disputes', icon: '⚖️', section: 'Navigation' },
  { name: 'Finance', href: '/dashboard/finance', icon: '💵', section: 'Navigation' },
  { name: 'Automation', href: '/dashboard/automation', icon: '⚡', section: 'Navigation' },
  { name: 'API Keys', href: '/dashboard/developers', icon: '🔑', section: 'Developer' },
  { name: 'Gateway Settings', href: '/dashboard/settings/gateways', icon: '🔌', section: 'Settings' },
  { name: 'Workspace Settings', href: '/dashboard/settings', icon: '⚙️', section: 'Settings' },
  { name: 'Sign Out', href: '/signin', icon: '🚪', section: 'Account' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle with Cmd+K / Ctrl+K, or via custom event from SearchTrigger
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenEvent);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenEvent);
    };
  }, []);

  // Focus input when open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = COMMANDS.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const grouped: Record<string, typeof COMMANDS> = {};
  filtered.forEach((c) => {
    if (!grouped[c.section]) grouped[c.section] = [];
    grouped[c.section].push(c);
  });

  const handleSelect = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex].href);
      }
    }
  };

  if (!open) return null;

  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
      <div
        className="relative w-full max-w-xl bg-[#131316] rounded-2xl border border-[#252529] shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#252529]/60">
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, settings, or actions..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
          />
          <kbd className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a1a1f] border border-[#252529] text-zinc-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-500">No results for "{query}"</p>
            </div>
          ) : (
            Object.entries(grouped).map(([section, items]) => (
              <div key={section} className="mb-2">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  {section}
                </p>
                {items.map((cmd) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.href + cmd.name}
                      onClick={() => handleSelect(cmd.href)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                        isSelected
                          ? 'bg-[#10B981]/10 text-[#10B981]'
                          : 'text-zinc-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="text-base">{cmd.icon}</span>
                      <span className="font-medium">{cmd.name}</span>
                      {isSelected && (
                        <span className="ml-auto text-[10px] text-zinc-600">
                          ↵
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#252529]/60 text-[10px] text-zinc-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#1a1a1f] border border-[#252529]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#1a1a1f] border border-[#252529]">↵</kbd>
              select
            </span>
          </div>
          <span className="text-[#10B981]/60">ThubPay Quick Nav</span>
        </div>
      </div>
    </div>
  );
}

// ─── Search Trigger Button ────────────────────────────────────

export function SearchTrigger() {
  const openPalette = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-command-palette'));
  }, []);

  return (
    <button
      onClick={openPalette}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a1a1f] border border-[#252529] text-xs text-zinc-500 hover:text-zinc-300 hover:border-[#10B981]/30 transition-all w-full max-w-[180px]"
    >
      <Search className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="truncate">Quick search...</span>
      <kbd className="ml-auto text-[9px] font-mono px-1 py-0.5 rounded bg-[#0a0a0b] border border-[#252529] hidden sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
