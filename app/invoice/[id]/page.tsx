import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import InvoiceActions from './components/InvoiceActions';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

export default async function InvoiceDetailPage({
  params
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/signin');
  
  const { data: invoice } = await (supabase as any)
    .from('invoices')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: brand }, { data: client }] = await Promise.all([
    (supabase as any).from('brands').select('*').eq('id', invoice.brand_id).maybeSingle(),
    (supabase as any).from('clients').select('*').eq('id', invoice.client_id).maybeSingle()
  ]);

  const isDispatched = !!invoice.dispatched_at;
  const isPaid = invoice.status === 'paid';

  return (
    <section className="bg-thubpay-obsidian py-12 px-4 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <a href="/dashboard" className="text-thubpay-gold text-sm font-semibold hover:underline mb-6 inline-block">
          ← Back to Dashboard
        </a>

        <div className="glass-card rounded-3xl p-8 md:p-12 shadow-sm border border-thubpay-border">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-10 border-b border-thubpay-border/40 gap-6">
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold overflow-hidden shadow-inner"
                style={{ background: brand ? `linear-gradient(135deg, ${brand.gradient_from} 0%, ${brand.gradient_to} 100%)` : '#C5A059' }}
              >
                {brand?.logo_url ? (
                  <img src={brand.logo_url} alt="Brand Logo" className="w-full h-full object-cover" />
                ) : (
                  brand?.name.charAt(0) ?? 'T'
                )}
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  {brand?.name ?? 'ThubPay Base'}
                </h1>
                <p className="text-zinc-400 font-medium">Invoice #{invoice.invoice_number}</p>
              </div>
            </div>
            
            <div className="flex flex-col items-start md:items-end gap-2">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider
                ${isPaid ? 'bg-green-500/15 text-green-400 border border-green-500/25' : 
                  isDispatched ? 'bg-blue-500/15 text-blue-300 border border-blue-500/25' : 
                  'bg-zinc-800 text-zinc-300 border border-thubpay-border'}
              `}>
                {isPaid ? 'Paid' : isDispatched ? 'Dispatched' : 'Draft'}
              </span>
              {isPaid && invoice.paid_at && (
                <span className="text-xs text-zinc-500">Paid on {new Date(invoice.paid_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-10 mb-10">
            {/* Bill To */}
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Billed To</p>
              <div className="rounded-2xl bg-thubpay-elevated p-5 border border-thubpay-border">
                <p className="font-bold text-white text-lg">{client?.name ?? 'Unknown client'}</p>
                {client?.company && <p className="text-zinc-400 font-medium">{client?.company}</p>}
                
                <div className="mt-4 space-y-1 text-sm text-zinc-500">
                  {client?.email && <p>Email: <span className="text-zinc-200">{client.email}</span></p>}
                  {client?.phone && <p>Phone: <span className="text-zinc-200">{client.phone}</span></p>}
                  {client?.address && <p>Address: <span className="text-zinc-200">{client.address}</span></p>}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-zinc-100 font-medium">{invoice.description || 'Standard Invoice'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Due Date</p>
                  <p className="text-zinc-100 font-medium">{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Upon Receipt'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Terms</p>
                  <p className="text-zinc-100 font-medium">{invoice.payment_terms || 'Net 30'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-3xl border border-thubpay-border overflow-hidden mb-8">
            <div className="bg-thubpay-elevated p-6 space-y-4">
              <div className="flex justify-between items-center text-zinc-400 font-medium">
                <span>Subtotal</span>
                <span>{toUsd(invoice.subtotal_cents)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400 font-medium">
                <span>Tax ({invoice.tax_rate_pct || 0}%)</span>
                <span>{toUsd(invoice.tax_cents)}</span>
              </div>
            </div>
            
            <div className="bg-thubpay-surface p-6 border-t border-thubpay-border space-y-2">
               <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-white">Total Amount</span>
                  <span className="text-2xl font-black text-white">{toUsd(invoice.total_cents)}</span>
               </div>
               
               {isPaid && invoice.balance_due_cents !== undefined && (
                  <div className="flex justify-between items-center text-green-400">
                    <span className="text-sm font-bold">Balance Due</span>
                    <span className="text-lg font-black">{toUsd(invoice.balance_due_cents)}</span>
                  </div>
               )}
            </div>
          </div>

          {invoice.notes && (
             <div className="mb-8 p-6 rounded-2xl bg-thubpay-elevated border border-thubpay-border text-sm">
                <p className="font-semibold text-zinc-200 mb-1">Notes / Instructions</p>
                <p className="text-zinc-400">{invoice.notes}</p>
             </div>
          )}

          {/* Actions */}
          <InvoiceActions invoiceId={invoice.id} isDispatched={isDispatched} />

        </div>
      </div>
    </section>
  );
}
