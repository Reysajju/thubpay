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

export default async function CustomersPage() {
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

  const { data: clients } = workspaceId
    ? await (supabase as any)
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
    : { data: [] };

  const allClients = clients ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = allClients.filter((c: any) => new Date(c.created_at) >= monthStart).length;
  const totalSpend = allClients.reduce((s: number, c: any) => s + (c.total_spend_cents || 0), 0);
  const repeatClients = allClients.filter((c: any) => (c.transaction_count || 0) > 1).length;

  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Customers</h1>
            <p className="text-zinc-500 text-sm mt-1">Unified CRM profiles across all payment gateways.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Total Clients</p>
            <p className="text-2xl font-black text-white">{allClients.length}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">New This Month</p>
            <p className="text-2xl font-black text-green-400">{newThisMonth}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Repeat Clients</p>
            <p className="text-2xl font-black text-thubpay-gold">{repeatClients}</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Lifetime Revenue</p>
            <p className="text-2xl font-black text-white truncate">{toUsd(totalSpend)}</p>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-4 sm:p-6 overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-6">All Clients ({allClients.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="text-zinc-400 border-b border-thubpay-border/60">
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Name</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Email</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Company</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Total Spend</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Transactions</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Last Payment</th>
                  <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-thubpay-border/30">
                {allClients.length === 0 && (
                  <tr><td colSpan={7} className="py-16 text-center text-zinc-500 text-sm">No clients found.</td></tr>
                )}
                {allClients.map((client: any) => (
                  <tr key={client.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-thubpay-gold/15 flex items-center justify-center text-thubpay-gold font-bold text-xs">
                          {(client.name || client.email || 'U')[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-white text-sm">{client.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-zinc-400 text-xs">{client.email || '—'}</td>
                    <td className="py-3 text-zinc-400 text-xs">{client.company || '—'}</td>
                    <td className="py-3 text-right font-semibold text-white">{toUsd(client.total_spend_cents || 0)}</td>
                    <td className="py-3 text-right text-zinc-400">{client.transaction_count || 0}</td>
                    <td className="py-3 text-right text-zinc-400 text-xs">
                      {client.last_payment_at ? new Date(client.last_payment_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 text-right text-zinc-400 text-xs">
                      {new Date(client.created_at).toLocaleDateString()}
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
