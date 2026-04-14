'use client';

import { useState, useEffect } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from 'recharts';

interface Props {
  revenueData: { month: string; amount: number }[];
  ledgerData: { name: string; incoming: number; outgoing: number }[];
  invoiceStats: { name: string; value: number }[];
  newClientsData: { month: string; count: number }[];
  disputeStats: { name: string; value: number }[];
  subStats: { name: string; value: number }[];
}

const PIE_COLORS = ['#C5A059', '#0A6C7B', '#10b981', '#6b7280', '#ef4444', '#a78bfa', '#f59e0b'];
const DISPUTE_COLORS: Record<string, string> = {
  'needs response': '#f59e0b',
  'under review': '#3b82f6',
  'won': '#10b981',
  'lost': '#ef4444',
};
const SUB_COLORS: Record<string, string> = {
  'active': '#10b981',
  'trialing': '#3b82f6',
  'past_due': '#f59e0b',
  'canceled': '#ef4444',
  'unpaid': '#6b7280',
  'paused': '#a78bfa',
};

// Animated counter hook
function useAnimatedValue(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const animated = useAnimatedValue(value);
  return <span>{prefix}{animated.toLocaleString()}{suffix}</span>;
}

export default function DashboardOverviewCharts({
  revenueData,
  ledgerData,
  invoiceStats,
  newClientsData,
  disputeStats,
  subStats
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pieData = invoiceStats.length > 0 ? invoiceStats : [{ name: 'No data', value: 1 }];
  const disputePie = disputeStats.length > 0 ? disputeStats : [{ name: 'No disputes', value: 1 }];
  const subPie = subStats.length > 0 ? subStats : [{ name: 'No subscriptions', value: 1 }];
  const totalNewClients = newClientsData.reduce((s, d) => s + d.count, 0);
  const totalRevenue = revenueData.reduce((s, d) => s + d.amount, 0);

  return (
    <div className={`space-y-6 mb-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      
      {/* Row 1: Revenue Area + Invoice Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Revenue Over Time */}
        <div className="md:col-span-2 lg:col-span-2 glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Revenue Overview</h3>
            <span className="text-xs font-bold text-zinc-500">
              Total: <span className="text-thubpay-gold">${totalRevenue.toFixed(2)}</span>
            </span>
          </div>
          <div className="h-[220px] sm:h-[280px] md:h-[300px] w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C5A059" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#C5A059" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a1a1aa', fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#C5A059" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAmount)"
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Status Pie */}
        <div className="flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white mb-2">Invoice Status</h3>
            <div className="h-[180px] sm:h-[200px] w-full min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                    animationDuration={1200}
                    animationEasing="ease-out"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa' }}
                    itemStyle={{ color: '#fafafa' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {pieData.map((stat, i) => (
                <div key={`${stat.name}-${i}`} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {stat.name} ({stat.value})
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: New Clients Bar + Cash Flow Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Clients Bar Chart */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">New Clients</h3>
            <span className="text-xs font-bold text-zinc-500">
              Total: <span className="text-green-400"><AnimatedNumber value={totalNewClients} /></span>
            </span>
          </div>
          <div className="h-[200px] sm:h-[220px] w-full min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={newClientsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa' }}
                  formatter={(value: any) => [value, 'New Clients']}
                />
                <Bar 
                  dataKey="count" 
                  name="New Clients" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={40} 
                  animationDuration={1500}
                  animationEasing="ease-out"
                >
                  {newClientsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash Flow Bar Chart */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
          <h3 className="text-lg font-bold text-white mb-4">Cash Flow</h3>
          <div className="h-[200px] sm:h-[220px] w-full min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ledgerData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, '']}
                />
                <Legend wrapperStyle={{ color: '#a1a1aa', fontSize: 12 }} />
                <Bar dataKey="incoming" name="Incoming" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={1500} />
                <Bar dataKey="outgoing" name="Outgoing" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Dispute Pie + Subscription Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Disputes Breakdown */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white">Dispute Status</h3>
            <a href="/dashboard/disputes" className="text-xs font-semibold text-thubpay-gold hover:text-thubpay-gold/80">View All →</a>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={disputePie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1200}
                  animationEasing="ease-out"
                >
                  {disputePie.map((entry, index) => (
                    <Cell key={`d-${index}`} fill={DISPUTE_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {disputePie.map((stat, i) => (
              <div key={stat.name} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 capitalize">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DISPUTE_COLORS[stat.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                {stat.name} ({stat.value})
              </div>
            ))}
          </div>
        </div>

        {/* Subscription Status */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white">Subscription Status</h3>
            <a href="/dashboard/subscriptions" className="text-xs font-semibold text-thubpay-gold hover:text-thubpay-gold/80">View All →</a>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                  animationDuration={1200}
                  animationEasing="ease-out"
                >
                  {subPie.map((entry, index) => (
                    <Cell key={`s-${index}`} fill={SUB_COLORS[entry.name] || PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa' }}
                  itemStyle={{ color: '#fafafa' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {subPie.map((stat, i) => (
              <div key={stat.name} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 capitalize">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SUB_COLORS[stat.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                {stat.name} ({stat.value})
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
