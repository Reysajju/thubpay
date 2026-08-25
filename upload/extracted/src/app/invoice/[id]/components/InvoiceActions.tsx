'use client';

import { useState } from 'react';
import { sendInvoice, markInvoicePaidManually } from '@/app/dashboard/actions';
import { Send, CheckCircle2, Printer, Loader2, Link2, Check, Copy, CreditCard } from 'lucide-react';
import RefundModal from './RefundModal';
import VoidButton from './VoidButton';

export default function InvoiceActions({
  invoiceId,
  status,
  workspaceId,
  printOnly = false,
  transactionId,
  transactionAmountCents,
  transactionCurrency = 'USD',
  invoiceNumber,
  isMerchant = false,
}: {
  invoiceId: string;
  status: string;
  workspaceId: string;
  printOnly?: boolean;
  transactionId?: string;
  transactionAmountCents?: number;
  transactionCurrency?: string;
  invoiceNumber?: string;
  isMerchant?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLinkToast, setShowLinkToast] = useState(false);

  const paymentLink = typeof window !== 'undefined'
    ? `${window.location.origin}/pay/${invoiceId}`
    : `/pay/${invoiceId}`;

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleSend = async () => {
    setSending(true);
    const fd = new FormData();
    fd.append('invoice_id', invoiceId);
    await sendInvoice(fd);

    // Copy payment link to clipboard
    copyToClipboard(paymentLink);
    setCopied(true);
    setShowLinkToast(true);

    setSending(false);
    // Don't reload immediately — show the toast first
    setTimeout(() => {
      setShowLinkToast(false);
      setCopied(false);
      window.location.reload();
    }, 2500);
  };

  const handleCopyLink = () => {
    copyToClipboard(paymentLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMarkPaid = async () => {
    if (!confirm('Mark this invoice as paid manually?')) return;
    setMarking(true);
    await markInvoicePaidManually(invoiceId);
    setMarking(false);
    window.location.reload();
  };

  if (printOnly) {
    return (
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 border border-[#252529] hover:border-[#10B981]/30 hover:text-[#10B981] transition-all"
      >
        <Printer className="w-3.5 h-3.5" />
        Print
      </button>
    );
  }

  const canRefund =
    status === 'paid' &&
    transactionId &&
    typeof transactionAmountCents === 'number' &&
    transactionAmountCents > 0;

  if (!isMerchant) {
    return (
      <div className="space-y-2.5">
        {status !== 'paid' && status !== 'void' && (
          <a
            href={paymentLink}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold hover:opacity-95 transition-all shadow-lg shadow-[#10B981]/25"
          >
            <CreditCard className="w-4 h-4" />
            Pay Online Now →
          </a>
        )}

        {status === 'paid' && transactionId && (
          <a
            href={`/api/public/receipt/${transactionId}/pdf`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 text-sm font-semibold text-[#34D399] hover:bg-[#10B981]/20 transition-all"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            Download PDF Receipt
          </a>
        )}

        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#252529] text-sm font-semibold text-zinc-300 hover:border-zinc-600 transition-all"
        >
          <Printer className="w-4 h-4" />
          Print Statement
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Payment link toast */}
      {showLinkToast && (
        <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 flex items-start gap-2 animate-scaleIn">
          <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#10B981]">Invoice sent! Payment link copied!</p>
            <p className="text-[10px] text-zinc-400 mt-0.5 font-mono truncate">{paymentLink}</p>
          </div>
        </div>
      )}

      {status === 'draft' && (
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[#10B981]/20"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send Invoice
            </>
          )}
        </button>
      )}

      {/* Copy Payment Link button — always visible for non-draft invoices */}
      {status !== 'draft' && (
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-[#10B981]/20"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              Copy Payment Link
            </>
          )}
        </button>
      )}

      {/* Show payment link for easy access */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a0a0c] border border-[#252529]/50">
        <Link2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
        <p className="text-[10px] text-zinc-500 font-mono truncate flex-1">{paymentLink}</p>
        <button
          onClick={handleCopyLink}
          className="flex-shrink-0 p-1 rounded text-zinc-500 hover:text-[#10B981] transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="w-3 h-3 text-[#10B981]" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* Refund button — only for paid invoices with a succeeded transaction */}
      {canRefund && (
        <RefundModal
          invoiceId={invoiceId}
          transactionId={transactionId!}
          amountCents={transactionAmountCents!}
          currency={transactionCurrency}
          invoiceNumber={invoiceNumber || invoiceId.slice(0, 8)}
        />
      )}

      {!['paid', 'void', 'refunded'].includes(status) && (
        <button
          onClick={handleMarkPaid}
          disabled={marking}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-sm font-semibold text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-all"
        >
          {marking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Marking...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Mark as Paid
            </>
          )}
        </button>
      )}

      {/* Void invoice — available for draft / sent / viewed / overdue invoices */}
      {['draft', 'sent', 'viewed', 'overdue'].includes(status) && (
        <VoidButton
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber || invoiceId.slice(0, 8)}
          currentStatus={status}
        />
      )}

      <button
        onClick={() => window.print()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#252529] text-sm font-semibold text-zinc-300 hover:border-zinc-600 transition-all"
      >
        <Printer className="w-4 h-4" />
        Print / PDF
      </button>
    </div>
  );
}
