'use client';

import { useState, useTransition } from 'react';
import { dispatchInvoice } from '@/app/dashboard/actions';
import { getURL } from '@/utils/helpers';

interface Props {
  invoiceId: string;
  isDispatched: boolean;
}

export default function InvoiceActions({ invoiceId, isDispatched }: Props) {
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const sharedLink = getURL(`/pay/${invoiceId}`);

  function handleCopy() {
    navigator.clipboard.writeText(sharedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDispatch() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('invoice_id', invoiceId);
      await dispatchInvoice(fd);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mt-6">
      {!isDispatched ? (
        <button
          onClick={handleDispatch}
          disabled={isPending}
          className="btn-gradient inline-flex items-center justify-center rounded-xl px-6 py-3 text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Dispatching...
            </span>
          ) : (
            'Dispatch Invoice (Email + Link)'
          )}
        </button>
      ) : (
        <button
          onClick={handleCopy}
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 border border-thubpay-border bg-white text-zinc-900 font-semibold hover:bg-zinc-50 transition w-full sm:w-auto"
        >
          {copied ? '✓ Link Copied!' : '📋 Copy Permanent Link'}
        </button>
      )}

      {isDispatched && (
        <a
          href={sharedLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 border border-thubpay-border text-zinc-600 hover:text-zinc-900 font-semibold hover:bg-zinc-50 transition"
        >
          Open Payment Page ↗
        </a>
      )}
    </div>
  );
}
