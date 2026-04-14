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

export default async function DisputesPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  // Get workspace
  const { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = member?.workspace_id;

  // Fetch disputes from database
  const { data: disputes } = workspaceId
    ? await (supabase as any)
        .from('disputes')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Fetch dispute evidence counts
  const disputeIds = (disputes ?? []).map((d: any) => d.id);
  const { data: evidenceRows } = disputeIds.length > 0
    ? await (supabase as any)
        .from('dispute_evidence')
        .select('dispute_id')
        .in('dispute_id', disputeIds)
    : { data: [] };

  const evidenceCounts: Record<string, number> = {};
  (evidenceRows ?? []).forEach((e: any) => {
    evidenceCounts[e.dispute_id] = (evidenceCounts[e.dispute_id] || 0) + 1;
  });

  // Compute stats
  const allDisputes = disputes ?? [];
  const needsResponse = allDisputes.filter((d: any) => d.status === 'needs_response').length;
  const underReview = allDisputes.filter((d: any) => d.status === 'under_review').length;
  const won = allDisputes.filter((d: any) => d.status === 'won').length;
  const lost = allDisputes.filter((d: any) => d.status === 'lost').length;
  const totalAmount = allDisputes.reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0);
  const winRate = allDisputes.length > 0 ? Math.round((won / (won + lost || 1)) * 100) : 0;

  const statusColors: Record<string, string> = {
    needs_response: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    under_review: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    won: 'bg-green-500/15 text-green-400 border-green-500/25',
    lost: 'bg-red-500/15 text-red-400 border-red-500/25',
  };

  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Disputes & Chargebacks
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Monitor and respond to payment disputes across all gateways.
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 mb-8">
          <div className="glass-card rounded-2xl p-4 hover:border-amber-500/35 transition-all">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Needs Response</p>
            <p className="text-2xl font-black text-amber-400">{needsResponse}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 hover:border-blue-500/35 transition-all">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Under Review</p>
            <p className="text-2xl font-black text-blue-400">{underReview}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 hover:border-green-500/35 transition-all">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Won</p>
            <p className="text-2xl font-black text-green-400">{won}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 hover:border-red-500/35 transition-all">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Lost</p>
            <p className="text-2xl font-black text-red-400">{lost}</p>
          </div>
          <div className="glass-card rounded-2xl p-4 hover:border-thubpay-gold/35 transition-all">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Win Rate</p>
            <p className="text-2xl font-black text-thubpay-gold">{winRate}%</p>
          </div>
        </div>

        {/* Total Disputed */}
        <div className="glass-card rounded-2xl p-4 mb-8 flex items-center justify-between">
          <span className="text-sm font-bold text-zinc-400">Total Disputed Amount</span>
          <span className="text-xl font-black text-white">{toUsd(totalAmount)}</span>
        </div>

        {/* Disputes Table */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">All Disputes</h2>
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-thubpay-border">
              {allDisputes.length} total
            </span>
          </div>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[700px] text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-zinc-400 border-b border-thubpay-border/60">
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Dispute ID</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Gateway</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Reason</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Evidence</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Due Date</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thubpay-border/30">
                {allDisputes.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500 text-sm">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-zinc-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="font-semibold text-zinc-400">No disputes found</p>
                        <p className="text-xs text-zinc-600 mt-1">Great news! Your account has no disputes or chargebacks.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {allDisputes.map((dispute: any) => (
                  <tr key={dispute.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-4 font-mono text-zinc-100 text-xs">
                      {dispute.gateway_dispute_id || dispute.id.slice(0, 8)}
                    </td>
                    <td className="py-4">
                      <span className="px-2 py-0.5 rounded-md bg-thubpay-elevated border border-thubpay-border text-xs font-bold text-zinc-300 uppercase">
                        {dispute.gateway_slug}
                      </span>
                    </td>
                    <td className="py-4 text-zinc-300 text-xs max-w-[200px] truncate">
                      {dispute.reason || 'Not specified'}
                    </td>
                    <td className="py-4 text-right font-semibold text-white">
                      {toUsd(dispute.amount_cents)}
                    </td>
                    <td className="py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[dispute.status] || 'bg-zinc-800 text-zinc-400 border-thubpay-border'}`}>
                        {dispute.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 text-center text-zinc-400 text-xs">
                      {evidenceCounts[dispute.id] || 0} files
                    </td>
                    <td className="py-4 text-right text-zinc-400 text-xs">
                      {dispute.evidence_due_at
                        ? new Date(dispute.evidence_due_at).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="py-4 text-right text-zinc-400 text-xs">
                      {new Date(dispute.created_at).toLocaleDateString()}
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
