'use client';

import React, { useState } from 'react';
import { 
  Key, 
  Copy, 
  Check, 
  Play, 
  Bug,
  Globe,
  Lock,
  History,
  Eye,
  EyeOff
} from 'lucide-react';

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
  gateway_slug: string;
  is_live: boolean;
  created_at: string;
}

interface Props {
  apiKeys: ApiKey[];
  webhookEvents: WebhookEvent[];
  gateways: Gateway[];
}

export default function DeveloperToolsClient({ apiKeys, webhookEvents, gateways }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
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
                  <span key={g.gateway_slug} className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
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
            <div className="glass-card rounded-3xl p-6 border border-thubpay-border/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-thubpay-gold/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-thubpay-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">API Keys</h3>
                    <p className="text-xs text-zinc-500 mt-1">{apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} registered</p>
                  </div>
                </div>
                <a href="/dashboard/settings" className="px-4 py-2 bg-thubpay-gold/10 hover:bg-thubpay-gold/20 text-thubpay-gold rounded-xl text-xs font-bold transition-all border border-thubpay-gold/20">
                  Manage in Settings
                </a>
              </div>

              <div className="space-y-3">
                {apiKeys.length === 0 && (
                  <div className="p-8 text-center text-zinc-500 text-sm">
                    No API keys found. Create one in Settings → API Keys.
                  </div>
                )}
                {apiKeys.map((k) => (
                  <div key={k.id} className="p-4 rounded-2xl bg-white/5 border border-thubpay-border hover:border-thubpay-gold/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
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
                          {showKeys[k.id] ? `${k.key_prefix}...${k.key_hash.slice(0, 8)}` : `${k.key_prefix}${'•'.repeat(20)}`}
                        </code>
                        <button onClick={() => toggleKeyVisibility(k.id)} className="text-zinc-500 hover:text-thubpay-gold transition-colors">
                          {showKeys[k.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => copyToClipboard(k.id, `${k.key_prefix}...`)}
                          className="text-zinc-500 hover:text-thubpay-gold transition-colors"
                        >
                          {copiedId === k.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {k.scopes && k.scopes.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {k.scopes.map(s => (
                            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-thubpay-elevated text-zinc-500 font-mono">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase">Last Used</p>
                      <p className="text-xs text-zinc-400">
                        {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Webhook Events (Real Data) */}
            <div className="glass-card rounded-3xl p-6 border border-thubpay-border/60">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-thubpay-gold/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-thubpay-gold" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-none">Webhook Events</h3>
                    <p className="text-xs text-zinc-500 mt-1">Real-time event stream from your connected gateways.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-thubpay-border">
                  {webhookEvents.length} events
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-thubpay-border text-zinc-500 uppercase font-bold tracking-tighter">
                      <th className="pb-3 px-2">Event Type</th>
                      <th className="pb-3 px-2">Gateway</th>
                      <th className="pb-3 px-2">Event ID</th>
                      <th className="pb-3 px-2 text-center">Status</th>
                      <th className="pb-3 px-2 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-thubpay-border/30">
                    {webhookEvents.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-zinc-500">No webhook events recorded yet.</td></tr>
                    )}
                    {webhookEvents.map((e) => (
                      <tr key={e.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Play className="w-3 h-3 text-thubpay-gold" />
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
          </div>

          {/* Right Column: Playground + SDK */}
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6 border border-thubpay-border/60 bg-gradient-to-br from-thubpay-gold/5 to-transparent">
              <div className="w-12 h-12 rounded-2xl bg-thubpay-gold text-[#111] flex items-center justify-center mb-4 shadow-xl shadow-thubpay-gold/20">
                <Bug className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">API Playground</h3>
              <p className="text-sm text-zinc-400 mb-6">Test your integration flows with live data. Safe, sandboxed, and secure.</p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-thubpay-border hover:bg-white/10 transition-colors cursor-pointer group">
                  <Globe className="w-4 h-4 text-thubpay-gold group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-zinc-300">HTTP Request Builder</span>
                </div>
                 <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-thubpay-border hover:bg-white/10 transition-colors cursor-pointer group">
                  <Lock className="w-4 h-4 text-thubpay-gold group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-zinc-300">Authentication Testing</span>
                </div>
              </div>
              
              <button className="w-full mt-8 btn-gradient py-3 rounded-xl text-[#111] font-bold text-sm shadow-lg shadow-thubpay-gold/20">
                Open Full Playground
              </button>
            </div>

            <div className="glass-card rounded-3xl p-6 border border-thubpay-border/60">
              <h3 className="text-sm font-bold mb-4 uppercase tracking-widest text-zinc-500">Connected Gateways</h3>
              {gateways.length === 0 ? (
                <p className="text-sm text-zinc-500">No gateways connected. Go to Settings → Gateways.</p>
              ) : (
                <div className="space-y-2">
                  {gateways.map(g => (
                    <div key={g.gateway_slug} className="p-3 rounded-xl bg-white/5 border border-thubpay-border flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-300 uppercase">{g.gateway_slug}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        g.is_live ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {g.is_live ? 'Live' : 'Test'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-card rounded-3xl p-6 border border-thubpay-border/60">
              <h3 className="text-sm font-bold mb-4 uppercase tracking-widest text-zinc-500">SDK Downloads</h3>
              <div className="grid grid-cols-2 gap-2">
                {['Node.js', 'Python', 'Go', 'PHP', 'Ruby', 'Java'].map(sdk => (
                  <div key={sdk} className="p-2 rounded-xl bg-thubpay-elevated border border-thubpay-border text-center text-[10px] font-bold text-zinc-400 hover:text-white hover:border-thubpay-gold/40 transition-colors cursor-pointer">
                    {sdk}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
