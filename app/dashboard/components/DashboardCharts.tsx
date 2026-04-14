'use client';

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
  YAxis
} from 'recharts';

interface Props {
  revenueData: { month: string; amount: number }[];
  ledgerData: { name: string; incoming: number; outgoing: number }[];
  invoiceStats: { name: string; value: number }[];
}

const PIE_COLORS = ['#C5A059', '#0A6C7B', '#6b7280', '#10b981', '#ef4444'];

export default function DashboardCharts({ revenueData, ledgerData, invoiceStats }: Props) {
  const pieData =
    invoiceStats.length > 0
      ? invoiceStats
      : [{ name: 'No data', value: 1 }];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* Revenue Over Time - Area Chart */}
      <div className="md:col-span-2 lg:col-span-2 glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
        <h3 className="text-lg font-bold text-white mb-6">Revenue Overview</h3>
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
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Invoice Status Distribution - Pie Chart */}
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
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1f2937', fontWeight: 600 }}
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

      {/* Cash Ledger - Bar Chart */}
      <div className="md:col-span-2 lg:col-span-3 glass-card rounded-3xl p-4 sm:p-6 bg-thubpay-surface/80 shadow-sm border border-thubpay-border min-w-0">
        <h3 className="text-lg font-bold text-white mb-6">Cash Flow (Incoming vs Outgoing)</h3>
        <div className="h-[200px] sm:h-[230px] md:h-[250px] w-full min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ledgerData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" />
              <XAxis 
                dataKey="name" 
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
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.4)' }}
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, '']}
              />
              <Bar dataKey="incoming" name="Incoming" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="outgoing" name="Outgoing" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
