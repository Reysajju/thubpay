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

export default async function TransactionsPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = member?.workspace_id;

  // Fetch real transactions from the cash_ledger table
  const { data: ledger } = workspaceId
    ? await (supabase as any)
        .from('cash_ledger')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('occurred_at', { ascending: false })
        .limit(100)
    : { data: [] };

  // Fetch invoices with payment info
  const { data: invoices } = workspaceId
    ? await (supabase as any)
        .from('invoices')
        .select('*, clients(name)')
        .eq('workspace_id', workspaceId)
        .in('status', ['paid', 'sent', 'overdue'])
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] };

  const allTransactions = ledger ?? [];
  const totalIncoming = allTransactions
    .filter((t: any) => t.direction === 'incoming')
    .reduce((s: number, t: any) => s + (t.amount_cents || 0), 0);
  const totalOutgoing = allTransactions
    .filter((t: any) => t.direction === 'outgoing')
    .reduce((s: number, t: any) => s + (t.amount_cents || 0), 0);

  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Transactions
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Live feed of all payments across all integrated gateways.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Total Incoming</p>
            <p className="text-xl font-black text-green-400">{toUsd(totalIncoming)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Total Outgoing</p>
            <p className="text-xl font-black text-red-400">{toUsd(totalOutgoing)}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Net</p>
            <p className={`text-xl font-black ${totalIncoming - totalOutgoing >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {toUsd(totalIncoming - totalOutgoing)}
            </p>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Cash Ledger</h2>
            <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-thubpay-border">
              {allTransactions.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-zinc-400 border-b border-thubpay-border/60">
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Direction</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Gateway</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Reference</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thubpay-border/30">
                {allTransactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-zinc-500 text-sm">
                      No transactions recorded yet.
                    </td>
                  </tr>
                )}
                {allTransactions.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        tx.direction === 'incoming' 
                          ? 'bg-green-500/15 text-green-400' 
                          : 'bg-red-500/15 text-red-400'
                      }`}>
                        {tx.direction}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-300 text-xs font-medium uppercase">{tx.gateway_slug || '—'}</td>
                    <td className="py-3 font-mono text-zinc-400 text-xs">{tx.reference || tx.id?.slice(0, 12)}</td>
                    <td className="py-3 text-right font-semibold text-white">{toUsd(tx.amount_cents)}</td>
                    <td className="py-3 text-right text-zinc-400 text-xs">
                      {tx.occurred_at ? new Date(tx.occurred_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Paid Invoices */}
        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-6">Recent Invoice Payments</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-zinc-400 border-b border-thubpay-border/60">
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Invoice</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Client</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thubpay-border/30">
                {(invoices ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500 text-sm">
                      No invoice payments found.
                    </td>
                  </tr>
                )}
                {(invoices ?? []).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono text-zinc-100 text-xs">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                    <td className="py-3 text-zinc-300 text-sm">{inv.clients?.name || '—'}</td>
                    <td className="py-3 text-right font-semibold text-white">{toUsd(inv.total_cents)}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        inv.status === 'paid' ? 'bg-green-500/15 text-green-400 border-green-500/25' :
                        inv.status === 'overdue' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                        'bg-blue-500/15 text-blue-300 border-blue-500/25'
                      }`}>{inv.status}</span>
                    </td>
                    <td className="py-3 text-right text-zinc-400 text-xs">
                      {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : new Date(inv.created_at).toLocaleDateString()}
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
