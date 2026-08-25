'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Key,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  X,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface GatewayCredential {
  id: string;
  gateway_slug: string;
  label: string;
  publishable_key: string | null;
  mode: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

interface AvailableGateway {
  slug: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

// ── Gateway catalog ──────────────────────────────────────────────────

const AVAILABLE_GATEWAYS: AvailableGateway[] = [
  { slug: 'stripe', name: 'Stripe', icon: '💳', color: '#635BFF', description: 'Accept cards, ACH, and 135+ currencies worldwide.' },
  { slug: 'paypal', name: 'PayPal', icon: '🅿️', color: '#003087', description: 'Global payments with PayPal Checkout and Venmo.' },
  { slug: 'square', name: 'Square', icon: '⬜', color: '#00A97D', description: 'In-person and online payments for retail & services.' },
  { slug: 'adyen', name: 'Adyen', icon: '🔷', color: '#0ABF53', description: 'Enterprise-grade unified commerce for global brands.' },
  { slug: 'braintree', name: 'Braintree', icon: '🔶', color: '#3298dc', description: 'PayPal subsidiary — full-stack payment platform.' },
  { slug: 'razorpay', name: 'Razorpay', icon: '⚡', color: '#3395ff', description: 'Leading payment gateway for Indian businesses.' },
];

// ── Component ────────────────────────────────────────────────────────

interface Props {
  initialGateways: GatewayCredential[];
}

export default function GatewaySettings({ initialGateways }: Props) {
  const [gateways, setGateways] = useState<GatewayCredential[]>(initialGateways);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [formLabel, setFormLabel] = useState('');
  const [formPublishableKey, setFormPublishableKey] = useState('');
  const [formSecretKey, setFormSecretKey] = useState('');
  const [formMode, setFormMode] = useState<'test' | 'live'>('test');
  const [showSecret, setShowSecret] = useState(false);

  // ── Refresh gateways from API (after add/delete) ────────────
  const fetchGateways = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/settings/gateways');
      if (!res.ok) throw new Error('Failed to fetch gateways');
      const data = await res.json();
      setGateways(data.gateways || []);
    } catch (err) {
      console.error('Error fetching gateways:', err);
      setMessage({ type: 'error', text: 'Failed to load gateway credentials.' });
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Open modal for a specific gateway ──────────────────────────
  const openAddModal = (slug: string) => {
    const gw = AVAILABLE_GATEWAYS.find(g => g.slug === slug);
    if (!gw) return;
    setSelectedGateway(slug);
    setFormLabel(gw.name);
    setFormPublishableKey('');
    setFormSecretKey('');
    setFormMode('test');
    setShowSecret(false);
    setShowModal(true);
  };

  // ── Submit new gateway ─────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/dashboard/settings/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway_slug: selectedGateway,
          label: formLabel,
          publishable_key: formPublishableKey || null,
          secret_key: formSecretKey,
          mode: formMode,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage({ type: 'error', text: data.error || 'Failed to add gateway' });
      } else {
        setMessage({ type: 'success', text: `${formLabel} connected successfully!` });
        setShowModal(false);
        fetchGateways(); // Refresh list
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete gateway ─────────────────────────────────────────────
  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to disconnect "${label}"? This cannot be undone.`)) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/dashboard/settings/gateways/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage({ type: 'error', text: data.error || 'Failed to delete gateway' });
      } else {
        setMessage({ type: 'success', text: `"${label}" disconnected.` });
        setGateways(prev => prev.filter(g => g.id !== id));
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setDeleting(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────
  const getGatewayInfo = (slug: string) => AVAILABLE_GATEWAYS.find(g => g.slug === slug);
  const isConnected = (slug: string) => gateways.some(g => g.gateway_slug === slug);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-thubpay-obsidian p-4 sm:p-8 text-zinc-100">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-thubpay-border/30 pb-6">
          <div className="w-12 h-12 rounded-2xl bg-thubpay-gold/10 flex items-center justify-center border border-thubpay-gold/20">
            <CreditCard className="w-6 h-6 text-thubpay-gold" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Payment Gateway Settings</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Add and manage your BYOG credentials. Each workspace can have its own gateway configuration.
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="p-4 bg-thubpay-blue/20 border border-thubpay-blue/40 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-thubpay-gold flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-thubpay-gold font-semibold mb-1">Security Notice</h3>
              <p className="text-sm text-zinc-400">
                Your API keys are encrypted with <strong className="text-zinc-200">AES-256-GCM</strong> before being stored in the database.
                Only your workspace can access these keys. Secret keys are never returned to the client after storage.
              </p>
            </div>
          </div>
        </div>

        {/* Message banner */}
        {message && (
          <div className={`p-3.5 rounded-xl border flex items-center gap-2 text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto opacity-60 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Available Gateways Grid ────────────────────────────── */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Available Gateways</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_GATEWAYS.map((gateway) => {
              const active = isConnected(gateway.slug);
              return (
                <div
                  key={gateway.slug}
                  className={`p-5 rounded-2xl border-2 transition-all ${
                    active
                      ? 'border-green-500/40 bg-green-500/5'
                      : 'border-thubpay-border bg-thubpay-elevated hover:border-thubpay-gold/50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{gateway.icon}</span>
                    <div>
                      <h3 className="font-semibold text-white">{gateway.name}</h3>
                      <p className="text-xs text-zinc-500">Bring Your Own Gateway</p>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{gateway.description}</p>
                  <button
                    onClick={() => !active && openAddModal(gateway.slug)}
                    className={`w-full px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      active
                        ? 'bg-green-500/20 text-green-400 cursor-default border border-green-500/20'
                        : 'btn-gradient text-[#111] hover:opacity-90 shadow-md shadow-thubpay-gold/10'
                    }`}
                    disabled={active}
                  >
                    {active ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Connected
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Gateway
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Current Gateways List ──────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Loading gateways...
          </div>
        ) : gateways.length > 0 ? (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Your Gateways</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {gateways.map((gateway) => {
                const info = getGatewayInfo(gateway.gateway_slug);
                return (
                  <div
                    key={gateway.id}
                    className="p-4 bg-thubpay-elevated border border-thubpay-border rounded-xl flex items-start justify-between"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Key className="w-5 h-5 text-thubpay-gold flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{gateway.label}</h3>
                        <p className="text-sm text-zinc-400 mb-2">{info?.name ?? gateway.gateway_slug}</p>
                        <div className="flex items-center gap-2 text-xs flex-wrap">
                          <span className={`px-2 py-1 rounded-full ${
                            gateway.mode === 'test' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {gateway.mode === 'test' ? 'Test Mode' : 'Live Mode'}
                          </span>
                          {gateway.publishable_key && (
                            <span className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                              Pub: {gateway.publishable_key.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(gateway.id, gateway.label)}
                      disabled={deleting === gateway.id}
                      className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
                      title="Delete gateway"
                    >
                      <Trash2 className={`w-4 h-4 ${deleting === gateway.id ? 'animate-pulse text-red-400' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Add Gateway Modal ──────────────────────────────────── */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-thubpay-elevated border border-thubpay-border rounded-2xl p-6 w-full max-w-md animate-slideUp">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">{getGatewayInfo(selectedGateway)?.icon}</span>
                  Add {getGatewayInfo(selectedGateway)?.name} Gateway
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Label */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Gateway Label
                  </label>
                  <input
                    type="text"
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder={`My ${getGatewayInfo(selectedGateway)?.name} Account`}
                    className="w-full px-3.5 py-2.5 bg-[#1d1d20] border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-all"
                    required
                  />
                </div>

                {/* Publishable Key */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Publishable Key / Client ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={formPublishableKey}
                    onChange={(e) => setFormPublishableKey(e.target.value)}
                    placeholder="pk_test_..."
                    className="w-full px-3.5 py-2.5 bg-[#1d1d20] border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-all font-mono text-sm"
                  />
                </div>

                {/* Secret Key */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Secret Key (Required)
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={formSecretKey}
                      onChange={(e) => setFormSecretKey(e.target.value)}
                      placeholder="sk_test_xxxxxxxxxxxxx"
                      className="w-full pl-9 pr-10 py-2.5 bg-[#1d1d20] border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-thubpay-gold/50 transition-all font-mono text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1.5">
                    Encrypted with AES-256-GCM before storage. Never shared or returned.
                  </p>
                </div>

                {/* Mode selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Integration Mode
                  </label>
                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value="test"
                        checked={formMode === 'test'}
                        onChange={() => setFormMode('test')}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formMode === 'test'
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-thubpay-border bg-[#1d1d20] hover:border-thubpay-gold/50'
                      }`}>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-400" />
                          <span className="text-sm font-medium text-white">Test Mode</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 text-center">Use sandbox/test keys</p>
                      </div>
                    </label>
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="mode"
                        value="live"
                        checked={formMode === 'live'}
                        onChange={() => setFormMode('live')}
                        className="sr-only"
                      />
                      <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        formMode === 'live'
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-thubpay-border bg-[#1d1d20] hover:border-thubpay-gold/50'
                      }`}>
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                          <span className="text-sm font-medium text-white">Live Mode</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 text-center">Use production keys</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-thubpay-border text-zinc-300 hover:bg-white/5 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formSecretKey}
                    className="flex-1 btn-gradient px-4 py-3 rounded-xl text-[#111] hover:opacity-90 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    {submitting ? 'Connecting...' : 'Add Gateway'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
