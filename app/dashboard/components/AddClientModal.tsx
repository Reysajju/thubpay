'use client';

import { useRef, useState, useTransition } from 'react';
import { createPortalClient } from '../actions';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddClientModal({ open, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createPortalClient(fd);
      setSuccess(true);
      formRef.current?.reset();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 900);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-thubpay-border overflow-hidden animate-slideUp">
        {/* Header */}
        <div
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #7A5A2B 0%, #D4B27A 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Add New Client</h2>
              <p className="text-white/75 text-sm mt-0.5">Fill in the client's full details</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Full Name *
              </label>
              <input
                name="name"
                required
                placeholder="John Doe"
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Company
              </label>
              <input
                name="company"
                placeholder="Acme Corp"
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Email
              </label>
              <input
                name="email"
                type="email"
                placeholder="john@acme.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
                Phone
              </label>
              <input
                name="phone"
                type="tel"
                placeholder="+1 555 000 0000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Billing Address
            </label>
            <input
              name="address"
              placeholder="123 Main St, New York, NY 10001"
              className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Services / Package
            </label>
            <input
              name="services"
              placeholder="e.g. Web Design, SEO, Monthly Retainer"
              className="w-full px-3.5 py-2.5 rounded-xl border border-thubpay-border bg-zinc-50 text-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#7A5A2B]/40 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Any internal notes about this client..."
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
              className="flex-1 py-2.5 rounded-xl btn-gradient text-white text-sm font-semibold disabled:opacity-60 transition flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : success ? (
                '✓ Saved!'
              ) : (
                'Save Client'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
