'use client';

import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { markInvoicePaidManually } from '../actions';

export default function ManualPaidButton({ invoiceId, status }: { invoiceId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  if (status === 'paid') return null; // Don't show if already paid

  const handleManualPaid = () => {
    startTransition(async () => {
      await markInvoicePaidManually(invoiceId);
    });
  };

  return (
    <button
      onClick={handleManualPaid}
      disabled={isPending}
      className={`inline-flex items-center justify-center px-4 py-1.5 rounded-lg border text-xs font-semibold transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100
        ${isPending 
          ? 'bg-thubpay-gold/20 text-thubpay-gold border-thubpay-gold/30 cursor-not-allowed'
          : 'border-green-500/50 text-green-400 hover:bg-green-500/15'
        }
      `}
      title="Mark as paid manually"
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin text-thubpay-gold" />
      ) : (
        'Mark Paid'
      )}
    </button>
  );
}
