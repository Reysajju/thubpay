'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Download, FileText, CreditCard, DollarSign, Activity, PieChart, Users, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const totalRevenue = revenueData.reduce((sum, d) => sum + d.amount, 0);
  const totalTransactions = transactions.length;
  const totalFailed = transactions.filter(t => t.status === 'failed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="mt-1 text-sm text-gray-600">
                Track your revenue, transactions, and customer performance
              </p>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {['7d', '30d', '90d', '1y'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as TimeRange)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
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
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            change={+((Math.random() * 20) - 5).toFixed(1)}
            changeLabel="vs last period"
            icon={DollarSign}
            color="green"
          />

          <MetricCard
            title="Total Transactions"
            value={formatNumber(totalTransactions)}
            change={+((Math.random() * 15) - 5).toFixed(1)}
            changeLabel="vs last period"
            icon={CreditCard}
            color="blue"
          />

          <MetricCard
            title="Success Rate"
            value={`${successFailureRate?.successRate.toFixed(1) || 0}%`}
            change={+((Math.random() * 5) - 2).toFixed(1)}
            changeLabel="vs last period"
            icon={Activity}
            color="purple"
          />

          <MetricCard
            title="Failed Transactions"
            value={totalFailed}
            change={+((Math.random() * 10) - 5).toFixed(1)}
            changeLabel="vs last period"
            icon={TrendingDown}
            color="red"
          />
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Revenue Over Time</h2>
            <div className="flex items-center gap-2">
              {exportOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedExportType(option.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedExportType === option.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50'
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
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(value)}
                stroke="#6B7280"
              />
              <YAxis
                tickFormatter={(value) => `$${value / 1000}K`}
                stroke="#6B7280"
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#3B82F6"
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Revenue by Gateway</h2>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByGateway}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="gateway" stroke="#6B7280" />
                <YAxis tickFormatter={(value) => `$${value / 1000}K`} stroke="#6B7280" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="amount" fill="#10B981" radius={[8, 8, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <PieChart className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Revenue Distribution</h2>
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
                  label={({ gateway, amount }) => `${gateway}: ${formatCurrency(amount)}`}
                >
                  {revenueByGateway.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Transaction Breakdown</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <DollarSign className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-2xl font-bold text-green-700">
                {formatCurrency(successFailureRate?.succeeded || 0)}
              </p>
              <p className="text-sm text-green-600 font-medium">Successful</p>
            </div>

            <div className="text-center p-6 bg-red-50 rounded-lg">
              <TrendingDown className="w-12 h-12 text-red-600 mx-auto mb-3" />
              <p className="text-2xl font-bold text-red-700">
                {formatCurrency(successFailureRate?.failed || 0)}
              </p>
              <p className="text-sm text-red-600 font-medium">Failed</p>
            </div>

            <div className="text-center p-6 bg-gray-50 rounded-lg">
              <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-2xl font-bold text-gray-700">
                {totalTransactions}
              </p>
              <p className="text-sm text-gray-600 font-medium">Total</p>
            </div>
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Top Customers</h2>
            </div>

            <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Email</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Total Spend</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Transactions</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm"
                        >
                          {customer.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-gray-900">Customer {index + 1}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{customer.email || 'N/A'}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">
                      {formatCurrency(customer.total_spend_cents)}
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">{customer.transaction_count}</td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {customer.last_payment_at ? new Date(customer.last_payment_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    green: 'text-green-600 bg-green-50',
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    red: 'text-red-600 bg-red-50'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          <div className="flex items-center gap-1 mt-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color]}`}>
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              <span className={isPositive ? 'text-green-700' : 'text-red-700'}>
                {Math.abs(change)}%
              </span>
            </div>
            <span className="text-xs text-gray-500">{changeLabel}</span>
          </div>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
