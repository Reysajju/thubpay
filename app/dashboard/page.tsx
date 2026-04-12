import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import DashboardActions from './components/DashboardActions';
import DashboardCharts from './components/DashboardCharts';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  // Attempt to fetch existing workspace member mapping
  let { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  // FIX: If workspace is missing, auto-create it rather than kicking them to /account.
  if (!member?.workspace_id) {
    const defaultName = (user.user_metadata?.full_name ?? 'My Startup') + ' Workspace';
    const slug = user.id.replace(/-/g, '').toLowerCase();

    const { data: newWorkspace } = await (supabase as any)
      .from('workspaces')
      .insert({
        owner_user_id: user.id,
        name: defaultName,
        slug: slug,
        plan: 'free'
      })
      .select('id')
      .single();

    if (newWorkspace?.id) {
      await (supabase as any).from('workspace_members').insert({
        workspace_id: newWorkspace.id,
        user_id: user.id,
        role: 'owner'
      });
      member = { workspace_id: newWorkspace.id, role: 'owner' };
    } else {
      // Emergency fallback if creation fails
      redirect('/account');
    }
  }

  const workspaceId = member.workspace_id;
  
  const [
    { data: workspace },
    { data: brands },
    { data: clients },
    { data: invoices },
    { data: links },
    { data: ledger }
  ] = await Promise.all([
    (supabase as any).from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
    (supabase as any)
      .from('brands')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('clients')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('invoices')
      .select(`*, brands(name, gradient_from, gradient_to), clients(name)`)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('payment_links')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('cash_ledger')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: false })
  ]);

  const incoming = (ledger ?? [])
    .filter((x: any) => x.direction === 'incoming')
    .reduce((acc: number, x: any) => acc + (x.amount_cents ?? 0), 0);
  const outgoing = (ledger ?? [])
    .filter((x: any) => x.direction === 'outgoing')
    .reduce((acc: number, x: any) => acc + (x.amount_cents ?? 0), 0);
  const profit = incoming - outgoing;
  
  const mrr = (invoices ?? [])
    .filter((i: any) => i.status === 'paid')
    .reduce((acc: number, i: any) => acc + (i.total_cents ?? 0), 0);

  const pendingInvoices = (invoices ?? []).filter((i: any) => i.status === 'sent' || i.status === 'draft').length;

  // ==== CHART DATA PREPARATION ====

  // 1. Revenue Over Time (Last 6 Months grouped by month-year)
  const revenueMap: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Initialize last 6 months to 0
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    revenueMap[key] = 0;
  }

  (invoices ?? []).forEach((inv: any) => {
    if (inv.status === 'paid' && inv.paid_at) {
      const d = new Date(inv.paid_at);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (revenueMap[key] !== undefined) {
        revenueMap[key] += (inv.total_cents || 0) / 100;
      }
    }
  });
  
  const revenueData = Object.keys(revenueMap).map((key) => ({
    month: key,
    amount: revenueMap[key]
  }));

  // 2. Invoice Status Pie Chart
  const statusCounts: Record<string, number> = { Draft: 0, Sent: 0, Paid: 0, Overdue: 0 };
  (invoices ?? []).forEach((inv: any) => {
    if (inv.status === 'draft') statusCounts.Draft++;
    else if (inv.status === 'sent') statusCounts.Sent++;
    else if (inv.status === 'paid') statusCounts.Paid++;
    else if (inv.status === 'overdue') statusCounts.Overdue++;
  });
  const invoiceStats = Object.keys(statusCounts)
    .filter((k) => statusCounts[k] > 0)
    .map((k) => ({ name: k, value: statusCounts[k] }));

  // 3. Ledger Bar Chart (Incoming vs Outgoing by Month)
  const ledgerMap: Record<string, { incoming: number; outgoing: number }> = {};
  for (let i = 3; i >= 0; i--) { // Check last 4 months
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${monthNames[d.getMonth()]}`;
    ledgerMap[key] = { incoming: 0, outgoing: 0 };
  }
  
  (ledger ?? []).forEach((item: any) => {
    if (item.occurred_at) {
      const d = new Date(item.occurred_at);
      const key = `${monthNames[d.getMonth()]}`;
      if (ledgerMap[key]) {
        if (item.direction === 'incoming') {
          ledgerMap[key].incoming += (item.amount_cents || 0) / 100;
        } else {
          ledgerMap[key].outgoing += (item.amount_cents || 0) / 100;
        }
      }
    }
  });

  const ledgerData = Object.keys(ledgerMap).map((key) => ({
    name: key,
    incoming: ledgerMap[key].incoming,
    outgoing: ledgerMap[key].outgoing
  }));


  return (
    <section className="bg-[#fffdf8] min-h-screen pb-12 pt-8">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Workspace: <span className="font-semibold text-zinc-700">{workspace?.name ?? 'ThubPay Workspace'}</span> 
              <span className="mx-2">•</span> 
              Plan: <span className="inline-flex px-2 py-0.5 rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600">{workspace?.plan ?? 'free'}</span>
            </p>
          </div>

          <DashboardActions clients={clients ?? []} brands={brands ?? []} />
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-5 hover:border-[#7A5A2B]/30 transition-all">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Monthly MRR</p>
            <p className="text-3xl font-bold text-zinc-900">{toUsd(mrr)}</p>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-[#7A5A2B]/30 transition-all">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Total Clients</p>
            <p className="text-3xl font-bold text-zinc-900">{(clients ?? []).length}</p>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-[#7A5A2B]/30 transition-all">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Pending Invoices</p>
            <p className="text-3xl font-bold text-zinc-900">{pendingInvoices}</p>
          </div>
          <div className="glass-card rounded-2xl p-5 hover:border-[#7A5A2B]/30 transition-all">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Profit / Loss</p>
            <p className={`text-3xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {toUsd(profit)}
            </p>
          </div>
        </div>

        {/* Analytics Charts */}
        <DashboardCharts revenueData={revenueData} ledgerData={ledgerData} invoiceStats={invoiceStats} />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Recent Invoices - spans 2 columns */}
          <div className="lg:col-span-2 glass-card rounded-3xl p-6 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-zinc-900">Recent Invoices</h2>
              <a href="/dashboard/invoices" className="text-sm font-semibold text-[#7A5A2B] hover:text-[#D4B27A]">View All</a>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-zinc-400 border-b border-thubpay-border/60">
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Invoice</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Client</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider">Brand</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Amount</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-center">Status</th>
                    <th className="pb-3 font-semibold uppercase text-[10px] tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-thubpay-border/30">
                  {(invoices ?? []).slice(0, 10).map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="py-4 font-mono text-zinc-900">{inv.invoice_number}</td>
                      <td className="py-4 text-zinc-700 font-medium">{inv.clients?.name ?? '—'}</td>
                      <td className="py-4">
                        {inv.brands ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-thubpay-border text-xs font-medium text-zinc-700">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ background: `linear-gradient(135deg, ${inv.brands.gradient_from} 0%, ${inv.brands.gradient_to} 100%)` }}
                            />
                            {inv.brands.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-4 text-right font-semibold text-zinc-900">{toUsd(inv.total_cents)}</td>
                      <td className="py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                            inv.status === 'sent' ? 'bg-blue-100 text-blue-700' : 
                            inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 
                            'bg-zinc-100 text-zinc-600'}
                        `}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <a 
                          href={`/invoice/${inv.id}`} 
                          className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg border border-thubpay-border text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition opacity-0 group-hover:opacity-100"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                  {(!invoices || invoices.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500 text-sm">
                        No invoices created yet. Click "+ New" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Active Brands */}
            <div className="glass-card rounded-3xl p-6">
              <h2 className="text-lg font-bold text-zinc-900 mb-4">Brands</h2>
              <ul className="space-y-3">
                {(brands ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500 py-2">No brands added.</p>
                )}
                {(brands ?? []).map((brand: any) => (
                  <li key={brand.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/60 transition">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm relative overflow-hidden" 
                      style={{ background: `linear-gradient(135deg, ${brand.gradient_from ?? '#7A5A2B'} 0%, ${brand.gradient_to ?? '#D4B27A'} 100%)` }}
                    >
                      {brand.logo_url ? (
                        <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{brand.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 leading-none">{brand.name}</p>
                      {brand.website && (
                        <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-[#7A5A2B]">
                          {brand.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Clients */}
            <div className="glass-card rounded-3xl p-6 flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-zinc-900">Clients</h2>
                <span className="text-xs font-semibold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{(clients ?? []).length}</span>
              </div>
              
              <ul className="space-y-3">
                {(clients ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500 py-2">No clients added.</p>
                )}
                {(clients ?? []).slice(0, 5).map((client: any) => (
                  <li key={client.id} className="group">
                    <p className="text-sm font-semibold text-zinc-800">{client.name}</p>
                    {(client.company || client.email) && (
                      <p className="text-xs text-zinc-500 truncate">
                        {client.company ? `${client.company} ` : ''}
                        {client.company && client.email ? '• ' : ''}
                        {client.email}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
