'use client';

import { useState } from 'react';
import { Plus, FileText, Link as LinkIcon, UserPlus, Palette, ChevronDown } from 'lucide-react';
import AddClientModal from './AddClientModal';
import AddBrandModal from './AddBrandModal';
import AddInvoiceModal from './AddInvoiceModal';
import AddPaymentLinkModal from './AddPaymentLinkModal';

export interface GatewayProps {
  id: string;
  gateway_slug: string;
  label: string;
  mode: string;
}

export interface ClientOption {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface Props {
  workspaceId: string;
  clients?: ClientOption[];
}

type ModalType = 'client' | 'brand' | 'invoice' | 'payment-link' | null;

export default function DashboardActions({ workspaceId, clients = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);

  void workspaceId;

  function openModal(type: ModalType) {
    setModal(type);
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2.5 relative z-30">
        {/* Primary Action: Direct Create Invoice */}
        <button
          onClick={() => openModal('invoice')}
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 hover:shadow-xl transition-all cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Create Invoice</span>
        </button>

        {/* Secondary Quick Action Menu */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#18181c] border border-[#2e2e33] hover:border-[#3e3e44] text-zinc-200 hover:text-white font-medium text-xs sm:text-sm transition-all cursor-pointer shadow-sm"
            aria-label="More actions"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">New</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-60 bg-[#16161a] rounded-2xl border border-[#2e2e34] shadow-2xl p-1.5 overflow-hidden animate-slideUp backdrop-blur-xl">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  Quick Create
                </p>

                <button
                  onClick={() => openModal('payment-link')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-white">Payment Link</p>
                    <p className="text-[11px] text-zinc-500">Instant shareable checkout</p>
                  </div>
                </button>

                <button
                  onClick={() => openModal('client')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-black transition">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-white">Add Customer</p>
                    <p className="text-[11px] text-zinc-500">Create client profile</p>
                  </div>
                </button>

                <button
                  onClick={() => openModal('brand')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl transition text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-black transition">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-200 group-hover:text-white">Add Brand</p>
                    <p className="text-[11px] text-zinc-500">Branded invoice identity</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AddPaymentLinkModal open={modal === 'payment-link'} onClose={() => setModal(null)} clients={clients} />
      <AddClientModal open={modal === 'client'} onClose={() => setModal(null)} />
      <AddBrandModal open={modal === 'brand'} onClose={() => setModal(null)} />
      <AddInvoiceModal
        open={modal === 'invoice'}
        onClose={() => setModal(null)}
        clients={clients}
        brands={[]}
        gateways={[]}
      />
    </>
  );
}

