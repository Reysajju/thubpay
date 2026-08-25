'use client';

import { useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { markInvoicePaid } from '@/app/pay/actions';
import {
  CreditCard,
  Wallet,
  Loader2,
  ShieldCheck,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface PayFormProps {
  invoiceId: string;
  formattedAmount: string;
  defaultEmail?: string;
  defaultName?: string;
  errorParam?: string;
}

type Method = 'stripe' | 'paypal' | 'card' | 'apple_pay' | 'google_pay';

const METHODS: { id: Method; label: string; desc: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Credit / Debit Card', desc: 'Visa, Mastercard, Amex', icon: CreditCard },
  { id: 'stripe', label: 'Stripe Checkout', desc: 'Powered by Stripe', icon: Wallet },
  { id: 'paypal', label: 'PayPal', desc: 'Pay with PayPal balance', icon: Wallet },
  { id: 'apple_pay', label: 'Apple Pay', desc: 'Touch ID / Face ID', icon: CreditCard },
  { id: 'google_pay', label: 'Google Pay', desc: 'Fast & secure', icon: CreditCard },
];

export default function PayForm({
  invoiceId,
  formattedAmount,
  defaultEmail = '',
  defaultName = '',
  errorParam,
}: PayFormProps) {
  const [method, setMethod] = useState<Method>('card');
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const emailValid = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const showEmailError = touched && email.length > 0 && !emailValid;
  const blockedByError = showEmailError;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Validate before letting the native form action run.
    setTouched(true);
    if (blockedByError) {
      e.preventDefault();
      return;
    }
    // Sync the latest method + email into hidden fields so the server action
    // receives them. (The hidden inputs below are kept in sync via value attr,
    // but we set them here too as a belt-and-suspenders measure.)
    const form = e.currentTarget;
    const methodInput = form.elements.namedItem('paymentMethod') as HTMLInputElement | null;
    if (methodInput) methodInput.value = method;
    // Let the native form submission proceed → server action runs → redirect.
  }

  return (
    <form ref={formRef} action={markInvoicePaid} onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="paymentMethod" value={method} />

      {/* ── Customer info ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <label
            htmlFor="customerName"
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            <User className="h-3 w-3" /> Name <span className="text-zinc-600">(optional)</span>
          </label>
          <div className="relative">
            <input
              id="customerName"
              name="customerName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Jane Doe"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-emerald-500/50 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="customerEmail"
            className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            <Mail className="h-3 w-3" /> Email for receipt
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
            <input
              id="customerEmail"
              name="customerEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={showEmailError}
              className={`w-full rounded-xl border bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 transition-colors focus:bg-black/40 focus:outline-none focus:ring-2 ${
                showEmailError
                  ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20'
                  : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/20'
              }`}
            />
          </div>
          {showEmailError && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
              <AlertCircle className="h-3 w-3" /> Please enter a valid email address.
            </p>
          )}
          {errorParam === 'invalid_email' && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-400">
              <AlertCircle className="h-3 w-3" /> The email you submitted was invalid — please try again.
            </p>
          )}
        </div>
      </div>

      {/* ── Payment method selection ──────────────────────────── */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Payment method
        </p>
        <div className="grid grid-cols-1 gap-2">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                aria-pressed={active}
                className="group flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all"
                data-active={active}
                style={{
                  borderColor: active ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)',
                  background: active ? 'rgba(16,185,129,0.07)' : 'rgba(0,0,0,0.2)',
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{
                    background: active ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <Icon
                    className="h-4 w-4"
                    color={active ? '#34d399' : '#a1a1aa'}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{m.label}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{m.desc}</span>
                </span>
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all"
                  style={{
                    borderColor: active ? '#10b981' : '#52525b',
                    background: active ? '#10b981' : 'transparent',
                  }}
                >
                  {active && <CheckCircle2 className="h-4 w-4 text-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Submit — uses useFormStatus for the pending state ──── */}
      <SubmitButton formattedAmount={formattedAmount} disabled={blockedByError} />

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-400" /> 256-bit encrypted
        </span>
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-emerald-400" /> PCI DSS compliant
        </span>
        <span className="text-zinc-600">·</span>
        <span>Powered by ThubPay</span>
      </div>
    </form>
  );
}

function SubmitButton({
  formattedAmount,
  disabled,
}: {
  formattedAmount: string;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 transition-all hover:from-emerald-500 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Processing payment…
        </>
      ) : (
        <>
          <Lock className="h-4 w-4 transition-transform group-hover:scale-110" />
          Pay {formattedAmount} Now
        </>
      )}
    </button>
  );
}
