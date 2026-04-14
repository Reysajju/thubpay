import React from 'react';
import { Construction, Zap, Plus } from 'lucide-react';

export default function AutomationPage() {
  return (
    <section className="p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Automation & Workflows
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              No-code rules for smart routing, dunning, and retries.
            </p>
          </div>
          
          <button className="btn-gradient px-5 py-2.5 rounded-xl text-[#111] text-sm font-bold shadow-lg shadow-thubpay-gold/20 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        <div className="glass-card rounded-3xl p-12 flex flex-col items-center justify-center text-center border-dashed border-2">
          <Construction className="w-12 h-12 text-thubpay-gold mb-4 animate-bounce" />
          <h2 className="text-xl font-bold text-white mb-2">Visual Workflow Builder</h2>
          <p className="text-zinc-400 max-w-md mx-auto">
            Build Zapier-style automation for failed payment recovery, smart routing across gateways, and auto-reminders.
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl">
            {['Smart Routing', 'Dunning Sequences', 'Retry Logic', 'Revenue Recovery'].map(f => (
              <div key={f} className="p-3 rounded-xl bg-white/5 border border-thubpay-border text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
