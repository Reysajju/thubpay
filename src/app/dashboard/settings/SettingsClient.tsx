'use client';

import React, { useState } from 'react';
import {
  setMonthlyTarget,
  addGatewayCredential,
  deleteGatewayCredential,
  toggleGatewayActive,
  setDefaultGateway,
  createBrand,
  updateNotificationPreferences,
  getNotificationPreferences,
} from '../actions';
import {
  Settings,
  CreditCard,
  Target,
  Plus,
  Trash2,
  Key,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Building2,
  DollarSign,
  Zap,
  Star,
  Power,
  Loader2,
  Upload,
  Shield,
  Bell,
} from 'lucide-react';

interface GatewayCredential {
  id: string;
  gateway_slug: string;
  label: string;
  publishable_key: string | null;
  mode: string;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  plan: string;
  monthly_target_cents: number | null;
}

interface Props {
  workspace: Workspace;
  gateways: GatewayCredential[];
}

type Tab = 'general' | 'gateways' | 'billing' | 'notifications';

const GATEWAY_PROVIDERS = [
  { value: 'stripe', label: 'Stripe', icon: '💳' },
  { value: 'paypal', label: 'PayPal', icon: '🅿️' },
  { value: 'square', label: 'Square', icon: '⬜' },
  { value: 'razorpay', label: 'Razorpay', icon: '⚡' },
  { value: 'adyen', label: 'Adyen', icon: '🔷' },
  { value: 'authorize_net', label: 'Authorize.Net', icon: '🔐' },
  { value: 'braintree', label: 'Braintree', icon: '🔶' },
  { value: 'mollie', label: 'Mollie', icon: '🔵' },
  { value: 'custom', label: 'Custom Gateway', icon: '🔌' },
] as const;

const GATEWAY_ICONS: Record<string, string> = {
  stripe: '💳',
  paypal: '🅿️',
  square: '⬜',
  adyen: '🔷',
  razorpay: '⚡',
  authorize_net: '🔐',
  braintree: '🔶',
  mollie: '🔵',
  custom: '🔌',
  manual: '✋',
};

const PLAN_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  free: { label: 'Free', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/25' },
  pro: { label: 'Pro', color: 'text-[#10B981]', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/25' },
  scale: { label: 'Scale', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25' },
  enterprise: { label: 'Enterprise', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
};

export default function SettingsClient({ workspace, gateways: initialGateways }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // ── Target state ──────────────────────────────────────────────
  const [targetUsd, setTargetUsd] = useState<string>(
    workspace.monthly_target_cents ? (workspace.monthly_target_cents / 100).toString() : '0'
  );
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetMessage, setTargetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Workspace name state ──────────────────────────────────────
  const [workspaceName, setWorkspaceName] = useState(workspace.name);
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMessage, setNameMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ── Gateway list state ────────────────────────────────────────
  const [gateways, setGateways] = useState<GatewayCredential[]>(initialGateways);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  // ── Gateway form state ────────────────────────────────────────
  const [gatewaySlug, setGatewaySlug] = useState('stripe');
  const [label, setLabel] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [mode, setMode] = useState('test');
  const [isDefault, setIsDefault] = useState(false);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayMessage, setGatewayMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // ── Handle set target ─────────────────────────────────────────
  const handleSetTarget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTargetLoading(true);
    setTargetMessage(null);
    const formData = new FormData(e.currentTarget);
    try {
      await setMonthlyTarget(formData);
      setTargetMessage({ type: 'success', text: 'Monthly revenue target updated successfully!' });
    } catch (err: any) {
      setTargetMessage({ type: 'error', text: err.message || 'Failed to update target.' });
    } finally {
      setTargetLoading(false);
    }
  };

  // ── Handle workspace name update ──────────────────────────────
  const handleNameUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMessage(null);
    const formData = new FormData(e.currentTarget);
    try {
      await createBrand(formData);
      setNameMessage({ type: 'success', text: 'Workspace name updated!' });
    } catch (err: any) {
      setNameMessage({ type: 'error', text: err.message || 'Failed to update name.' });
    } finally {
      setNameLoading(false);
    }
  };

  // ── Handle add gateway ────────────────────────────────────────
  const handleAddGateway = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGatewayLoading(true);
    setGatewayMessage(null);
    const formData = new FormData(e.currentTarget);
    if (isDefault) formData.append('is_default', 'on');
    try {
      const res = await addGatewayCredential(formData);
      if (res?.error) {
        setGatewayMessage({ type: 'error', text: res.error });
      } else {
        setGatewayMessage({ type: 'success', text: 'Payment gateway connected successfully!' });
        setLabel('');
        setPublishableKey('');
        setSecretKey('');
        setIsDefault(false);
        setGateways((prev) => [
          {
            id: crypto.randomUUID(),
            gateway_slug: gatewaySlug,
            label,
            publishable_key: publishableKey || null,
            mode,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch (err: any) {
      setGatewayMessage({ type: 'error', text: err.message || 'Failed to save gateway.' });
    } finally {
      setGatewayLoading(false);
    }
  };

  // ── Handle delete gateway ─────────────────────────────────────
  const handleDeleteGateway = async (id: string, labelText: string) => {
    if (!confirm(`Are you sure you want to disconnect "${labelText}"? This action cannot be undone.`)) return;
    setDeleteLoading(id);
    try {
      const res = await deleteGatewayCredential(id);
      if (res?.error) {
        alert(`Error: ${res.error}`);
      } else {
        setGateways((prev) => prev.filter((gw) => gw.id !== id));
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setToggleLoading(id);
    try {
      await setDefaultGateway(id);
      window.location.reload();
    } catch {
      setToggleLoading(null);
    }
  };

  const planConfig = PLAN_CONFIG[workspace.plan] || PLAN_CONFIG.free;
  const activeGatewayCount = gateways.filter((g) => g.mode === 'live').length;
  const testGatewayCount = gateways.filter((g) => g.mode === 'test').length;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'gateways', label: 'Gateways', icon: CreditCard },
    { id: 'billing', label: 'Billing', icon: DollarSign },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <section className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fadeIn">
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${planConfig.color} ${planConfig.bg} px-2 py-0.5 rounded-full border ${planConfig.border}`}>
              <Star className="w-3 h-3" />
              {planConfig.label} Plan
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Manage your workspace profile, payment gateways, and billing preferences.
          </p>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 mb-6 bg-[#131316] border border-[#252529] rounded-xl p-1 w-fit animate-fadeIn">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'gateways' ? gateways.length : undefined;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-[#10B981]/20 text-[#10B981] shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count !== undefined && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── GENERAL TAB ───────────────────────────────────────── */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Workspace Profile Card */}
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Workspace Profile</h2>
                  <p className="text-[11px] text-zinc-500">Basic workspace information</p>
                </div>
              </div>

              <form onSubmit={handleNameUpdate} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Plan</p>
                    <p className={`text-sm font-bold ${planConfig.color}`}>{planConfig.label}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Workspace ID</p>
                    <p className="text-xs font-mono text-zinc-400 truncate">{workspace.id}</p>
                  </div>
                </div>

                {nameMessage && (
                  <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    nameMessage.type === 'success'
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {nameMessage.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {nameMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={nameLoading}
                  className="btn-gradient px-4 py-2 rounded-xl text-black text-xs font-bold disabled:opacity-50 transition-all"
                >
                  {nameLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>

            {/* Logo upload placeholder */}
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Upload className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Brand Logo</h2>
                  <p className="text-[11px] text-zinc-500">Displayed on invoices and checkout pages</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#059669] to-[#34D399] flex items-center justify-center text-2xl font-black text-black flex-shrink-0">
                  {workspace.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-400 mb-2">PNG, JPG, or SVG up to 5MB</p>
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          await fetch('/api/dashboard/upload-logo', { method: 'POST', body: formData });
                          window.location.reload();
                        } catch {
                          alert('Upload failed');
                        }
                      };
                      input.click();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1f] border border-[#252529] text-xs font-medium text-zinc-300 hover:text-[#10B981] hover:border-[#10B981]/30 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Logo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GATEWAYS TAB ──────────────────────────────────────── */}
        {activeTab === 'gateways' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Gateway stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-black text-white">{gateways.length}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Total</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-black text-green-400">{activeGatewayCount}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Live</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-lg font-black text-amber-400">{testGatewayCount}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Test</p>
              </div>
            </div>

            {/* Connected Gateways */}
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-[#10B981]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Connected Gateways</h2>
                    <p className="text-[11px] text-zinc-500">Your BYOG integrations</p>
                  </div>
                </div>
                <a
                  href="/dashboard/settings/gateways"
                  className="text-xs text-[#10B981] hover:text-[#34D399] transition-colors"
                >
                  Advanced →
                </a>
              </div>

              <div className="space-y-2">
                {gateways.length === 0 ? (
                  <div className="py-10 text-center">
                    <CreditCard className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">No gateways connected yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Add a gateway below to start accepting payments</p>
                  </div>
                ) : (
                  gateways.map((gw, i) => (
                    <div
                      key={gw.id}
                      className={`flex items-center gap-3 p-3 rounded-xl bg-[#0a0a0b] border border-[#252529]/50 hover:border-[#10B981]/30 transition-all animate-stagger stagger-${Math.min(i + 1, 6)}`}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#1a1a1f] border border-[#252529] flex items-center justify-center text-lg">
                        {GATEWAY_ICONS[gw.gateway_slug] || '🔗'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{gw.label}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${
                            gw.mode === 'live'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {gw.mode}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">
                          {GATEWAY_PROVIDERS.find((p) => p.value === gw.gateway_slug)?.label ?? gw.gateway_slug}
                        </p>
                        {gw.publishable_key && (
                          <p className="text-[10px] font-mono text-zinc-600 truncate mt-0.5">
                            {gw.publishable_key.slice(0, 20)}...
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleSetDefault(gw.id)}
                        disabled={toggleLoading === gw.id}
                        className="flex-shrink-0 p-2 rounded-lg text-zinc-500 hover:text-[#10B981] hover:bg-[#10B981]/10 transition-all"
                        title="Set as default"
                      >
                        {toggleLoading === gw.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Star className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteGateway(gw.id, gw.label)}
                        disabled={deleteLoading === gw.id}
                        className="flex-shrink-0 p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete gateway"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deleteLoading === gw.id ? 'animate-pulse text-red-400' : ''}`} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add New Gateway Form */}
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Connect New Gateway</h2>
                  <p className="text-[11px] text-zinc-500">Secret keys are encrypted at rest</p>
                </div>
              </div>

              <form onSubmit={handleAddGateway} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Gateway Provider
                    </label>
                    <select
                      name="gateway_slug"
                      value={gatewaySlug}
                      onChange={(e) => setGatewaySlug(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer"
                    >
                      {GATEWAY_PROVIDERS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.icon} {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Mode
                    </label>
                    <select
                      name="mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all cursor-pointer"
                    >
                      <option value="test">🧪 Test / Sandbox</option>
                      <option value="live">🟢 Live / Production</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Label / Name
                  </label>
                  <input
                    type="text"
                    name="label"
                    required
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Stripe USD Live Wallet"
                    className="w-full px-3 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Publishable Key (Optional)
                    </label>
                    <input
                      type="text"
                      name="publishable_key"
                      value={publishableKey}
                      onChange={(e) => setPublishableKey(e.target.value)}
                      placeholder="pk_test_..."
                      className="w-full px-3 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                      Secret Key (Required)
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input
                        type={showSecret ? 'text' : 'password'}
                        name="secret_key"
                        required
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        placeholder="sk_test_..."
                        className="w-full pl-9 pr-9 py-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                      >
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#10B981]"
                  />
                  <span className="text-xs text-zinc-300">Set as default gateway</span>
                </label>

                {gatewayMessage && (
                  <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    gatewayMessage.type === 'success'
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {gatewayMessage.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {gatewayMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={gatewayLoading}
                  className="btn-gradient flex items-center gap-2 px-4 py-2.5 rounded-xl text-black text-xs font-bold disabled:opacity-50 transition-all"
                >
                  {gatewayLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Connect Gateway
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── BILLING TAB ──────────────────────────────────────── */}
        {activeTab === 'billing' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Financial Target */}
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Revenue Target</h2>
                  <p className="text-[11px] text-zinc-500">Monthly gross volume goal for dashboard tracking</p>
                </div>
              </div>

              <form onSubmit={handleSetTarget} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Monthly Gross Target (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">$</span>
                    <input
                      type="number"
                      name="target_usd"
                      required
                      min="0"
                      step="0.01"
                      value={targetUsd}
                      onChange={(e) => setTargetUsd(e.target.value)}
                      placeholder="5000.00"
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#1a1a1f] border border-[#252529] text-sm text-white outline-none focus:border-[#10B981]/40 transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-1.5">
                    Current target: <span className="text-[#10B981] font-semibold">
                      ${(workspace.monthly_target_cents ? workspace.monthly_target_cents / 100 : 0).toFixed(2)}
                    </span>
                  </p>
                </div>

                {targetMessage && (
                  <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    targetMessage.type === 'success'
                      ? 'bg-green-500/10 border-green-500/20 text-green-400'
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {targetMessage.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {targetMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={targetLoading}
                  className="btn-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-black text-xs font-bold disabled:opacity-50 transition-all"
                >
                  {targetLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Target className="w-3.5 h-3.5" />
                      Save Target
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Plan info */}
            <div className="glass-card rounded-2xl p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#10B981]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Current Plan</h2>
                  <p className="text-[11px] text-zinc-500">Your subscription tier</p>
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${planConfig.border} ${planConfig.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Star className={`w-5 h-5 ${planConfig.color}`} />
                    <span className={`text-lg font-black ${planConfig.color}`}>{planConfig.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Active</span>
                </div>
                <p className="text-xs text-zinc-400">
                  {workspace.plan === 'free' && 'Basic features for getting started. Upgrade to unlock unlimited gateways and advanced analytics.'}
                  {workspace.plan === 'pro' && 'Unlimited gateways, advanced analytics, and priority support.'}
                  {workspace.plan === 'scale' && 'Multi-workspace support, dedicated infrastructure, and SLA guarantees.'}
                  {workspace.plan === 'enterprise' && 'Custom integrations, dedicated account manager, and white-glove onboarding.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab workspaceId={workspace.id} />
        )}
      </div>
    </section>
  );
}

// ─── Notifications Tab ───────────────────────────────────────

const NOTIFICATION_TYPES = [
  { type: 'payment', label: 'Payments', desc: 'Payment received, invoice paid, refund issued', icon: '💰', color: 'text-emerald-400' },
  { type: 'success', label: 'Success', desc: 'Invoice sent, gateway connected, encryption upgraded', icon: '✅', color: 'text-green-400' },
  { type: 'info', label: 'Info', desc: 'New gateway connected, ledger entries, general activity', icon: 'ℹ️', color: 'text-blue-400' },
  { type: 'warning', label: 'Warnings', desc: 'Invoice overdue, SLA threshold updates', icon: '⚠️', color: 'text-amber-400' },
  { type: 'error', label: 'Errors', desc: 'SLA breaches, webhook failures, refund errors', icon: '❌', color: 'text-red-400' },
  { type: 'dispute', label: 'Disputes', desc: 'Payment disputes, chargebacks', icon: '⚖️', color: 'text-red-400' },
];

function NotificationsTab({ workspaceId }: { workspaceId: string }) {
  const [mutedTypes, setMutedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await getNotificationPreferences()) as any;
        if (!cancelled && res?.success) {
          setMutedTypes(res.mutedTypes || []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load preferences');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  function toggleType(type: string) {
    setMutedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = (await updateNotificationPreferences(mutedTypes)) as any;
      if (res?.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(res?.error || 'Failed to save preferences');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="inline-block w-5 h-5 border-2 border-[#10B981]/30 border-t-[#10B981] rounded-full animate-spin" />
        <p className="text-xs text-zinc-500 mt-2">Loading notification preferences...</p>
      </div>
    );
  }

  const activeCount = NOTIFICATION_TYPES.length - mutedTypes.length;

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header card */}
      <div className="glass-card rounded-2xl p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-[#10B981]" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white">Notification Preferences</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Control which types of notifications you receive. Muted types won&apos;t appear in the bell or the notifications API.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              {activeCount} ACTIVE
            </span>
            {mutedTypes.length > 0 && (
              <span className="px-2 py-1 rounded-full bg-zinc-700/30 text-zinc-400 border border-zinc-700/40 font-bold">
                {mutedTypes.length} MUTED
              </span>
            )}
          </div>
        </div>

        {/* Type toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NOTIFICATION_TYPES.map((nt) => {
            const isMuted = mutedTypes.includes(nt.type);
            return (
              <div
                key={nt.type}
                className={`p-3 rounded-xl border transition-all ${
                  isMuted
                    ? 'bg-zinc-700/[0.04] border-zinc-700/30 opacity-60'
                    : 'bg-[#0a0a0c]/40 border-[#252529]/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#1a1a1f] flex items-center justify-center text-base">
                    {nt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-bold ${isMuted ? 'text-zinc-500' : 'text-white'}`}>
                        {nt.label}
                      </p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                        isMuted
                          ? 'bg-zinc-700/30 text-zinc-500 border border-zinc-700/40'
                          : `bg-emerald-500/10 ${nt.color} border border-emerald-500/20`
                      }`}>
                        {isMuted ? 'MUTED' : 'ON'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500">{nt.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleType(nt.type)}
                    className={`flex-shrink-0 relative w-9 h-5 rounded-full transition-colors ${
                      isMuted ? 'bg-zinc-700' : 'bg-[#10B981]'
                    }`}
                    role="switch"
                    aria-checked={!isMuted}
                    aria-label={`Toggle ${nt.label} notifications`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        isMuted ? 'left-0.5' : 'translate-x-4 left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#252529]/40">
          <p className="text-[11px] text-zinc-500">
            Changes apply to new notifications immediately. Existing notifications are not affected.
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 animate-scaleIn">
                <CheckCircle className="w-3 h-3" />
                Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Preferences'
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
