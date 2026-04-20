'use client';

import { useState } from 'react';
import AddClientModal from './AddClientModal';
import AddBrandModal from './AddBrandModal';
import AddInvoiceModal from './AddInvoiceModal';

export interface GatewayProps {
  id: string;
  gateway_slug: string;
  mode: string;
}

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
  clients: Client[];
  brands: Brand[];
  gateways?: GatewayProps[];
}

type ModalType = 'client' | 'brand' | 'invoice' | null;

export default function DashboardActions({ clients, brands, gateways = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  function openModal(type: ModalType) {
    setModal(type);
    setOpen(false);
  }

  return (
    <>
      {/* + New Button with dropdown */}
      <div className="relative">
        <button
          id="new-action-btn"
          onClick={() => setOpen((v) => !v)}
          className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
        >
          <span className="text-lg leading-none">+</span>
          New
          <svg
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-30 w-52 bg-thubpay-surface rounded-2xl border border-thubpay-border shadow-xl overflow-hidden animate-slideUp">
              <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Create New
              </p>
              {[
                { type: 'client' as const, label: 'Add Client', icon: '👤', desc: 'Customer or payer' },
                { type: 'brand' as const, label: 'Add Brand', icon: '🎨', desc: 'Visual identity' },
                { type: 'invoice' as const, label: 'Create Invoice', icon: '🧾', desc: 'Bill a client' }
              ].map((item) => (
                <button
                  key={item.type}
                  id={`new-${item.type}-btn`}
                  onClick={() => openModal(item.type)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-thubpay-elevated transition text-left group"
                >
                  <span className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-base group-hover:bg-thubpay-gold/15 transition">
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{item.label}</p>
                    <p className="text-xs text-zinc-400">{item.desc}</p>
                  </div>
                </button>
              ))}
              <div className="p-2" />
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <AddClientModal open={modal === 'client'} onClose={() => setModal(null)} />
      <AddBrandModal open={modal === 'brand'} onClose={() => setModal(null)} />
      <AddInvoiceModal
        open={modal === 'invoice'}
        onClose={() => setModal(null)}
        clients={clients}
        brands={brands}
        gateways={gateways}
      />
    </>
  );
}
