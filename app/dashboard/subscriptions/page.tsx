import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

export default async function SubscriptionsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = member?.workspace_id;

  const [{ data: subscriptions }, { data: plans }] = await Promise.all([
    workspaceId
      ? (supabase as any).from('subscriptions').select('*, clients(name, email)').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      : { data: [] },
    workspaceId
      ? (supabase as any).from('subscription_plans').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('amount_cents', { ascending: true })
      : { data: [] },
  ]);

  const allSubs = subscriptions ?? [];
  const active = allSubs.filter((s: any) => s.status === 'active').length;
  const trialing = allSubs.filter((s: any) => s.status === 'trialing').length;
  const canceled = allSubs.filter((s: any) => s.status === 'canceled').length;
  const pastDue = allSubs.filter((s: any) => s.status === 'past_due').length;

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/15 text-green-400 border-green-500/25',
    trialing: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    past_due: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    canceled: 'bg-red-500/15 text-red-400 border-red-500/25',
    unpaid: 'bg-zinc-800 text-zinc-400 border-thubpay-border',
    paused: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  };

  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Subscriptions</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage recurring billing lifecycles, plans, and churn.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Active</p>
            <p className="text-2xl font-black text-green-400">{active}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Trialing</p>
            <p className="text-2xl font-black text-blue-400">{trialing}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Past Due</p>
            <p className="text-2xl font-black text-amber-400">{pastDue}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Canceled</p>
            <p className="text-2xl font-black text-red-400">{canceled}</p>
          </div>
        </div>

        {/* Plans */}
        {(plans ?? []).length > 0 && (
          <div className="glass-card rounded-3xl p-4 sm:p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-4">Plans</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(plans ?? []).map((plan: any) => (
                <div key={plan.id} className="p-4 rounded-2xl bg-white/5 border border-thubpay-border hover:border-thubpay-gold/30 transition-all">
                  <p className="text-sm font-bold text-white">{plan.name}</p>
                  <p className="text-2xl font-black text-thubpay-gold mt-1">{toUsd(plan.amount_cents)}<span className="text-xs text-zinc-500 font-normal">/{plan.interval}</span></p>
                  {plan.trial_days > 0 && <p className="text-[10px] text-zinc-500 mt-1">{plan.trial_days}-day trial</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscriptions Table */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-6">All Subscriptions ({allSubs.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-zinc-400 border-b border-thubpay-border/60">
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Client</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Gateway</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Period End</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thubpay-border/30">
                {allSubs.length === 0 && (
                  <tr><td colSpan={5} className="py-16 text-center text-zinc-500 text-sm">No subscriptions found.</td></tr>
                )}
                {allSubs.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 text-zinc-200 font-medium">{sub.clients?.name || '—'}</td>
                    <td className="py-3 text-zinc-400 text-xs uppercase">{sub.gateway_slug || '—'}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[sub.status] || 'bg-zinc-800 text-zinc-400 border-thubpay-border'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 text-right text-zinc-400 text-xs">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-right text-zinc-400 text-xs">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
