import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import DashboardActions from './components/DashboardActions';
import DashboardOverviewCharts from './components/DashboardOverviewCharts';

export const dynamic = 'force-dynamic';

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

  // FIX: If workspace is missing, auto-create it using a client-generated UUID to avoid RLS SELECT violations.
  if (!member?.workspace_id) {
    const defaultName = (user.user_metadata?.full_name ?? 'My Startup') + ' Workspace';
    const slug = user.id.replace(/-/g, '').toLowerCase();
    const newWorkspaceId = crypto.randomUUID();

    const { error: wsError } = await (supabase as any)
      .from('workspaces')
      .insert({
        id: newWorkspaceId,
        owner_user_id: user.id,
        name: defaultName,
        slug: slug,
        plan: 'free'
      });

    if (!wsError) {
      const { error: memError } = await (supabase as any)
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspaceId,
          user_id: user.id,
          role: 'owner'
        });
      
      if (memError) {
        console.error('Error creating workspace member:', memError);
        member = null;
      } else {
        member = { workspace_id: newWorkspaceId, role: 'owner' };
      }
    } else {
      console.error('Error creating workspace:', wsError);
      member = null;
    }
  }

  const workspaceId = member?.workspace_id;

  if (!workspaceId) {
    return (
      <section className="bg-thubpay-obsidian min-h-screen pb-12 pt-16 px-4">
        <div className="max-w-lg mx-auto text-center glass-card rounded-2xl p-8 border border-thubpay-border">
          <h1 className="text-xl font-bold text-white mb-3">Workspace could not be loaded</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Your account is signed in, but we could not create or read a workspace (this is
            usually a database permissions issue). Try again in a moment, or sign out and
            back in. If it persists, contact support.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/signin"
              className="inline-flex justify-center px-5 py-2.5 rounded-xl border border-thubpay-border text-zinc-200 text-sm font-semibold hover:bg-thubpay-elevated"
            >
              Sign out and return
            </a>
            <a href="/" className="btn-gradient inline-flex justify-center px-5 py-2.5 rounded-xl text-[#111] text-sm font-semibold">
              Home
            </a>
          </div>
        </div>
      </section>
    );
  }

  const [
    { data: workspace },
    { data: brands },
    { data: clients },
    { data: invoices },
    { data: links },
    { data: ledger },
    { data: disputes },
    { data: subscriptions },
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
      .order('occurred_at', { ascending: false }),
    (supabase as any)
      .from('disputes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
  ]);

  // ---- COMPUTE REAL METRICS ----
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
  const activeSubscriptions = (subscriptions ?? []).filter((s: any) => s.status === 'active' || s.status === 'trialing').length;
  const openDisputes = (disputes ?? []).filter((d: any) => d.status === 'needs_response' || d.status === 'under_review').length;
  const disputeAmount = (disputes ?? []).reduce((acc: number, d: any) => acc + (d.amount_cents ?? 0), 0);

  // New clients this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newClientsThisMonth = (clients ?? []).filter((c: any) => new Date(c.created_at) >= monthStart).length;

  // Upsell: recurring payments from existing clients (clients with >1 transaction)
  const recurringClients = (clients ?? []).filter((c: any) => (c.transaction_count ?? 0) > 1).length;
  const upsellRevenue = (clients ?? [])
    .filter((c: any) => (c.transaction_count ?? 0) > 1)
    .reduce((acc: number, c: any) => acc + (c.total_spend_cents ?? 0), 0);

  // ==== CHART DATA PREPARATION (ALL REAL) ====

  // 1. Revenue Over Time (Last 6 Months grouped by month-year)
  const revenueMap: Record<string, number> = {};
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
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
  for (let i = 3; i >= 0; i--) {
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

  // 4. New Clients per Month (last 6 months)
  const newClientsMap: Record<string, number> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${monthNames[d.getMonth()]}`;
    newClientsMap[key] = 0;
  }
  (clients ?? []).forEach((c: any) => {
    if (c.created_at) {
      const d = new Date(c.created_at);
      const key = `${monthNames[d.getMonth()]}`;
      if (newClientsMap[key] !== undefined) {
        newClientsMap[key]++;
      }
    }
  });
  const newClientsData = Object.keys(newClientsMap).map(k => ({ month: k, count: newClientsMap[k] }));

  // 5. Dispute Status Pie
  const disputeStatusCounts: Record<string, number> = {};
  (disputes ?? []).forEach((d: any) => {
    const label = (d.status || 'unknown').replace('_', ' ');
    disputeStatusCounts[label] = (disputeStatusCounts[label] || 0) + 1;
  });
  const disputeStats = Object.keys(disputeStatusCounts).map(k => ({ name: k, value: disputeStatusCounts[k] }));

  // 6. Subscription status breakdown
  const subStatusCounts: Record<string, number> = {};
  (subscriptions ?? []).forEach((s: any) => {
    const label = s.status || 'unknown';
    subStatusCounts[label] = (subStatusCounts[label] || 0) + 1;
  });
  const subStats = Object.keys(subStatusCounts).map(k => ({ name: k, value: subStatusCounts[k] }));


  return (
    <section className="bg-thubpay-obsidian min-h-screen pb-12 pt-6 sm:pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full min-w-0">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 w-full min-w-0">
          <div className="min-w-0 w-full md:w-auto text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Dashboard
            </h1>
            <p className="text-zinc-500 text-xs sm:text-sm mt-1 flex flex-wrap items-center justify-center md:justify-start gap-x-2 gap-y-1">
              <span className="min-w-0">
                Workspace:{' '}
                <span className="font-semibold text-zinc-300 break-words">
                  {workspace?.name ?? 'ThubPay Workspace'}
                </span>
              </span>
              <span className="hidden sm:inline" aria-hidden>
                •
              </span>
              <span>
                Plan:{' '}
                <span className="inline-flex px-2 py-0.5 rounded-full bg-zinc-800 border border-thubpay-border text-xs font-semibold uppercase text-zinc-300">
                  {workspace?.plan ?? 'free'}
                </span>
              </span>
            </p>
          </div>

          <div className="flex justify-center md:justify-end shrink-0 w-full md:w-auto">
            <DashboardActions clients={clients ?? []} brands={brands ?? []} />
          </div>
        </div>

        {/* Top Metrics Row - ALL REAL DATA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-thubpay-gold/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Monthly Revenue
            </p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate">
              {toUsd(mrr)}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-thubpay-gold/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Total Clients
            </p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
              {(clients ?? []).length}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-thubpay-gold/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Pending Invoices
            </p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
              {pendingInvoices}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-thubpay-gold/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Profit / Loss
            </p>
            <p
              className={`text-xl sm:text-2xl md:text-3xl font-bold truncate ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}
            >
              {toUsd(profit)}
            </p>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-green-500/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              New Clients (This Month)
            </p>
            <p className="text-xl sm:text-2xl font-bold text-green-400">{newClientsThisMonth}</p>
          </div>
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-blue-500/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Active Subscriptions
            </p>
            <p className="text-xl sm:text-2xl font-bold text-blue-400">{activeSubscriptions}</p>
          </div>
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-thubpay-gold/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Upsell Revenue
            </p>
            <p className="text-xl sm:text-2xl font-bold text-thubpay-gold truncate">{toUsd(upsellRevenue)}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{recurringClients} repeat clients</p>
          </div>
          <div className="glass-card rounded-2xl p-3 sm:p-5 hover:border-amber-500/35 transition-all min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">
              Open Disputes
            </p>
            <p className="text-xl sm:text-2xl font-bold text-amber-400">{openDisputes}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{toUsd(disputeAmount)} at risk</p>
          </div>
        </div>

        {/* Analytics Charts - all real data with animations */}
        <DashboardOverviewCharts
          revenueData={revenueData}
          ledgerData={ledgerData}
          invoiceStats={invoiceStats}
          newClientsData={newClientsData}
          disputeStats={disputeStats}
          subStats={subStats}
        />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Recent Invoices - spans 2 columns */}
          <div className="lg:col-span-2 glass-card rounded-3xl p-4 sm:p-6 overflow-hidden flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Recent Invoices</h2>
              <a href="/dashboard/invoices" className="text-sm font-semibold text-thubpay-gold hover:text-thubpay-gold/80">
                View All
              </a>
            </div>
            
            <div className="flex-1 overflow-x-auto overscroll-x-contain touch-pan-x -mx-1 px-1">
              <table className="w-full min-w-[520px] text-left text-sm whitespace-nowrap">
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
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 font-mono text-zinc-100">{inv.invoice_number}</td>
                      <td className="py-4 text-zinc-300 font-medium">{inv.clients?.name ?? '—'}</td>
                      <td className="py-4">
                        {inv.brands ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-thubpay-elevated border border-thubpay-border text-xs font-medium text-zinc-200">
                            <span 
                              className="w-2 h-2 rounded-full" 
                              style={{ background: `linear-gradient(135deg, ${inv.brands.gradient_from} 0%, ${inv.brands.gradient_to} 100%)` }}
                            />
                            {inv.brands.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-4 text-right font-semibold text-white">{toUsd(inv.total_cents)}</td>
                      <td className="py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${inv.status === 'paid' ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 
                            inv.status === 'sent' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25' : 
                            inv.status === 'overdue' ? 'bg-red-500/15 text-red-400 border border-red-500/25' : 
                            'bg-zinc-800 text-zinc-400 border border-thubpay-border'}
                        `}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <a 
                          href={`/invoice/${inv.id}`} 
                          className="inline-flex items-center justify-center px-4 py-1.5 rounded-lg border border-thubpay-border text-xs font-semibold text-zinc-300 hover:bg-thubpay-elevated hover:text-white transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                  {(!invoices || invoices.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500 text-sm">
                        No invoices created yet. Click &quot;+ New&quot; to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Active Brands */}
            <div className="glass-card rounded-3xl p-4 sm:p-6 min-w-0">
              <h2 className="text-lg font-bold text-white mb-4">Brands</h2>
              <ul className="space-y-3">
                {(brands ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500 py-2">No brands added.</p>
                )}
                {(brands ?? []).map((brand: any) => (
                  <li key={brand.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm relative overflow-hidden" 
                      style={{ background: `linear-gradient(135deg, ${brand.gradient_from ?? '#C5A059'} 0%, ${brand.gradient_to ?? '#0A6C7B'} 100%)` }}
                    >
                      {brand.logo_url ? (
                        <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">{brand.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">{brand.name}</p>
                      {brand.website && (
                        <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-thubpay-gold">
                          {brand.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recent Clients */}
            <div className="glass-card rounded-3xl p-4 sm:p-6 flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Clients</h2>
                <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full border border-thubpay-border">
                  {(clients ?? []).length}
                </span>
              </div>
              
              <ul className="space-y-3">
                {(clients ?? []).length === 0 && (
                  <p className="text-sm text-zinc-500 py-2">No clients added.</p>
                )}
                {(clients ?? []).slice(0, 5).map((client: any) => (
                  <li key={client.id} className="group">
                    <p className="text-sm font-semibold text-zinc-200">{client.name}</p>
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
