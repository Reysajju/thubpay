'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  CreditCard,
  Users,
  BarChart3,
  Repeat,
  ShieldAlert,
  Terminal,
  Settings,
  LogOut,
  DollarSign,
  Zap,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import Logo from '@/components/icons/Logo';
import { NotificationsBell, CommandPalette, SearchTrigger } from './NotificationsBell';

const NAV_ITEMS = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Payments', href: '/dashboard/transactions', icon: CreditCard },
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: Repeat },
  { name: 'Disputes', href: '/dashboard/disputes', icon: ShieldAlert },
  { name: 'API Keys', href: '/dashboard/developers', icon: Terminal },
  { name: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { name: 'Automation', href: '/dashboard/automation', icon: Zap },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const userName = (session?.user as any)?.name || 'User';

  return (
    <>
      {/* Top bar - visible only on mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#0d0d0e]/95 backdrop-blur-xl border-b border-[#252529] h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 flex-1">
          <Logo iconSize={24} />
        </Link>

        <NotificationsBell />
      </header>

      {/* Mobile slide-out menu */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#0d0d0e] border-r border-[#252529] flex flex-col animate-slideUp">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-[#252529]/50">
              <Logo iconSize={28} />
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-[#252529]/50">
              <SearchTrigger />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
              <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                Menu
              </p>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-[#10B981]/10 to-transparent text-[#10B981]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* User + sign out */}
            <div className="p-3 border-t border-[#252529]/50">
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-[#131316] border border-[#252529]/50">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-[11px] font-bold text-black">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-zinc-200 truncate">{userName}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/signin' })}
                  className="flex-shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <CommandPalette />
    </>
  );
}
