'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  CreditCard, 
  Users, 
  Database, 
  Zap, 
  Settings, 
  LayoutDashboard, 
  ArrowLeftRight,
  Repeat,
  ShieldAlert,
  Terminal,
  Calculator,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import Logo from '@/components/icons/Logo';

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  children?: { name: string; href: string; icon: any }[];
}

const navigation: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { 
    name: 'Payments', 
    icon: CreditCard,
    children: [
      { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
      { name: 'Subscriptions', href: '/dashboard/subscriptions', icon: Repeat },
      { name: 'Disputes', href: '/dashboard/disputes', icon: ShieldAlert },
    ]
  },
  { name: 'Customers', href: '/dashboard/customers', icon: Users },
  { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  { 
    name: 'Developers', 
    icon: Terminal,
    children: [
      { name: 'API Keys', href: '/dashboard/developers', icon: Database },
      { name: 'Webhooks', href: '/dashboard/developers/webhooks', icon: Zap },
      { name: 'Playground', href: '/dashboard/developers/playground', icon: Terminal },
    ]
  },
  { name: 'Finance', href: '/dashboard/finance', icon: Calculator },
  { name: 'Automation', href: '/dashboard/automation', icon: Zap },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  
  // Determine which sections should start expanded based on current path
  const getInitialExpanded = () => {
    const expanded: Record<string, boolean> = {};
    navigation.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(child => pathname === child.href || pathname.startsWith(child.href + '/'));
        expanded[item.name] = isChildActive;
      }
    });
    return expanded;
  };

  const [expanded, setExpanded] = useState<Record<string, boolean>>(getInitialExpanded);

  const toggleSection = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-thubpay-obsidian/50 border-r border-thubpay-border min-h-[calc(100vh-5rem)] flex flex-col sticky top-20">
      <div className="px-6 py-8 border-b border-thubpay-border/30">
        <Link href="/dashboard">
          <Logo iconSize={32} />
        </Link>
      </div>
      <div className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const hasChildren = item.children && item.children.length > 0;
          
          return (
            <div key={item.name}>
              {!hasChildren ? (
                <Link
                  href={item.href!}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all group ${
                    isActive 
                      ? 'bg-thubpay-gold/10 text-thubpay-gold border-l-2 border-thubpay-gold' 
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ) : (
                <div className="mt-2">
                  {/* Collapsible header */}
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
                  
                  {/* Collapsible children */}
                  <div 
                    className={`overflow-hidden transition-all duration-200 ease-in-out ${
                      expanded[item.name] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="space-y-0.5 mt-1 ml-2 border-l border-thubpay-border/40 pl-2">
                      {item.children!.map((child) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all group ${
                              isChildActive 
                                ? 'bg-thubpay-gold/10 text-thubpay-gold' 
                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
                            }`}
                          >
                            <child.icon className="w-4 h-4" />
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-thubpay-border">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 group">
          <MessageSquare className="w-4 h-4 text-thubpay-gold group-hover:animate-pulse" />
          AI Assistant
          <span className="ml-auto flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-thubpay-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-thubpay-gold"></span>
          </span>
        </button>
      </div>
    </aside>
  );
}
