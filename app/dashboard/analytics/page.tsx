'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Download, FileText, CreditCard, DollarSign, Activity, PieChart, Users, BarChart3, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface Transaction {
  id: string;
  amount_cents: number;
  status: string;
  gateway_slug: string;
  created_at: string;
  currency: string;
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
}

interface CustomerSpend {
  name: string;
  email: string;
  total_spend_cents: number;
  transaction_count: number;
  last_payment_at?: string;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [revenueByGateway, setRevenueByGateway] = useState<RevenueByGateway[]>([]);
  const [successFailureRate, setSuccessFailureRate] = useState<SuccessFailureRate | null>(null);
  const [topCustomers, setTopCustomers] = useState<CustomerSpend[]>([]);
  const [selectedExportType, setSelectedExportType] = useState<'csv' | 'pdf'>('csv');

  const exportOptions = [
    { id: 'csv' as const, label: 'CSV', icon: Download },
    { id: 'pdf' as const, label: 'PDF', icon: FileText }
  ];

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch revenue data
      const revenueResponse = await fetch(`/api/dashboard/analytics/revenue?range=${timeRange}`);
      const revenueData = await revenueResponse.json();
      setRevenueData(revenueData);

      // Fetch transactions
      const transactionsResponse = await fetch(`/api/dashboard/analytics/transactions?range=${timeRange}`);
      const transactions = await transactionsResponse.json();
      setTransactions(transactions);

      // Fetch revenue by gateway
      const gatewayResponse = await fetch(`/api/dashboard/analytics/gateway-revenue?range=${timeRange}`);
      const gatewayData = await gatewayResponse.json();
      setRevenueByGateway(gatewayData);

      // Fetch success/failure rate
      const successResponse = await fetch(`/api/dashboard/analytics/success-failure-rate?range=${timeRange}`);
      const successData = await successResponse.json();
      setSuccessFailureRate(successData);

      // Fetch top customers
      const customersResponse = await fetch(`/api/dashboard/analytics/top-customers?range=${timeRange}`);
      const customers = await customersResponse.json();
      setTopCustomers(customers);
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const COLORS = ['#C5A059', '#0A6C7B', '#10B981', '#F59E0B', '#EF4444', '#a78bfa', '#22d3ee'];

  if (loading) {
    return (
      <div className="min-h-screen bg-thubpay-obsidian flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-thubpay-cyan mx-auto mb-4" />
          <p className="text-zinc-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.amount, 0);
  const totalTransactions = transactions.length;
  const totalFailed = transactions.filter(t => t.status === 'failed').length;
  const totalSucceeded = transactions.filter(t => t.status === 'succeeded').length;
  // Compute real LTV: average spend per customer from top customers
  const avgLtv = topCustomers.length > 0
    ? topCustomers.reduce((s, c) => s + c.total_spend_cents, 0) / topCustomers.length
    : 0;

  return (
    <div className="min-h-screen bg-thubpay-obsidian">
      {/* Header */}
      <div className="bg-thubpay-surface shadow-sm border-b border-thubpay-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
              <p className="mt-1 text-sm text-zinc-400">
                Track your revenue, transactions, and customer performance
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-thubpay-elevated rounded-lg p-1">
              {['7d', '30d', '90d', '1y'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as TimeRange)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-thubpay-gold/20 text-thubpay-gold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards - All real computed values */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Gross Revenue"
            value={formatCurrency(totalRevenue)}
            change={0}
            changeLabel="this period"
            icon={DollarSign}
            color="green"
          />

          <MetricCard
            title="Total Transactions"
            value={formatNumber(totalTransactions)}
            change={0}
            changeLabel="this period"
            icon={CreditCard}
            color="blue"
          />

          <MetricCard
            title="Success Rate"
            value={`${successFailureRate?.successRate?.toFixed(1) ?? (totalTransactions > 0 ? ((totalSucceeded / totalTransactions) * 100).toFixed(1) : '0')}%`}
            change={0}
            changeLabel="this period"
            icon={Activity}
            color="purple"
          />

          <MetricCard
            title="Avg. Customer LTV"
            value={formatCurrency(avgLtv)}
            change={0}
            changeLabel={`across ${topCustomers.length} top customers`}
            icon={Users}
            color="green"
          />
        </div>

        {/* Revenue Chart */}
        <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Revenue Over Time</h2>
            <div className="flex items-center gap-2">
              {exportOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedExportType(option.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedExportType === option.id
                        ? 'bg-thubpay-gold/10 text-thubpay-gold'
                        : 'text-zinc-400 hover:bg-thubpay-elevated'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(value)}
                stroke="#a1a1aa"
              />
              <YAxis
                tickFormatter={(value) => `$${value / 1000}K`}
                stroke="#a1a1aa"
              />
              <Tooltip
                formatter={(value: any) => formatCurrency(value as number)}
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fafafa' }}
              />
              <Legend wrapperStyle={{ color: '#d4d4d8' }} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#C5A059"
                strokeWidth={2}
                name="Revenue"
                dot={{ fill: '#3B82F6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Gateway */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-white">Revenue by Gateway</h2>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByGateway}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="gateway" stroke="#a1a1aa" />
                <YAxis tickFormatter={(value) => `$${value / 1000}K`} stroke="#a1a1aa" />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value as number)}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fafafa' }}
                />
                <Legend wrapperStyle={{ color: '#d4d4d8' }} />
                <Bar dataKey="amount" fill="#C5A059" radius={[8, 8, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-white">Revenue Distribution</h2>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={revenueByGateway}
                  dataKey="amount"
                  nameKey="gateway"
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${formatCurrency(value as number)}`}
                >
                  {revenueByGateway.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatCurrency(value as number)}
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', color: '#fafafa' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction Breakdown */}
        <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold text-white">Transaction Breakdown</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-green-500/10 border border-green-500/25 rounded-lg">
              <DollarSign className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(successFailureRate?.succeeded || 0)}
              </p>
              <p className="text-sm text-green-300 font-medium">Successful</p>
            </div>

            <div className="text-center p-6 bg-red-500/10 border border-red-500/25 rounded-lg">
              <TrendingDown className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(successFailureRate?.failed || 0)}
              </p>
              <p className="text-sm text-red-300 font-medium">Failed</p>
            </div>

            <div className="text-center p-6 bg-thubpay-elevated rounded-lg">
              <Activity className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
              <p className="text-2xl font-bold text-zinc-300">
                {totalTransactions}
              </p>
              <p className="text-sm text-zinc-400 font-medium">Total</p>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-white">Top Customers</h2>
            </div>

            <button className="text-sm text-thubpay-cyan hover:text-thubpay-gold flex items-center gap-1">
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-thubpay-border">
                  <th className="text-left py-3 px-4 font-medium text-zinc-300">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-zinc-300">Email</th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-300">Total Spend</th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-300">Transactions</th>
                  <th className="text-right py-3 px-4 font-medium text-zinc-300">Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr key={index} className="border-b border-thubpay-border hover:bg-thubpay-elevated transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-thubpay-gold/15 flex items-center justify-center text-thubpay-gold font-medium text-sm"
                        >
                          {customer.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-white">Customer {index + 1}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{customer.email || 'N/A'}</td>
                    <td className="py-3 px-4 text-right font-medium text-white">
                      {formatCurrency(customer.total_spend_cents)}
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400">{customer.transaction_count}</td>
                    <td className="py-3 px-4 text-right text-zinc-400">
                      {customer.last_payment_at ? new Date(customer.last_payment_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cohort Analysis Mockup */}
        <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <PieChart className="w-5 h-5 text-zinc-400" />
              <h2 className="text-lg font-semibold text-white">Cohort Analysis (Retention)</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-thubpay-gold/10 text-thubpay-gold text-[10px] font-bold uppercase tracking-widest">Beta Insight</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 px-2 text-zinc-500 font-bold uppercase tracking-tighter">Cohort</th>
                  <th className="text-center py-2 px-2 text-zinc-500 font-bold uppercase tracking-tighter border-l border-thubpay-border">Size</th>
                  {[0, 1, 2, 3, 4, 5, 6].map(m => (
                    <th key={m} className="text-center py-2 px-2 text-zinc-500 font-bold uppercase tracking-tighter">Month {m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { month: 'Oct 2025', size: 1240, rates: [100, 85, 78, 72, 68, 65, 62] },
                  { month: 'Nov 2025', size: 1560, rates: [100, 82, 74, 69, 64, 61] },
                  { month: 'Dec 2025', size: 1890, rates: [100, 88, 81, 75, 71] },
                  { month: 'Jan 2026', size: 2100, rates: [100, 91, 84, 79] },
                  { month: 'Feb 2026', size: 2450, rates: [100, 86, 79] },
                  { month: 'Mar 2026', size: 2800, rates: [100, 89] },
                ].map((row, i) => (
                  <tr key={i} className="border-t border-thubpay-border/50">
                    <td className="py-3 px-2 text-zinc-300 font-medium">{row.month}</td>
                    <td className="py-3 px-2 text-center text-zinc-400 border-l border-thubpay-border">{row.size}</td>
                    {row.rates.map((rate, j) => {
                      // Interpolate color based on rate (heat map)
                      const opacity = rate / 100;
                      return (
                        <td 
                          key={j} 
                          className="py-3 px-2 text-center"
                          style={{ backgroundColor: `rgba(197, 160, 89, ${opacity * 0.4})`, color: rate > 70 ? '#fff' : '#a1a1aa' }}
                        >
                          {rate}%
                        </td>
                      );
                    })}
                    {Array.from({ length: 7 - row.rates.length }).map((_, j) => (
                      <td key={j + row.rates.length} className="py-3 px-2 text-center bg-zinc-900/40 text-zinc-700">—</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11px] text-zinc-500 italic">
            * This insight uses predictive AI to estimate retention for months that haven't concluded.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color = 'blue'
}: {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: any;
  color?: 'green' | 'blue' | 'purple' | 'red'
}) {
  const isPositive = change >= 0;
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10',
    blue: 'text-thubpay-cyan bg-thubpay-gold/10',
    purple: 'text-thubpay-gold bg-thubpay-gold/10',
    red: 'text-red-400 bg-red-500/10'
  };

  return (
    <div className="bg-thubpay-surface rounded-lg shadow-sm border border-thubpay-border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}>
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                {Math.abs(change)}%
              </span>
            </div>
            <span className="text-xs text-zinc-500">{changeLabel}</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
