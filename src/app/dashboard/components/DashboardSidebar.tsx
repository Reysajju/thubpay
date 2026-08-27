'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  ChevronDown,
  DollarSign,
  Zap,
  MailCheck,
  ScrollText,
} from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/icons/Logo';
import { NotificationsBell, SearchTrigger } from './NotificationsBell';
import { OnboardingIndicator } from './OnboardingWalkthrough';
import ThemeToggle from './ThemeToggle';

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  children?: { name: string; href: string; icon: any }[];
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Payments', href: '/dashboard/transactions', icon: CreditCard },
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { name: 'Link Tracking', href: '/dashboard/link-tracking', icon: MailCheck },
  { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: Repeat },
  { name: 'Disputes', href: '/dashboard/disputes', icon: ShieldAlert },
  {
    name: 'Developers',
    icon: Terminal,
    children: [
      { name: 'API Keys', href: '/dashboard/developers', icon: Terminal },
      { name: 'Webhooks', href: '/dashboard/developers/webhooks', icon: Terminal },
    ],
  },
  { name: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { name: 'Automation', href: '/dashboard/automation', icon: Zap },
  { name: 'Audit Log', href: '/dashboard/audit-log', icon: ScrollText },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardSidebar({
  workspaceId,
  workspaceName: _workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navigation.forEach((item) => {
      if (item.children) {
        const isActive = item.children.some(
          (child) => pathname === child.href || pathname.startsWith(child.href + '/')
        );
        initial[item.name] = isActive;
      }
    });
    return initial;
  });

  const toggleSection = (name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const userName = (session?.user as any)?.name || 'User';
  const userEmail = (session?.user as any)?.email || '';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="w-64 flex-shrink-0 bg-[#0d0d0e] border-r border-[#252529] min-h-screen flex flex-col sticky top-0">
      {/* Logo + Search */}
      <div className="px-4 py-5 border-b border-[#252529]/50 space-y-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 group">
          <Logo iconSize={28} />
        </Link>
        <SearchTrigger />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
        <p className="px-3 py-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
          Menu
        </p>
        {navigation.map((item) => {
          const hasChildren = item.children && item.children.length > 0;

          if (!hasChildren) {
            return (
              <Link
                key={item.name}
                href={item.href!}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all group relative ${
                  isActive(item.href!)
                    ? 'bg-gradient-to-r from-[#10B981]/15 via-[#10B981]/5 to-transparent text-[#34D399] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                }`}
              >
                {isActive(item.href!) && (
                  <span className="nav-active-bar" />
                )}
                <item.icon className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive(item.href!) ? 'text-[#34D399]' : ''}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          }

          return (
            <div key={item.name} className="mt-1">
              <button
                onClick={() => toggleSection(item.name)}
                className="flex items-center justify-between w-full px-3 py-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors rounded-lg hover:bg-white/5 group"
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.name}
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    expanded[item.name] ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-in-out ${
                  expanded[item.name] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-0.5 mt-1 ml-3 border-l border-[#252529]/40 pl-2">
                  {item.children!.map((child) => (
                    <Link
                      key={child.name}
                      href={child.href}
                      className={`flex items-center gap-3 px-3 py-1.5 text-sm font-medium rounded-xl transition-all group ${
                        isActive(child.href)
                          ? 'bg-[#10B981]/10 text-[#10B981]'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                      }`}
                    >
                      <child.icon className="w-4 h-4" />
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Onboarding completion indicator */}
      <OnboardingIndicator workspaceId={workspaceId} />

      {/* User Profile + Notifications + Theme Toggle */}
      <div className="p-3 border-t border-[#252529]/50 space-y-2">
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ThemeToggle />
          <div className="flex-1 flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-[#131316] border border-[#252529]/50">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center text-[11px] font-bold text-black">
              {initials || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate">{userName}</p>
              <p className="text-[10px] text-zinc-500 truncate">{userEmail}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className="flex-shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
