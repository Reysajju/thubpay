'use client';

import { RefreshCw, Home } from 'lucide-react';

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-thubpay-obsidian flex items-center justify-center px-4">
      <div className="max-w-lg mx-auto text-center w-full">
        <div className="bg-thubpay-surface border border-thubpay-border rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 bg-yellow-500/15 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/30">
            <RefreshCw className="w-10 h-10 text-thubpay-gold" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Payment Cancelled</h1>
          <p className="text-zinc-400 mb-6">
            Your payment was not completed. You can try again or contact support if you have questions.
          </p>
          <div className="space-y-3">
            <a
              href="/dashboard"
              className="btn-gradient block w-full py-3 text-[#111] rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Dashboard
            </a>
            <a
              href="/pay"
              className="block w-full py-3 bg-thubpay-elevated text-zinc-200 rounded-lg font-medium border border-thubpay-border hover:border-thubpay-gold transition-colors"
            >
              Try Again
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
