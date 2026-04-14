import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

function toUsd(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format((cents || 0) / 100);
}

export default async function PublicPayPage({
  params
}: {
  params: { uuid: string };
}) {
  const supabase = createClient();
  
  // UUID here is actually the invoice_id 
  const invoiceId = params.uuid;

  const { data: invoice } = await (supabase as any)
    .from('invoices')
    .select(`
      *,
      brands (name, gradient_from, gradient_to, logo_url, website),
      clients (name, company)
    `)
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  const brand = invoice.brands;
  const client = invoice.clients;

  const { data: activeLink } = await (supabase as any)
    .from('payment_links')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const isPaid = invoice.status === 'paid';
  const gradFrom = brand?.gradient_from ?? '#C5A059';
  const gradTo = brand?.gradient_to ?? '#0A6C7B';

  return (
    <div className="min-h-screen bg-thubpay-obsidian flex flex-col font-sans">
      
      {/* Brand Header */}
      <div 
        className="h-64 w-full absolute top-0 left-0 z-0 opacity-20"
        style={{ background: `linear-gradient(180deg, ${gradFrom} 0%, transparent 100%)` }}
      />
      
      <main className="flex-1 relative z-10 flex flex-col items-center pt-16 px-4 pb-20">
        
        {/* Brand Logo & Name */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl mb-4 overflow-hidden border-4 border-thubpay-gold/40"
            style={{ background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 100%)` }}
          >
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-cover" />
            ) : (
              brand?.name?.charAt(0) ?? 'T'
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {brand?.name ?? 'ThubPay Base'}
          </h1>
          {brand?.website && (
            <a href={brand.website} target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400 hover:text-thubpay-gold">
              {brand.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Invoice Card */}
        <div className="w-full max-w-lg bg-thubpay-surface rounded-2xl sm:rounded-[2rem] shadow-2xl border border-thubpay-border overflow-hidden">
          
          <div className="p-5 sm:p-8 pb-5 sm:pb-6 border-b border-thubpay-border">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6">
              <div className="min-w-0">
                <p className="text-zinc-500 font-medium text-sm">Invoice To</p>
                <p className="text-lg font-bold text-white mt-1 break-words">{client?.name}</p>
                {client?.company && <p className="text-zinc-400 text-sm break-words">{client?.company}</p>}
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-zinc-500 font-medium text-sm">Invoice #</p>
                <p className="text-white font-mono mt-1 break-all">{invoice.invoice_number}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-thubpay-elevated p-4 border border-thubpay-border mb-6">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Description</p>
              <p className="text-zinc-100 font-medium">{invoice.description || 'Standard Invoice'}</p>
            </div>

            {/* Totals */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium text-zinc-400">
                <span>Subtotal</span>
                <span>{toUsd(invoice.subtotal_cents)}</span>
              </div>
              {(invoice.tax_cents > 0) && (
                <div className="flex justify-between items-center text-sm font-medium text-zinc-400">
                  <span>Tax</span>
                  <span>{toUsd(invoice.tax_cents)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-thubpay-elevated p-5 sm:p-8 flex flex-col items-center">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Total Amount</p>
            <p className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-6 sm:mb-8 break-all text-center">
              {toUsd(invoice.total_cents)}
            </p>

            {isPaid ? (
              <div className="w-full bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 scale-110 shadow-lg shadow-green-500/30">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-green-400 mb-1">Payment Successful</h3>
                <p className="text-green-300/90 text-sm font-medium mb-4">
                  Paid on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'recently'}
                </p>
                <div className="flex justify-between items-center border-t border-green-500/25 pt-4">
                  <span className="text-green-300 font-medium">Balance Due</span>
                  <span className="text-green-300 font-bold">{toUsd(invoice.balance_due_cents ?? 0)}</span>
                </div>
              </div>
            ) : (
             <div className="w-full space-y-4">
               {activeLink ? (
                 <a
                   href={activeLink.external_url}
                   className="flex w-full items-center justify-center py-4 rounded-2xl text-[#111] font-bold text-lg shadow-xl hover:scale-[1.02] transition-transform"
                   style={{ background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 100%)` }}
                 >
                   Pay {toUsd(invoice.total_cents)}
                 </a>
               ) : (
                 <div className="text-center p-4 bg-yellow-500/10 text-yellow-200 rounded-xl text-sm border border-yellow-500/30">
                   Payment link is not ready yet.
                 </div>
               )}
               <p className="text-center text-xs text-zinc-400 font-medium">
                 Secure payment powered by <span className="font-bold">Stripe</span>
               </p>
             </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center gap-2 text-sm text-zinc-400">
          Powered by <span className="font-bold text-thubpay-gold">ThubPay</span>
        </div>

      </main>
    </div>
  );
}