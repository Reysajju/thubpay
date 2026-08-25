'use client';

import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Link as LinkIcon, Copy, Check, ExternalLink, Loader2, ArrowRight } from 'lucide-react';
import { createPaymentLinkQuick } from '../actions';

interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: Client[];
}

export default function AddPaymentLinkModal({ open, onClose, clients }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPaymentLinkQuick(fd);
      if (res?.success && res.paymentUrl) {
        setCreatedUrl(res.paymentUrl);
      }
    });
  }

  function copyToClipboard() {
    if (!createdUrl) return;
    const fullUrl = window.location.origin + createdUrl;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setCreatedUrl(null);
    setAmount('');
    setTitle('');
    setSelectedClient('');
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md" onClick={handleReset} />

      <div className="relative z-10 w-full max-w-lg bg-[#111114] rounded-2xl shadow-2xl border border-[#2e2e34] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <LinkIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg font-bold">New Payment Link</h2>
                <p className="text-white/80 text-xs mt-0.5">Create a shareable link to accept payments</p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white hover:bg-black/30 transition text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {createdUrl ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-xl">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment Link Ready!</h3>
              <p className="text-xs text-zinc-400 mt-1">Share this link with your customer to collect payment.</p>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#18181c] border border-[#2e2e33]">
              <input
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}${createdUrl}` : createdUrl}
                className="flex-1 bg-transparent text-xs text-zinc-200 outline-none truncate font-mono px-1"
              />
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href={createdUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl border border-[#2e2e33] text-zinc-300 text-xs font-semibold hover:bg-white/5 transition flex items-center justify-center gap-1.5"
              >
                Open Page <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={handleReset}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                Link Description / Item Title *
              </label>
              <input
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Consulting Retainer or Design Package"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                  Amount (USD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">$</span>
                  <input
                    name="amount_usd"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                  Assign Customer (Optional)
                </label>
                <select
                  name="client_id"
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
                >
                  <option value="">Any Customer (Open Link)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wide">
                Notes for Payer (Optional)
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Thank you for your business. Please complete payment using this secure link."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#252529] bg-[#18181c] text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition resize-none"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-[#252529] text-zinc-400 text-sm font-semibold hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !amount || !title}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Link <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
