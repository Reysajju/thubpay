'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  CreditCard,
  DollarSign,
  Activity,
  PieChart,
  Users,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface InvoiceStatusStat {
  status: string;
  count: number;
  total_cents: number;
}

interface RevenueDataPoint {
  date: string;
  amount: number;
}

interface RevenueByGateway {
  gateway: string;
  amount: number;
  count: number;
}

interface SuccessFailureRate {
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  failureRate: number;
  trend?: { date: string; success: number; failed: number }[];
}

interface CustomerSpend {
  name: string;
  email: string;
  total_spend_cents: number;
  transaction_count: number;
  last_payment_at?: string;
}

interface Props {
  invoiceStats: InvoiceStatusStat[];
  workspaceId: string;
}

const COLORS = ['#10B981', '#0A6C7B', '#10B981', '#F59E0B', '#EF4444', '#a78bfa', '#22d3ee'];

const GATEWAY_COLORS: Record<string, string> = {
  Stripe: '#635BFF',
  PayPal: '#0070BA',
  Square: '#00A97D',
  Adyen: '#0ABF53',
  Razorpay: '#3395ff',
  manual: '#8a8680',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getAvatarGradient(seed: string): string {
  const gradients = [
    'from-amber-500/20 to-orange-600/20 text-amber-400',
    'from-emerald-500/20 to-teal-600/20 text-emerald-400',
    'from-blue-500/20 to-indigo-600/20 text-blue-400',
    'from-purple-500/20 to-pink-600/20 text-purple-400',
    'from-rose-500/20 to-red-600/20 text-rose-400',
    'from-cyan-500/20 to-sky-600/20 text-cyan-400',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export default function AnalyticsChartsClient({ invoiceStats, workspaceId }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [revenueByGateway, setRevenueByGateway] = useState<RevenueByGateway[]>([]);
  const [successFailureRate, setSuccessFailureRate] = useState<SuccessFailureRate | null>(null);
  const [topCustomers, setTopCustomers] = useState<CustomerSpend[]>([]);

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [revenueRes, gatewayRes, successRes, customersRes] = await Promise.all([
        fetch(`/api/dashboard/analytics/revenue?range=${timeRange}`),
        fetch(`/api/dashboard/analytics/gateway-revenue?range=${timeRange}`),
        fetch(`/api/dashboard/analytics/success-failure-rate?range=${timeRange}`),
        fetch(`/api/dashboard/analytics/top-customers?range=${timeRange}`),
      ]);

      const revenueJson = await revenueRes.json();
      const gatewayJson = await gatewayRes.json();
      const successJson = await successRes.json();
      const customersJson = await customersRes.json();

      setRevenueData(revenueJson.revenue || []);
      setRevenueByGateway(gatewayJson.gateway_revenue || []);
      setSuccessFailureRate({
        total: successJson.total || 0,
        succeeded: successJson.succeeded || 0,
        failed: successJson.failed || 0,
        successRate: parseFloat(successJson.success_rate || '0'),
        failureRate: parseFloat(successJson.failure_rate || '0'),
        trend: successJson.trend || [],
      });
      setTopCustomers(customersJson.top_customers || []);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#10B981]/10 mb-4">
                <Activity className="w-6 h-6 text-[#10B981] animate-pulse" />
              </div>
              <p className="text-zinc-400 text-sm">Loading analytics...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.amount, 0);
  const totalTransactions = successFailureRate?.total ?? 0;
  const paidInvoices = invoiceStats.find((s) => s.status === 'paid');
  const allInvoices = invoiceStats.reduce((s, i) => s + i.count, 0);
  const avgLtv =
    topCustomers.length > 0
      ? topCustomers.reduce((s, c) => s + c.total_spend_cents, 0) / topCustomers.length
      : 0;

  const paymentSuccessRate = allInvoices > 0 ? (paidInvoices?.count ?? 0) / allInvoices * 100 : 0;

  const pieData = [
    { name: 'Paid', value: paidInvoices?.count ?? 0, fill: '#10B981' },
    { name: 'Pending', value: allInvoices - (paidInvoices?.count ?? 0), fill: '#F59E0B' },
    { name: 'Overdue', value: invoiceStats.find((s) => s.status === 'overdue')?.count ?? 0, fill: '#EF4444' },
    { name: 'Void', value: invoiceStats.find((s) => s.status === 'void')?.count ?? 0, fill: '#71717a' },
  ].filter((d) => d.value > 0);

  // Generate insights
  const insights: { icon: any; text: string; color: string; bg: string }[] = [];
  if (totalRevenue > 0) {
    insights.push({
      icon: TrendingUp,
      text: `Total revenue of ${formatCurrency(totalRevenue)} collected this period across ${totalTransactions} transactions.`,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    });
  }
  if (paymentSuccessRate >= 80) {
    insights.push({
      icon: CheckCircle2,
      text: `Strong invoice conversion rate of ${paymentSuccessRate.toFixed(1)}% — ${paidInvoices?.count ?? 0} of ${allInvoices} invoices paid.`,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    });
  } else if (paymentSuccessRate > 0 && paymentSuccessRate < 60) {
    insights.push({
      icon: AlertCircle,
      text: `Invoice conversion rate is ${paymentSuccessRate.toFixed(1)}% — consider following up on unpaid invoices.`,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    });
  }
  if (revenueByGateway.length > 0) {
    const topGateway = revenueByGateway.reduce((a, b) => (a.amount > b.amount ? a : b));
    insights.push({
      icon: CreditCard,
      text: `${topGateway.gateway} is your top gateway with ${formatCurrency(topGateway.amount)} in revenue.`,
      color: 'text-[#10B981]',
      bg: 'bg-[#10B981]/10 border-[#10B981]/20',
    });
  }
  if (topCustomers.length > 0) {
    const topCustomer = topCustomers[0];
    insights.push({
      icon: Users,
      text: `${topCustomer.name} is your top customer with ${formatCurrency(topCustomer.total_spend_cents)} in lifetime spend.`,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    });
  }
  const overdueCount = invoiceStats.find((s) => s.status === 'overdue')?.count ?? 0;
  if (overdueCount > 0) {
    insights.push({
      icon: AlertCircle,
      text: `${overdueCount} invoice${overdueCount > 1 ? 's are' : ' is'} overdue — follow up to recover outstanding revenue.`,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    });
  }

  const trendData = successFailureRate?.trend || [];

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full border border-[#10B981]/20">
                <Sparkles className="w-3 h-3" />
                {timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : timeRange === '90d' ? 'Last 90 days' : 'Last year'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Analytics
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Track your revenue, transactions, and customer performance in real time.
            </p>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-[#1a1a1f] border border-[#252529] rounded-xl p-1">
            {(['7d', '30d', '90d', '1y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  timeRange === range
                    ? 'bg-[#10B981]/20 text-[#10B981] shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : '1Y'}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-1">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-400">
                <TrendingUp className="w-3 h-3" />
              </span>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Gross Revenue
            </p>
            <p className="text-xl sm:text-2xl font-black text-white animate-count">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">this period</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-2">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Transactions
            </p>
            <p className="text-xl sm:text-2xl font-black text-white animate-count">
              {formatNumber(totalTransactions)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {successFailureRate?.succeeded ?? 0} succeeded
            </p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-3">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Success Rate
            </p>
            <p className="text-xl sm:text-2xl font-black text-green-400 animate-count">
              {paymentSuccessRate.toFixed(1)}%
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">invoice conversion</p>
          </div>

          <div className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 animate-stagger stagger-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
              Avg Customer LTV
            </p>
            <p className="text-xl sm:text-2xl font-black text-white animate-count">
              {formatCurrency(avgLtv)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              across {topCustomers.length} top customers
            </p>
          </div>
        </div>

        {/* AI Insights */}
        {insights.length > 0 && (
          <div className="mb-6 animate-fadeIn">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-[#10B981]" />
                </div>
                <h3 className="text-sm font-bold text-white">Smart Insights</h3>
                <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded">
                  AI
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => {
                  const Icon = insight.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border ${insight.bg} animate-stagger stagger-${Math.min(i + 1, 6)}`}
                    >
                      <Icon className={`w-4 h-4 ${insight.color} flex-shrink-0 mt-0.5`} />
                      <p className="text-xs text-zinc-300 leading-relaxed">{insight.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Revenue Chart */}
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Revenue Over Time</h2>
                <p className="text-[11px] text-zinc-500">Daily revenue trend</p>
              </div>
            </div>
            <a
              href="/api/dashboard/export?type=transactions"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1f] border border-[#252529] text-xs font-medium text-zinc-300 hover:text-[#10B981] hover:border-[#10B981]/30 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </a>
          </div>

          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252529" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDate(value)}
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value / 1000}K`}
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value as number), 'Revenue']}
                  contentStyle={{
                    backgroundColor: '#131316',
                    border: '1px solid #252529',
                    borderRadius: '12px',
                    color: '#fafafa',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  name="Revenue"
                  dot={{ fill: '#10B981', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <TrendingUp className="w-10 h-10 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No revenue data for this period</p>
              <p className="text-xs text-zinc-600 mt-1">Revenue will appear here once payments are processed</p>
            </div>
          )}
        </div>

        {/* Success/Failure Trend + Payment Success Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
          {/* Success/Failure Trend */}
          <div className="glass-card rounded-2xl p-5 animate-fadeIn">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Payment Success Rate</h2>
                <p className="text-[11px] text-zinc-500">
                  {successFailureRate?.succeeded ?? 0} succeeded / {successFailureRate?.failed ?? 0} failed
                </p>
              </div>
            </div>

            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252529" />
                  <XAxis dataKey="date" stroke="#52525b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#52525b" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#131316',
                      border: '1px solid #252529',
                      borderRadius: '12px',
                      color: '#fafafa',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                  <Bar dataKey="success" fill="#10B981" radius={[4, 4, 0, 0]} name="Success %" />
                  <Bar dataKey="failed" fill="#EF4444" radius={[4, 4, 0, 0]} name="Failed %" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <PieChart className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No trend data yet</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {successFailureRate
                    ? `${successFailureRate.successRate}% success rate overall`
                    : 'Payment data will appear here'}
                </p>
              </div>
            )}
          </div>

          {/* Invoice Status Pie */}
          <div className="glass-card rounded-2xl p-5 animate-fadeIn">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-[#10B981]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Invoice Status</h2>
                <p className="text-[11px] text-zinc-500">{allInvoices} total invoices</p>
              </div>
            </div>

            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: '#52525b' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#131316',
                      border: '1px solid #252529',
                      borderRadius: '12px',
                      color: '#fafafa',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-center">
                <PieChart className="w-10 h-10 text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No invoice data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue by Gateway */}
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Revenue by Gateway</h2>
              <p className="text-[11px] text-zinc-500">
                {revenueByGateway.length} active {revenueByGateway.length === 1 ? 'gateway' : 'gateways'}
              </p>
            </div>
          </div>

          {revenueByGateway.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByGateway} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#252529" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => `$${value / 1000}K`}
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="gateway"
                  stroke="#52525b"
                  tick={{ fontSize: 11 }}
                  width={100}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value as number), 'Revenue']}
                  contentStyle={{
                    backgroundColor: '#131316',
                    border: '1px solid #252529',
                    borderRadius: '12px',
                    color: '#fafafa',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="amount" radius={[0, 8, 8, 0]} name="Revenue">
                  {revenueByGateway.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={GATEWAY_COLORS[entry.gateway] || COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[280px] text-center">
              <BarChart3 className="w-10 h-10 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No gateway revenue data</p>
              <p className="text-xs text-zinc-600 mt-1">Connect a gateway to see revenue breakdown</p>
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="glass-card rounded-2xl p-5 mb-6 animate-fadeIn">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Top Customers</h2>
                <p className="text-[11px] text-zinc-500">By lifetime spend</p>
              </div>
            </div>
            <a
              href="/dashboard/customers"
              className="flex items-center gap-1 text-xs text-[#10B981] hover:text-[#34D399] transition-colors group"
            >
              View All
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          {topCustomers.length > 0 ? (
            <div className="space-y-2">
              {topCustomers.map((customer, index) => {
                const gradient = getAvatarGradient(customer.name || customer.email || index.toString());
                const initials = (customer.name || customer.email || 'U')
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const maxSpend = topCustomers[0]?.total_spend_cents || 1;
                const spendPct = Math.round((customer.total_spend_cents / maxSpend) * 100);

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors animate-stagger stagger-${Math.min(index + 1, 5)}`}
                  >
                    <span className="text-[10px] font-bold text-zinc-600 w-5 text-center">
                      #{index + 1}
                    </span>
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-xs`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{customer.name}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{customer.email}</p>
                    </div>
                    <div className="flex-shrink-0 w-24">
                      <div className="h-1.5 rounded-full bg-[#1a1a1f] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#10B981]/60 to-[#34D399]"
                          style={{ width: `${Math.max(spendPct, 3)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right w-20">
                      <p className="text-sm font-bold text-white">
                        {formatCurrency(customer.total_spend_cents)}
                      </p>
                      <p className="text-[10px] text-zinc-500">{customer.transaction_count} txns</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-10 h-10 text-zinc-700 mb-2" />
              <p className="text-sm text-zinc-500">No customer data yet</p>
              <p className="text-xs text-zinc-600 mt-1">Top customers will appear here</p>
            </div>
          )}
        </div>

        {/* Invoice Status Breakdown */}
        <div className="glass-card rounded-2xl p-5 animate-fadeIn">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Invoice Status Breakdown</h2>
              <p className="text-[11px] text-zinc-500">{allInvoices} total invoices</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {invoiceStats.map((stat) => {
              const colorMap: Record<string, { bg: string; text: string; border: string }> = {
                draft: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/25' },
                sent: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/25' },
                viewed: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/25' },
                paid: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/25' },
                overdue: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/25' },
                void: { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-[#252529]' },
              };
              const cfg = colorMap[stat.status] || colorMap.draft;
              return (
                <div
                  key={stat.status}
                  className={`p-4 rounded-xl border text-center ${cfg.bg} ${cfg.border} transition-all hover:scale-105`}
                >
                  <p className={`text-2xl font-black ${cfg.text}`}>{stat.count}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${cfg.text}`}>
                    {stat.status}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">{formatCurrency(stat.total_cents)}</p>
                </div>
              );
            })}
            {invoiceStats.length === 0 && (
              <div className="col-span-full py-8 text-center text-zinc-500 text-sm">
                No invoices found for this workspace.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
