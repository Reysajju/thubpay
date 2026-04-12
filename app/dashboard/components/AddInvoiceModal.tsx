'use client';

import { useRef, useState, useTransition } from 'react';
import { createInvoice } from '../actions';

interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface Brand {
  id: string;
  name: string;
  gradient_from?: string;
  gradient_to?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  brands: Brand[];
}

export default function AddInvoiceModal({ open, onClose, clients, brands }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [amount, setAmount] = useState('');
  const [taxRate, setTaxRate] = useState('0');

  if (!open) return null;

  const subtotal = parseFloat(amount) || 0;
  const tax = subtotal * (parseFloat(taxRate) / 100);
  const total = subtotal + tax;

  const brand = brands.find((b) => b.id === selectedBrand);
  const gradFrom = brand?.gradient_from ?? '#7A5A2B';
  const gradTo = brand?.gradient_to ?? '#D4B27A';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createInvoice(fd);
      // createInvoice redirects to /invoice/[id] on success
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-thubpay-border overflow-hidden animate-slideUp my-4">
        {/* Header */}
        <div
          className="px-6 py-5 transition-all duration-300"
          style={{ background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 100%)` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Create Invoice</h2>
              <p className="text-white/75 text-sm mt-0.5">Fill in all invoice details below</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Client + Brand selects */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Client *
              </label>
              <select
                name="client_id"
                required
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Brand
              </label>
              <select
                name="brand_id"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              >
                <option value="">No brand (ThubPay default)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Description / Service
            </label>
            <input
              name="description"
              placeholder="e.g. Website redesign — Phase 1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
            />
          </div>

          {/* Amount + Tax */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Amount (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">$</span>
                <input
                  name="total_usd"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Tax %
              </label>
              <div className="relative">
                <input
                  name="tax_rate_pct"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Totals preview */}
          {subtotal > 0 && (
            <div className="rounded-xl bg-zinc-50 border border-thubpay-border p-4 text-sm space-y-1">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Tax ({taxRate}%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-900 border-t border-thubpay-border pt-2 mt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Due Date + Payment Terms */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Due Date
              </label>
              <input
                name="due_date"
                type="date"
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Payment Terms
              </label>
              <select
                name="payment_terms"
                defaultValue="Net 30"
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              >
                <option>Due on Receipt</option>
                <option>Net 7</option>
                <option>Net 14</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Notes / Additional Info
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder="Payment instructions, thank you note, etc."
              className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-thubpay-border text-zinc-700 text-sm font-semibold hover:bg-zinc-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${gradFrom} 0%, ${gradTo} 100%)` }}
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Invoice →'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
