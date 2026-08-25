'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, Activity, TrendingDown, TrendingUp, Settings, Loader2, Check, Sliders } from 'lucide-react';
import { updateSlaThreshold, updateEndpointSlaThreshold } from '@/app/dashboard/actions';

interface EndpointSla {
  endpoint_id: string;
  endpoint_label: string;
  endpoint_url: string;
  is_active: boolean;
  uptime_rate: number;
  healthy_checks: number;
  total_checks: number;
  breached: boolean;
  threshold: number;
  has_threshold_override: boolean;
  last_check_at: string | null;
  last_status: string | null;
}

interface Props {
  endpoints: EndpointSla[];
}

export default function SlaPanel({ endpoints }: Props) {
  // All endpoints share the same workspace threshold, so take it from the first
  const workspaceThreshold = endpoints[0]?.threshold ?? 90;
  const [threshold, setThreshold] = useState(workspaceThreshold);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-endpoint override editor state
  const [overrideEndpointId, setOverrideEndpointId] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState<number>(90);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  if (endpoints.length === 0) return null;

  const breached = endpoints.filter((e) => e.breached);
  const healthy = endpoints.filter((e) => !e.breached && e.total_checks >= 3);
  const noData = endpoints.filter((e) => e.total_checks < 3);

  const overallBreached = breached.length > 0;
  const overallHealthy = breached.length === 0 && healthy.length > 0;

  async function handleSaveThreshold() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = (await updateSlaThreshold(threshold)) as any;
      if (res?.success) {
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(res?.error || 'Failed to update threshold');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`glass-card rounded-3xl p-4 sm:p-6 mb-6 animate-fadeIn border ${
      overallBreached
        ? 'border-red-500/30 bg-red-500/[0.02]'
        : overallHealthy
          ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
          : 'border-[#252529]/60'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            overallBreached
              ? 'bg-red-500/15'
              : overallHealthy
                ? 'bg-emerald-500/15'
                : 'bg-[#10B981]/10'
          }`}>
            {overallBreached ? (
              <ShieldAlert className="w-5 h-5 text-red-400" />
            ) : overallHealthy ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <Activity className="w-5 h-5 text-[#10B981]" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">SLA Monitor</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Uptime threshold: <span className="text-zinc-300 font-bold tabular-nums">{workspaceThreshold}%</span> ·
              window: last 10 checks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {breached.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 font-bold">
              <AlertTriangle className="w-2.5 h-2.5" />
              {breached.length} BREACHING
            </span>
          )}
          {healthy.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              <ShieldCheck className="w-2.5 h-2.5" />
              {healthy.length} HEALTHY
            </span>
          )}
          {noData.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-700/30 text-zinc-400 border border-zinc-700/40 font-bold">
              {noData.length} PENDING
            </span>
          )}
          {/* Threshold edit button */}
          {!editing && (
            <button
              onClick={() => { setEditing(true); setSaved(false); setError(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-zinc-400 border border-[#252529] hover:border-[#10B981]/40 hover:text-[#10B981] transition-all font-bold"
              title="Configure SLA threshold"
            >
              <Settings className="w-2.5 h-2.5" />
              CONFIGURE
            </button>
          )}
        </div>
      </div>

      {/* Threshold editor */}
      {editing && (
        <div className="mb-4 p-3 rounded-xl bg-[#0a0a0c] border border-[#252529]/60 animate-scaleIn">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-zinc-300">SLA Threshold (%)</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditing(false); setError(null); setThreshold(workspaceThreshold); }}
                className="px-2 py-1 rounded-md text-[10px] font-bold text-zinc-400 border border-[#252529] hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveThreshold}
                disabled={saving || threshold === workspaceThreshold}
                className="px-2.5 py-1 rounded-md text-[10px] font-bold text-white bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1"
              >
                {saving ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : saved ? (
                  <Check className="w-2.5 h-2.5" />
                ) : null}
                {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="50"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="flex-1 accent-[#10B981]"
            />
            <div className="flex items-center gap-1 w-20">
              <input
                type="number"
                min="1"
                max="100"
                value={threshold}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setThreshold(Math.max(1, Math.min(100, v)));
                }}
                className="w-14 px-2 py-1 rounded-md bg-[#131316] border border-[#252529] text-zinc-100 text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#10B981]/40"
              />
              <span className="text-xs text-zinc-500">%</span>
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2">
            Endpoints with uptime below this threshold (over the last 10 health checks) will trigger breach alerts.
            Lowering the threshold makes alerts less sensitive; raising it makes them more sensitive.
          </p>
          {error && (
            <p className="text-[10px] text-red-400 mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Saved confirmation toast */}
      {saved && !editing && (
        <div className="mb-4 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-scaleIn">
          <Check className="w-3 h-3" />
          SLA threshold updated to {workspaceThreshold}%.
        </div>
      )}

      {/* Summary banner */}
      {overallBreached && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 animate-scaleIn">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-300">
              {breached.length} endpoint{breached.length === 1 ? '' : 's'} currently breaching SLA
            </p>
            <p className="text-xs text-red-200/70 mt-0.5">
              Affected: {breached.map((e) => e.endpoint_label).join(', ')}. The workspace owner has been notified.
            </p>
          </div>
        </div>
      )}

      {overallHealthy && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2 animate-scaleIn">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-300">
              All endpoints meeting SLA
            </p>
            <p className="text-xs text-emerald-200/70 mt-0.5">
              {healthy.length} endpoint{healthy.length === 1 ? '' : 's'} above {workspaceThreshold}% uptime over the last 10 checks.
            </p>
          </div>
        </div>
      )}

      {/* Per-endpoint SLA status */}
      <div className="space-y-2">
        {endpoints.map((ep, i) => {
          // Color based on the endpoint's threshold (which is the workspace threshold)
          const threshold = ep.threshold ?? 90;
          // Above threshold + 5 = emerald (well above), within 5 of threshold = amber, below = red
          const rateColor =
            ep.uptime_rate >= threshold + 5
              ? 'text-emerald-400'
              : ep.uptime_rate >= threshold
                ? 'text-amber-400'
                : 'text-red-400';
          const barColor =
            ep.uptime_rate >= threshold + 5
              ? 'bg-emerald-400'
              : ep.uptime_rate >= threshold
                ? 'bg-amber-400'
                : 'bg-red-400';
          const isPending = ep.total_checks < 3;
          return (
            <div
              key={ep.endpoint_id}
              className={`p-3 rounded-xl border flex items-center gap-3 animate-stagger stagger-${Math.min(i + 1, 6)} ${
                ep.breached
                  ? 'bg-red-500/[0.04] border-red-500/30'
                  : isPending
                    ? 'bg-zinc-700/[0.04] border-zinc-700/30'
                    : 'bg-emerald-500/[0.04] border-emerald-500/20'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                ep.breached
                  ? 'bg-red-500/10'
                  : isPending
                    ? 'bg-zinc-700/20'
                    : 'bg-emerald-500/10'
              }`}>
                {ep.breached ? (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                ) : isPending ? (
                  <Activity className="w-4 h-4 text-zinc-500" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white truncate">{ep.endpoint_label}</p>
                  {ep.breached ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-bold">
                      BREACHING
                    </span>
                  ) : isPending ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/30 text-zinc-400 border border-zinc-700/40 font-bold">
                      PENDING
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                      MEETING
                    </span>
                  )}
                  {ep.has_threshold_override && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-0.5">
                      <Sliders className="w-2 h-2" />
                      CUSTOM {threshold}%
                    </span>
                  )}
                  {!ep.is_active && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-700/30 text-zinc-500 border border-zinc-700/40 font-bold">
                      PAUSED
                    </span>
                  )}
                  {/* Per-endpoint override button */}
                  {!isPending && (
                    <button
                      onClick={() => {
                        if (overrideEndpointId === ep.endpoint_id) {
                          setOverrideEndpointId(null);
                        } else {
                          setOverrideEndpointId(ep.endpoint_id);
                          setOverrideValue(threshold);
                          setOverrideError(null);
                        }
                      }}
                      className="ml-auto text-[9px] font-bold text-zinc-500 hover:text-purple-300 transition flex items-center gap-0.5 flex-shrink-0"
                      title="Configure per-endpoint SLA threshold override"
                    >
                      <Sliders className="w-2.5 h-2.5" />
                      {ep.has_threshold_override ? 'Edit override' : 'Override'}
                    </button>
                  )}
                </div>

                {/* Per-endpoint override editor */}
                {overrideEndpointId === ep.endpoint_id && (
                  <div className="mb-2 p-2.5 rounded-lg bg-[#0a0a0c] border border-purple-500/20 animate-scaleIn">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                        Custom threshold for {ep.endpoint_label}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {ep.has_threshold_override && (
                          <button
                            onClick={async () => {
                              setOverrideSaving(true);
                              setOverrideError(null);
                              try {
                                const res = (await updateEndpointSlaThreshold(ep.endpoint_id, null)) as any;
                                if (res?.success) {
                                  setOverrideEndpointId(null);
                                } else {
                                  setOverrideError(res?.error || 'Failed to clear override');
                                }
                              } catch (err: any) {
                                setOverrideError(err?.message || 'Error');
                              } finally {
                                setOverrideSaving(false);
                              }
                            }}
                            disabled={overrideSaving}
                            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-zinc-400 border border-[#252529] hover:text-zinc-200 transition"
                          >
                            Reset to default
                          </button>
                        )}
                        <button
                          onClick={() => { setOverrideEndpointId(null); setOverrideError(null); }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold text-zinc-400 border border-[#252529] hover:bg-white/5 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            setOverrideSaving(true);
                            setOverrideError(null);
                            try {
                              const res = (await updateEndpointSlaThreshold(ep.endpoint_id, overrideValue)) as any;
                              if (res?.success) {
                                setOverrideEndpointId(null);
                              } else {
                                setOverrideError(res?.error || 'Failed to save override');
                              }
                            } catch (err: any) {
                              setOverrideError(err?.message || 'Error');
                            } finally {
                              setOverrideSaving(false);
                            }
                          }}
                          disabled={overrideSaving || overrideValue === threshold}
                          className="px-2 py-0.5 rounded text-[9px] font-bold text-white bg-purple-500/80 hover:bg-purple-500 disabled:opacity-50 transition flex items-center gap-0.5"
                        >
                          {overrideSaving ? (
                            <Loader2 className="w-2 h-2 animate-spin" />
                          ) : null}
                          Save
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="50"
                        max="100"
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(Number(e.target.value))}
                        className="flex-1 accent-purple-400"
                      />
                      <div className="flex items-center gap-1 w-16">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={overrideValue}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isFinite(v)) setOverrideValue(Math.max(1, Math.min(100, v)));
                          }}
                          className="w-12 px-1.5 py-0.5 rounded bg-[#131316] border border-[#252529] text-zinc-100 text-[10px] font-mono text-center focus:outline-none focus:ring-1 focus:ring-purple-400/40"
                        />
                        <span className="text-[10px] text-zinc-500">%</span>
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-1">
                      Workspace default: <span className="text-zinc-400 font-bold">{workspaceThreshold}%</span>.
                      {ep.has_threshold_override
                        ? ' This endpoint currently uses its own threshold.'
                        : ' Set a custom threshold to override the workspace default for this endpoint only.'}
                    </p>
                    {overrideError && (
                      <p className="text-[9px] text-red-400 mt-1">{overrideError}</p>
                    )}
                  </div>
                )}

                {/* Uptime progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1f] overflow-hidden">
                    <div
                      className={`h-full transition-all ${barColor}`}
                      style={{ width: `${isPending ? 100 : ep.uptime_rate}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${isPending ? 'text-zinc-500' : rateColor}`}>
                    {isPending ? '—' : `${ep.uptime_rate}%`}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 tabular-nums">
                  {isPending
                    ? `${ep.total_checks}/3 checks — collecting data`
                    : `${ep.healthy_checks}/${ep.total_checks} healthy`}
                  {ep.last_check_at && (
                    <> · last check {new Date(ep.last_check_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
