'use client';

import React, { useState } from 'react';
import {
  Key,
  Copy,
  Check,
  CheckCircle,
  Play,
  Pause,
  Bug,
  Globe,
  Lock,
  History,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Code2,
  BookOpen,
  Webhook,
  Trash,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  Download,
} from 'lucide-react';
import WebhookDeliverySparkline from '../components/WebhookDeliverySparkline';
import UptimeHistoryChart from '../components/UptimeHistoryChart';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface ApiKey {
  id: string;
  label: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookEvent {
  id: string;
  gateway_name: string;
  event_id: string;
  event_type: string;
  processed_at: string | null;
  created_at: string;
}

interface Gateway {
  id: string;
  gateway_slug: string;
  label: string;
  publishable_key: string | null;
  is_live: boolean;
  is_active: boolean;
  created_at: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  label: string;
  events: string[];
  is_active: boolean;
  has_secret: boolean;
  last_triggered_at: string | null;
  last_status: string | null;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_event_id: string | null;
  webhook_endpoint_id: string | null;
  status: string;
  status_code: number | null;
  error: string | null;
  duration_ms: number | null;
  attempted_at: string;
}

interface EndpointStats {
  total_deliveries: number;
  successful: number;
  failed: number;
  success_rate: number;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
  min_latency_ms: number | null;
  max_latency_ms: number | null;
  last_delivery_at: string | null;
}

interface Props {
  apiKeys: ApiKey[];
  webhookEvents: WebhookEvent[];
  gateways: Gateway[];
  webhookEndpoints: WebhookEndpoint[];
  webhookDeliveries: WebhookDelivery[];
  endpointStats: Record<string, EndpointStats>;
  endpointTrends: Record<string, any[]>;
  endpointUptime: Record<string, any>;
  workspaceId: string;
}

const CODE_SNIPPETS = [
  {
    language: 'curl',
    label: 'cURL',
    code: `curl -X POST https://api.thubpay.com/v1/charges \\
  -H "Authorization: Bearer tp_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2000,
    "currency": "usd",
    "gateway": "stripe",
    "description": "Invoice #INV-0001"
  }'`
  },
  {
    language: 'javascript',
    label: 'Node.js',
    code: `const ThubPay = require('thubpay')(sk_live_...);

const charge = await ThubPay.charges.create({
  amount: 2000,
  currency: 'usd',
  gateway: 'stripe',
  description: 'Invoice #INV-0001',
});`
  },
  {
    language: 'python',
    label: 'Python',
    code: `import thubpay

thubpay.api_key = "sk_live_..."

charge = thubpay.Charge.create(
    amount=2000,
    currency="usd",
    gateway="stripe",
    description="Invoice #INV-0001",
)`
  }
];

const VERIFY_SNIPPET = `import crypto from 'crypto';
import express from 'express';

const app = express();

// IMPORTANT: use raw body for signature verification — JSON parsing
// would change the byte sequence and break the HMAC.
app.use('/webhooks/thubpay', express.raw({ type: 'application/json' }));

app.post('/webhooks/thubpay', (req, res) => {
  const sig = req.headers['x-thubpay-signature'] || '';
  const secret = process.env.THUBPAY_WEBHOOK_SECRET!;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(req.body.toString());
  console.log('Received event:', event.event);

  switch (event.event) {
    case 'invoice.viewed':
      // A client just opened an invoice!
      console.log('Invoice', event.data.invoice_number, 'viewed by', event.data.client_name);
      break;
    case 'webhook.test':
      console.log('Test event received — endpoint is working!');
      break;
  }

  res.status(200).send('OK');
});`;

export default function DeveloperToolsClient({ apiKeys, webhookEvents, gateways, webhookEndpoints, webhookDeliveries, endpointStats, endpointTrends, endpointUptime, workspaceId }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [activeSnippet, setActiveSnippet] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [showEndpointForm, setShowEndpointForm] = useState(false);
  const [endpointForm, setEndpointForm] = useState({
    label: '',
    url: '',
    events: '*',
    secret: '',
    is_active: true,
  });
  const [endpointSubmitting, setEndpointSubmitting] = useState(false);
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const [endpointSuccess, setEndpointSuccess] = useState<string | null>(null);
  const [deletingEndpoint, setDeletingEndpoint] = useState<string | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [togglingEndpoint, setTogglingEndpoint] = useState<string | null>(null);
  const [retryingDelivery, setRetryingDelivery] = useState<string | null>(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<string>>(new Set());
  const [bulkActionPending, setBulkActionPending] = useState(false);
  const [bulkActionMessage, setBulkActionMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
  }>({ title: '', onConfirm: async () => {} });

  const requestConfirm = (cfg: {
    title: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void>;
  }) => {
    setConfirmConfig(cfg);
    setConfirmOpen(true);
  };

  const handleConfirmDialog = async () => {
    setConfirmBusy(true);
    try {
      await confirmConfig.onConfirm();
    } finally {
      setConfirmBusy(false);
      setConfirmOpen(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateKey = async () => {
    if (!newKeyLabel.trim()) return;
    setCreatingKey(true);
    try {
      const res = await fetch('/api/dashboard/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel.trim(), scopes: ['read', 'write'] })
      });
      if (res.ok) {
        setNewKeyLabel('');
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to create API key:', err);
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    setDeletingKey(id);
    try {
      await fetch(`/api/dashboard/settings/api-keys/${id}`, { method: 'DELETE' });
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete API key:', err);
    } finally {
      setDeletingKey(null);
    }
  };

  // ── Bulk action helpers ──
  function toggleEndpointSelection(id: string) {
    setSelectedEndpointIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllEndpoints() {
    setSelectedEndpointIds(new Set(webhookEndpoints.map((ep) => ep.id)));
  }

  function clearSelection() {
    setSelectedEndpointIds(new Set());
  }

  async function handleBulkAction(action: 'pause' | 'resume' | 'delete') {
    const ids = Array.from(selectedEndpointIds);
    if (ids.length === 0) return;

    if (action === 'delete') {
      requestConfirm({
        title: `Delete ${ids.length} endpoint${ids.length === 1 ? '' : 's'}?`,
        description: 'This cannot be undone.',
        confirmLabel: 'Delete',
        onConfirm: async () => {
          setBulkActionPending(true);
          setBulkActionMessage(null);
          try {
            const { bulkDeleteWebhookEndpoints } = await import('@/app/dashboard/actions');
            const res: any = await bulkDeleteWebhookEndpoints(ids);
            if (res?.success) {
              setBulkActionMessage(`Successfully deleted ${res.deleted ?? ids.length} endpoint${ids.length === 1 ? '' : 's'}.`);
              clearSelection();
              // Reload after a short delay to show the message
              setTimeout(() => window.location.reload(), 1500);
            } else {
              setBulkActionMessage(res?.error || 'Bulk action failed');
            }
          } catch (err: any) {
            setBulkActionMessage(err?.message || 'Unexpected error');
          } finally {
            setBulkActionPending(false);
          }
        },
      });
      return;
    }

    setBulkActionPending(true);
    setBulkActionMessage(null);
    try {
      const { bulkToggleWebhookEndpoints } = await import('@/app/dashboard/actions');
      const res: any = await bulkToggleWebhookEndpoints(ids, action === 'resume');
      if (res?.success) {
        const verb = action === 'pause' ? 'paused' : 'resumed';
        setBulkActionMessage(`Successfully ${verb} ${res.updated ?? ids.length} endpoint${ids.length === 1 ? '' : 's'}.`);
        clearSelection();
        // Reload after a short delay to show the message
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setBulkActionMessage(res?.error || 'Bulk action failed');
      }
    } catch (err: any) {
      setBulkActionMessage(err?.message || 'Unexpected error');
    } finally {
      setBulkActionPending(false);
    }
  }

  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Developer Portal
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Manage your API integrations, security keys, and real-time webhook events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {gateways.length > 0 && (
              <div className="flex gap-2">
                {gateways.map((g) => (
                  <span key={g.id} className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    g.is_live
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {g.gateway_slug} {g.is_live ? 'Live' : 'Test'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: API Keys + Webhooks (spans 2) */}
          <div className="lg:col-span-2 space-y-6">
            {/* API Keys */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">API Keys</h3>
                    <p className="text-xs text-zinc-500 mt-1">{apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} registered</p>
                  </div>
                </div>
              </div>

              {/* Create New Key */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Key label (e.g., Production API)"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#1a1a1f] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/40 transition placeholder:text-zinc-600"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                />
                <button
                  onClick={handleCreateKey}
                  disabled={creatingKey || !newKeyLabel.trim()}
                  className="btn-gradient px-4 py-2.5 rounded-xl text-[#111] text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {creatingKey ? (
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Create
                </button>
              </div>

              <div className="space-y-3">
                {apiKeys.length === 0 && (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    No API keys found. Create one above to get started.
                  </div>
                )}
                {apiKeys.map((k) => (
                  <div key={k.id} className="p-4 rounded-2xl bg-white/5 border border-[#252529] hover:border-[#10B981]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-white">{k.label || 'Unnamed Key'}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest border ${
                          k.is_active
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {k.is_active ? 'active' : 'revoked'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-zinc-400 text-xs">
                        <code className="bg-black/40 px-2 py-0.5 rounded truncate">
                          {showKeys[k.id] ? `${k.key_prefix}...${k.key_hash?.slice(0, 8) || ''}` : `${k.key_prefix}${'•'.repeat(20)}`}
                        </code>
                        <button onClick={() => toggleKeyVisibility(k.id)} className="text-zinc-500 hover:text-[#10B981] transition-colors">
                          {showKeys[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(k.id, `${k.key_prefix}...`)}
                          className="text-zinc-500 hover:text-[#10B981] transition-colors"
                        >
                          {copiedId === k.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {k.scopes && k.scopes.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {k.scopes.map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1f] text-zinc-500 font-mono">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-bold text-zinc-600 uppercase">Last Used</p>
                        <p className="text-xs text-zinc-400">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(k.id)}
                        disabled={deletingKey === k.id}
                        className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete API key"
                      >
                        {deletingKey === k.id ? (
                          <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gateway Credentials Status */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">Gateway Credentials</h3>
                    <p className="text-xs text-zinc-500 mt-1">Connected payment gateway configurations</p>
                  </div>
                </div>
                <a
                  href="/dashboard/settings/gateways"
                  className="px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-xl text-xs font-bold transition-all border border-[#10B981]/20"
                >
                  Configure
                </a>
              </div>

              {gateways.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm">
                  <AlertCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p>No gateways configured yet.</p>
                  <p className="text-xs mt-1">Go to Settings → Gateways to add your first payment gateway.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {gateways.map(g => (
                    <div key={g.id} className="p-4 rounded-xl bg-white/5 border border-[#252529] flex items-center justify-between hover:border-[#10B981]/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-200 uppercase">{g.gateway_slug}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            g.is_live ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {g.is_live ? 'Live' : 'Test'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{g.label || 'No label'}</p>
                        {g.publishable_key && (
                          <code className="text-[10px] text-zinc-600 font-mono mt-1 block truncate max-w-[200px]">
                            {g.publishable_key.slice(0, 12)}...
                          </code>
                        )}
                      </div>
                      <div className={`w-2.5 h-2.5 rounded-full ${g.is_active ? 'bg-green-400' : 'bg-zinc-600'}`} title={g.is_active ? 'Active' : 'Inactive'} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Webhook Endpoints */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                    <Webhook className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">Webhook Endpoints</h3>
                    <p className="text-xs text-zinc-500 mt-1">Configure where gateway events are sent</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowEndpointForm((v) => !v);
                    setEndpointError(null);
                    setEndpointSuccess(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5 hover:bg-[#10B981]/10 hover:border-[#10B981]/50 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showEndpointForm ? 'Cancel' : 'Add Endpoint'}
                </button>
              </div>

              {/* Inline success / error banner */}
              {endpointError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 animate-scaleIn">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{endpointError}</p>
                </div>
              )}
              {endpointSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 animate-scaleIn">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-300">{endpointSuccess}</p>
                </div>
              )}

              {/* Add Endpoint Form */}
              {showEndpointForm && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setEndpointSubmitting(true);
                    setEndpointError(null);
                    setEndpointSuccess(null);
                    try {
                      const fd = new FormData();
                      fd.append('label', endpointForm.label);
                      fd.append('url', endpointForm.url);
                      fd.append('events', endpointForm.events);
                      fd.append('secret', endpointForm.secret);
                      fd.append('is_active', endpointForm.is_active ? 'on' : 'off');
                      const { addWebhookEndpoint } = await import('@/app/dashboard/actions');
                      const res = (await addWebhookEndpoint(fd)) as any;
                      if (res?.success) {
                        setEndpointSuccess('Endpoint created — test events will be dispatched immediately.');
                        setEndpointForm({ label: '', url: '', events: '*', secret: '', is_active: true });
                        setShowEndpointForm(false);
                      } else {
                        setEndpointError(res?.error || 'Failed to create endpoint');
                      }
                    } catch (err: any) {
                      setEndpointError(err?.message || 'Unexpected error');
                    } finally {
                      setEndpointSubmitting(false);
                    }
                  }}
                  className="mb-4 p-4 rounded-2xl bg-[#0a0a0c] border border-[#252529]/80 animate-scaleIn space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Label
                      </label>
                      <input
                        type="text"
                        required
                        value={endpointForm.label}
                        onChange={(e) => setEndpointForm({ ...endpointForm, label: e.target.value })}
                        placeholder="Slack #payments"
                        className="w-full px-3 py-2 rounded-lg bg-[#131316] border border-[#252529] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/40 focus:border-[#10B981]/50 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        URL
                      </label>
                      <input
                        type="url"
                        required
                        value={endpointForm.url}
                        onChange={(e) => setEndpointForm({ ...endpointForm, url: e.target.value })}
                        placeholder="https://hooks.slack.com/services/..."
                        className="w-full px-3 py-2 rounded-lg bg-[#131316] border border-[#252529] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/40 focus:border-[#10B981]/50 transition font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Subscribed Events
                      </label>
                      <input
                        type="text"
                        value={endpointForm.events}
                        onChange={(e) => setEndpointForm({ ...endpointForm, events: e.target.value })}
                        placeholder="* (all)  or  invoice.viewed,payment.succeeded"
                        className="w-full px-3 py-2 rounded-lg bg-[#131316] border border-[#252529] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/40 focus:border-[#10B981]/50 transition font-mono"
                      />
                      <p className="text-[10px] text-zinc-600 mt-1">
                        Use <code className="text-zinc-500">*</code> for all, or comma-separated list. Wildcards like <code className="text-zinc-500">invoice.*</code> supported.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                        Signing Secret (optional)
                      </label>
                      <input
                        type="password"
                        value={endpointForm.secret}
                        onChange={(e) => setEndpointForm({ ...endpointForm, secret: e.target.value })}
                        placeholder="Used to HMAC-sign payloads"
                        className="w-full px-3 py-2 rounded-lg bg-[#131316] border border-[#252529] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]/40 focus:border-[#10B981]/50 transition font-mono"
                      />
                      <p className="text-[10px] text-zinc-600 mt-1">
                        If set, we send <code className="text-zinc-500">X-ThubPay-Signature: sha256=...</code>
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={endpointForm.is_active}
                      onChange={(e) => setEndpointForm({ ...endpointForm, is_active: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-[#252529] accent-[#10B981]"
                    />
                    <span className="text-xs text-zinc-300">Active (start dispatching events immediately)</span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEndpointForm(false);
                        setEndpointError(null);
                      }}
                      className="flex-1 py-2 rounded-lg border border-[#252529] text-zinc-300 text-sm font-semibold hover:bg-white/5 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={endpointSubmitting}
                      className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {endpointSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating…
                        </>
                      ) : (
                        'Create Endpoint'
                      )}
                    </button>
                  </div>
                </form>
              )}

              {webhookEndpoints.length === 0 && !showEndpointForm ? (
                <div className="p-6 text-center text-zinc-500 text-sm">
                  <Globe className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p>No webhook endpoints configured.</p>
                  <p className="text-xs mt-1">
                    Click <span className="text-[#10B981]">Add Endpoint</span> to start receiving <code>invoice.viewed</code> events when clients open invoices.
                  </p>
                </div>
              ) : webhookEndpoints.length === 0 ? null : (
                <div className="space-y-3">
                  {/* Bulk actions bar */}
                  {webhookEndpoints.length > 0 && (
                    <div className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                      selectedEndpointIds.size > 0
                        ? 'bg-[#10B981]/[0.06] border-[#10B981]/30'
                        : 'bg-[#0a0a0c]/40 border-[#252529]/40'
                    }`}>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 transition">
                          <input
                            type="checkbox"
                            checked={selectedEndpointIds.size === webhookEndpoints.length && webhookEndpoints.length > 0}
                            onChange={() => {
                              if (selectedEndpointIds.size === webhookEndpoints.length) {
                                clearSelection();
                              } else {
                                selectAllEndpoints();
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-[#252529] accent-[#10B981] cursor-pointer"
                          />
                          <span className="font-semibold">
                            {selectedEndpointIds.size > 0
                              ? `${selectedEndpointIds.size} selected`
                              : 'Select all'}
                          </span>
                        </label>
                        {selectedEndpointIds.size > 0 && (
                          <button
                            onClick={clearSelection}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {selectedEndpointIds.size > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleBulkAction('resume')}
                            disabled={bulkActionPending}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition disabled:opacity-50 flex items-center gap-1"
                            title="Resume selected endpoints"
                          >
                            <Play className="w-2.5 h-2.5" />
                            Resume
                          </button>
                          <button
                            onClick={() => handleBulkAction('pause')}
                            disabled={bulkActionPending}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition disabled:opacity-50 flex items-center gap-1"
                            title="Pause selected endpoints"
                          >
                            <Pause className="w-2.5 h-2.5" />
                            Pause
                          </button>
                          <button
                            onClick={() => handleBulkAction('delete')}
                            disabled={bulkActionPending}
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition disabled:opacity-50 flex items-center gap-1"
                            title="Delete selected endpoints"
                          >
                            {bulkActionPending ? (
                              <span className="w-2.5 h-2.5 border border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-2.5 h-2.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bulk action message */}
                  {bulkActionMessage && (
                    <div className={`p-2.5 rounded-xl text-xs animate-scaleIn flex items-center gap-2 ${
                      bulkActionMessage.startsWith('Successfully')
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}>
                      {bulkActionMessage.startsWith('Successfully') ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      )}
                      {bulkActionMessage}
                    </div>
                  )}

                  {webhookEndpoints.map((ep) => {
                    const isSelected = selectedEndpointIds.has(ep.id);
                    return (
                    <div
                      key={ep.id}
                      className={`p-4 rounded-xl bg-white/5 border transition-colors ${
                        isSelected
                          ? 'border-[#10B981]/50 bg-[#10B981]/[0.03]'
                          : 'border-[#252529] hover:border-[#10B981]/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {/* Selection checkbox */}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEndpointSelection(ep.id)}
                            className="flex-shrink-0 mt-1 w-3.5 h-3.5 rounded border-[#252529] accent-[#10B981] cursor-pointer"
                            aria-label={`Select ${ep.label}`}
                          />
                          <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-white truncate">{ep.label}</span>
                            {ep.has_secret && (
                              <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-semibold">
                                <Lock className="w-2.5 h-2.5" />
                                SIGNED
                              </span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              ep.is_active
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-zinc-700/30 text-zinc-500 border border-zinc-700/40'
                            }`}>
                              {ep.is_active ? 'ACTIVE' : 'PAUSED'}
                            </span>
                            {ep.last_status && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                ep.last_status === 'success'
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                LAST: {ep.last_status.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <code className="text-xs text-zinc-300 break-all">{ep.url}</code>
                          {ep.events.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {ep.events.map((ev: string) => (
                                <span key={ev} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a1f] text-zinc-500 font-mono border border-[#252529]">{ev}</span>
                              ))}
                            </div>
                          )}
                          {ep.last_triggered_at && (
                            <p className="text-[10px] text-zinc-600 mt-2">
                              Last triggered {new Date(ep.last_triggered_at).toLocaleString()}
                            </p>
                          )}

                          {/* Inline stats summary */}
                          {endpointStats[ep.id] && endpointStats[ep.id].total_deliveries > 0 && (
                            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {(() => {
                                const s = endpointStats[ep.id];
                                const rateColor =
                                  s.success_rate >= 95
                                    ? 'text-emerald-400'
                                    : s.success_rate >= 80
                                      ? 'text-amber-400'
                                      : 'text-red-400';
                                return (
                                  <>
                                    <div className="p-1.5 rounded-md bg-[#0a0a0c]/60 border border-[#252529]/40">
                                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Deliveries</p>
                                      <p className="text-xs font-bold text-white tabular-nums">{s.total_deliveries}</p>
                                    </div>
                                    <div className="p-1.5 rounded-md bg-[#0a0a0c]/60 border border-[#252529]/40">
                                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Success</p>
                                      <p className={`text-xs font-bold tabular-nums ${rateColor}`}>{s.success_rate}%</p>
                                    </div>
                                    <div className="p-1.5 rounded-md bg-[#0a0a0c]/60 border border-[#252529]/40">
                                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">Avg</p>
                                      <p className="text-xs font-bold text-zinc-300 tabular-nums">
                                        {s.avg_latency_ms != null ? `${s.avg_latency_ms}ms` : '—'}
                                      </p>
                                    </div>
                                    <div className="p-1.5 rounded-md bg-[#0a0a0c]/60 border border-[#252529]/40">
                                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">P95</p>
                                      <p className="text-xs font-bold text-zinc-300 tabular-nums">
                                        {s.p95_latency_ms != null ? `${s.p95_latency_ms}ms` : '—'}
                                      </p>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {/* Expandable detailed stats */}
                          {endpointStats[ep.id] && endpointStats[ep.id].total_deliveries > 0 && (
                            <button
                              onClick={() => setExpandedEndpoint(expandedEndpoint === ep.id ? null : ep.id)}
                              className="mt-2 text-[10px] font-semibold text-zinc-500 hover:text-[#10B981] transition flex items-center gap-1"
                            >
                              {expandedEndpoint === ep.id ? 'Hide' : 'Show'} detailed stats
                              <ChevronDown className={`w-3 h-3 transition-transform ${expandedEndpoint === ep.id ? 'rotate-180' : ''}`} />
                            </button>
                          )}
                          {expandedEndpoint === ep.id && endpointStats[ep.id] && (
                            <div className="mt-2 p-3 rounded-lg bg-[#0a0a0c] border border-[#252529]/60 animate-scaleIn">
                              {(() => {
                                const s = endpointStats[ep.id];
                                // Build a sparkline-style bar visualization of the success rate
                                const successPct = s.success_rate;
                                const failedPct = 100 - successPct;
                                return (
                                  <>
                                    <div className="mb-3">
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Success Rate</p>
                                        <p className="text-[10px] font-bold text-white tabular-nums">
                                          {s.successful} ok / {s.failed} failed
                                        </p>
                                      </div>
                                      <div className="flex h-2 rounded-full overflow-hidden bg-[#1a1a1f]">
                                        <div
                                          className="bg-gradient-to-r from-emerald-500 to-emerald-400"
                                          style={{ width: `${successPct}%` }}
                                        />
                                        <div
                                          className="bg-gradient-to-r from-red-500/70 to-red-500"
                                          style={{ width: `${failedPct}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                      <div>
                                        <p className="text-zinc-600">Min</p>
                                        <p className="text-zinc-300 font-mono tabular-nums">
                                          {s.min_latency_ms != null ? `${s.min_latency_ms}ms` : '—'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-zinc-600">Avg</p>
                                        <p className="text-zinc-300 font-mono tabular-nums">
                                          {s.avg_latency_ms != null ? `${s.avg_latency_ms}ms` : '—'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-zinc-600">P95</p>
                                        <p className="text-zinc-300 font-mono tabular-nums">
                                          {s.p95_latency_ms != null ? `${s.p95_latency_ms}ms` : '—'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-zinc-600">P99 / Max</p>
                                        <p className="text-zinc-300 font-mono tabular-nums">
                                          {s.p99_latency_ms != null ? `${s.p99_latency_ms}ms` : '—'}
                                          {s.max_latency_ms != null && (
                                            <span className="text-zinc-600"> / {s.max_latency_ms}ms</span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}

                          {/* Per-endpoint delivery trend sparkline */}
                          {endpointTrends[ep.id] && endpointTrends[ep.id].length > 0 && (
                            <WebhookDeliverySparkline
                              endpointId={ep.id}
                              endpointLabel={ep.label}
                              deliveries={endpointTrends[ep.id]}
                            />
                          )}

                          {/* Per-endpoint uptime history chart (only if there are health checks) */}
                          {endpointUptime[ep.id] && endpointUptime[ep.id].total_checks > 0 && (
                            <UptimeHistoryChart
                              endpointId={ep.id}
                              endpointLabel={ep.label}
                              totalChecks={endpointUptime[ep.id].total_checks}
                              healthyChecks={endpointUptime[ep.id].healthy_checks}
                              unhealthyChecks={endpointUptime[ep.id].unhealthy_checks}
                              uptimeRate={endpointUptime[ep.id].uptime_rate}
                              avgLatencyMs={endpointUptime[ep.id].avg_latency_ms}
                              lastCheckAt={endpointUptime[ep.id].last_check_at}
                              lastStatus={endpointUptime[ep.id].last_status}
                              history={endpointUptime[ep.id].history}
                            />
                          )}
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={async () => {
                              setTestingEndpoint(ep.id);
                              try {
                                const { testWebhookEndpoint } = await import('@/app/dashboard/actions');
                                const res = (await testWebhookEndpoint(ep.id)) as any;
                                if (res?.success) {
                                  setEndpointSuccess(`Test event dispatched to "${ep.label}". Check the deliveries table below.`);
                                  setEndpointError(null);
                                } else {
                                  setEndpointError(res?.error || 'Test failed');
                                  setEndpointSuccess(null);
                                }
                              } catch (err: any) {
                                setEndpointError(err?.message || 'Test failed');
                              } finally {
                                setTestingEndpoint(null);
                              }
                            }}
                            disabled={testingEndpoint === ep.id}
                            className="px-2 py-1 rounded-md text-[10px] font-bold text-[#10B981] border border-[#10B981]/30 bg-[#10B981]/5 hover:bg-[#10B981]/10 transition disabled:opacity-50 flex items-center gap-1"
                            title="Send a test event"
                          >
                            {testingEndpoint === ep.id ? (
                              <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Play className="w-2.5 h-2.5" />
                            )}
                            Test
                          </button>
                          <button
                            onClick={async () => {
                              setTogglingEndpoint(ep.id);
                              try {
                                const { toggleWebhookEndpoint } = await import('@/app/dashboard/actions');
                                await toggleWebhookEndpoint(ep.id, !ep.is_active);
                              } finally {
                                setTogglingEndpoint(null);
                              }
                            }}
                            disabled={togglingEndpoint === ep.id}
                            className="px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 border border-[#252529] hover:border-zinc-600 transition disabled:opacity-50"
                          >
                            {ep.is_active ? 'Pause' : 'Resume'}
                          </button>
                          <a
                            href={`/api/dashboard/webhooks/${ep.id}/deliveries/export`}
                            className="px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 border border-[#252529] hover:border-[#10B981]/50 hover:text-[#10B981] transition flex items-center justify-center gap-1"
                            title="Download full delivery history as CSV"
                          >
                            <Download className="w-2.5 h-2.5" />
                          </a>
                          <button
                            onClick={() => {
                              requestConfirm({
                                title: `Delete endpoint "${ep.label}"?`,
                                description: 'This cannot be undone.',
                                confirmLabel: 'Delete',
                                onConfirm: async () => {
                                  setDeletingEndpoint(ep.id);
                                  try {
                                    const { deleteWebhookEndpoint } = await import('@/app/dashboard/actions');
                                    await deleteWebhookEndpoint(ep.id);
                                  } finally {
                                    setDeletingEndpoint(null);
                                  }
                                },
                              });
                            }}
                            disabled={deletingEndpoint === ep.id}
                            className="px-2 py-1 rounded-md text-[10px] font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {deletingEndpoint === ep.id ? (
                              <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}

              {/* Recent Deliveries audit */}
              {webhookDeliveries.length > 0 && (
                <div className="mt-6 pt-4 border-t border-[#252529]/60">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3 h-3" />
                      Recent Deliveries ({webhookDeliveries.length})
                    </h4>
                    <span className="text-[10px] text-zinc-600">
                      {webhookDeliveries.filter((d) => d.status === 'failed').length} failed · click failed rows to retry
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                    {webhookDeliveries.map((d) => {
                      const isFailed = d.status === 'failed';
                      const isRetrying = retryingDelivery === d.id;
                      return (
                        <div
                          key={d.id}
                          className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0a0a0c]/50 border transition-colors ${
                            isFailed
                              ? 'border-red-500/30 hover:border-red-500/50'
                              : 'border-[#252529]/40 hover:border-[#252529]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              d.status === 'ok'
                                ? 'bg-emerald-400'
                                : d.status === 'failed'
                                  ? 'bg-red-400'
                                  : 'bg-amber-400'
                            }`}
                          />
                          <span className="text-[10px] text-zinc-400 font-mono truncate flex-1" title={d.error || ''}>
                            {d.webhook_event_id?.slice(0, 12) || '—'}
                            {d.error && (
                              <span className="text-red-400/70 ml-2 normal-case">· {d.error.slice(0, 60)}</span>
                            )}
                          </span>
                          <span className={`text-[10px] font-bold tabular-nums ${
                            d.status_code && d.status_code >= 200 && d.status_code < 300
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}>
                            {d.status_code || 'ERR'}
                          </span>
                          <span className="text-[10px] text-zinc-600 flex-shrink-0 tabular-nums">
                            {d.duration_ms ? `${d.duration_ms}ms` : '—'}
                          </span>
                          <span className="text-[10px] text-zinc-600 flex-shrink-0 tabular-nums">
                            {new Date(d.attempted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isFailed && (
                            <button
                              onClick={async () => {
                                setRetryingDelivery(d.id);
                                try {
                                  const { retryWebhookDelivery } = await import('@/app/dashboard/actions');
                                  const res = (await retryWebhookDelivery(d.id)) as any;
                                  if (res?.success) {
                                    setEndpointSuccess('Retry dispatched — check the deliveries list for the new attempt.');
                                    setEndpointError(null);
                                  } else {
                                    setEndpointError(res?.error || 'Retry failed');
                                    setEndpointSuccess(null);
                                  }
                                } catch (err: any) {
                                  setEndpointError(err?.message || 'Retry failed');
                                } finally {
                                  setRetryingDelivery(null);
                                }
                              }}
                              disabled={isRetrying}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition disabled:opacity-50"
                              title="Retry this delivery"
                            >
                              {isRetrying ? (
                                <span className="w-2.5 h-2.5 border border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                              ) : (
                                <RefreshCw className="w-2.5 h-2.5" />
                              )}
                              Retry
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Webhook Events */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">Webhook Events</h3>
                    <p className="text-xs text-zinc-500 mt-1">Real-time event stream from your connected gateways.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-[#252529]">
                  {webhookEvents.length} events
                </span>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs text-left">
                  <thead className="sticky top-0 bg-[#131316] z-10">
                    <tr className="border-b border-[#252529] text-zinc-500 uppercase font-bold tracking-tighter">
                      <th className="pb-3 px-2">Event Type</th>
                      <th className="pb-3 px-2">Gateway</th>
                      <th className="pb-3 px-2">Event ID</th>
                      <th className="pb-3 px-2 text-center">Status</th>
                      <th className="pb-3 px-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252529]/30">
                    {webhookEvents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-zinc-500">No webhook events recorded yet.</td>
                      </tr>
                    )}
                    {webhookEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Play className="w-3 h-3 text-[#10B981]" />
                            <code className="text-zinc-200 font-bold">{e.event_type}</code>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-zinc-400 uppercase font-bold">{e.gateway_name}</td>
                        <td className="py-3 px-2 text-zinc-500 font-mono">{e.event_id?.slice(0, 20)}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            e.processed_at ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {e.processed_at ? 'Processed' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right text-zinc-500">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Webhook Verification Snippet */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#10B981]" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                    Verify Webhook Signatures
                  </h3>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(VERIFY_SNIPPET);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 hover:text-[#10B981] hover:bg-white/5 transition"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
                  {copiedCode ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                If you set a signing secret on an endpoint, every delivery includes an <code className="text-zinc-400">X-ThubPay-Signature</code> header
                containing <code className="text-zinc-400">sha256=...</code> — the HMAC-SHA256 of the raw request body.
              </p>
              <pre className="text-[11px] font-mono text-zinc-300 bg-[#0a0a0c] border border-[#252529] rounded-xl p-3 overflow-x-auto leading-relaxed">
                <code>{VERIFY_SNIPPET}</code>
              </pre>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-[#0a0a0c] border border-[#252529]/50">
                  <p className="text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Header</p>
                  <code className="text-zinc-300">X-ThubPay-Signature</code>
                </div>
                <div className="p-2 rounded-lg bg-[#0a0a0c] border border-[#252529]/50">
                  <p className="text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Format</p>
                  <code className="text-zinc-300">sha256=&lt;hex&gt;</code>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Playground + SDK + Docs + Snippets */}
          <div className="space-y-6">
            {/* API Playground */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60 bg-gradient-to-br from-[#10B981]/5 to-transparent">
              <div className="w-12 h-12 rounded-2xl bg-[#10B981] text-[#111] flex items-center justify-center mb-4 shadow-xl shadow-[#10B981]/20">
                <Bug className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">API Playground</h3>
              <p className="text-sm text-zinc-400 mb-6">Test your integration flows with live data. Safe, sandboxed, and secure.</p>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-[#252529] hover:bg-white/10 transition-colors cursor-pointer group">
                  <Globe className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-zinc-300">HTTP Request Builder</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-[#252529] hover:bg-white/10 transition-colors cursor-pointer group">
                  <Lock className="w-4 h-4 text-[#10B981] group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-zinc-300">Authentication Testing</span>
                </div>
              </div>

              <button className="w-full mt-8 btn-gradient py-3 rounded-xl text-[#111] font-bold text-sm shadow-lg shadow-[#10B981]/20">
                Open Full Playground
              </button>
            </div>

            {/* Code Snippets */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Integration Snippets</h3>
              </div>

              {/* Language Tabs */}
              <div className="flex gap-1 mb-3">
                {CODE_SNIPPETS.map((snippet, idx) => (
                  <button
                    key={snippet.language}
                    onClick={() => setActiveSnippet(idx)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      activeSnippet === idx
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {snippet.label}
                  </button>
                ))}
              </div>

              {/* Code Block */}
              <div className="relative">
                <pre className="p-4 rounded-xl bg-black/60 text-[11px] text-zinc-300 overflow-x-auto font-mono leading-relaxed custom-scrollbar">
                  {CODE_SNIPPETS[activeSnippet].code}
                </pre>
                <button
                  onClick={() => copyCode(CODE_SNIPPETS[activeSnippet].code)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                  title="Copy code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* API Documentation */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-[#10B981]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Documentation</h3>
              </div>

              <div className="space-y-2">
                {[
                  { label: 'API Reference', desc: 'Full REST API documentation' },
                  { label: 'Webhook Events', desc: 'Event types and payloads' },
                  { label: 'Authentication', desc: 'API key & OAuth setup' },
                  { label: 'Error Codes', desc: 'Troubleshooting guide' },
                ].map((doc) => (
                  <div
                    key={doc.label}
                    className="p-3 rounded-xl bg-white/5 border border-[#252529] hover:border-[#10B981]/30 transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-bold text-zinc-200">{doc.label}</p>
                      <p className="text-[10px] text-zinc-500">{doc.desc}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#10B981] transition-colors" />
                  </div>
                ))}
              </div>
            </div>

            {/* SDK Downloads */}
            <div className="glass-card rounded-3xl p-6 border border-[#252529]/60">
              <h3 className="text-sm font-bold mb-4 uppercase tracking-widest text-zinc-500">SDK Downloads</h3>
              <div className="grid grid-cols-2 gap-2">
                {['Node.js', 'Python', 'Go', 'PHP', 'Ruby', 'Java'].map(sdk => (
                  <div key={sdk} className="p-2 rounded-xl bg-[#1a1a1f] border border-[#252529] text-center text-[10px] font-bold text-zinc-400 hover:text-white hover:border-[#10B981]/40 transition-colors cursor-pointer">
                    {sdk}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel || 'Confirm'}
          cancelLabel="Cancel"
          variant="destructive"
          loading={confirmBusy}
          onConfirm={handleConfirmDialog}
        />
      </div>
    </section>
  );
}
