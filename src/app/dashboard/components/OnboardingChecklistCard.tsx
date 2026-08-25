import Link from 'next/link';
import {
  CreditCard,
  Building2,
  Users,
  FileText,
  Check,
  ChevronRight,
  Sparkles,
  Rocket,
  X,
} from 'lucide-react';

export interface OnboardingState {
  stepGateway: boolean;
  stepBrand: boolean;
  stepClient: boolean;
  stepInvoice: boolean;
  walkthroughSkipped: boolean;
  completionPct: number;
  completed: boolean;
}

interface Props {
  state: OnboardingState;
  workspaceName: string;
}

const STEPS = [
  {
    key: 'stepGateway' as const,
    label: 'Connect a Payment Gateway',
    description: 'Add Stripe, PayPal, or another gateway to start accepting payments.',
    icon: CreditCard,
    href: '/dashboard/settings?tab=gateways',
    accent: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/25 text-emerald-400',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
    cta: 'Connect Gateway',
  },
  {
    key: 'stepBrand' as const,
    label: 'Set Up Your Brand',
    description: 'Customize your workspace name and logo for invoices and checkout.',
    icon: Building2,
    href: '/dashboard/settings?tab=general',
    accent: 'from-cyan-500/15 to-cyan-500/5 border-cyan-500/25 text-cyan-400',
    iconBg: 'bg-cyan-500/10 text-cyan-400',
    cta: 'Customize Brand',
  },
  {
    key: 'stepClient' as const,
    label: 'Add Your First Client',
    description: 'Create a customer profile to start sending invoices.',
    icon: Users,
    href: '/dashboard/customers',
    accent: 'from-amber-500/15 to-amber-500/5 border-amber-500/25 text-amber-400',
    iconBg: 'bg-amber-500/10 text-amber-400',
    cta: 'Add Client',
  },
  {
    key: 'stepInvoice' as const,
    label: 'Create Your First Invoice',
    description: 'Send your first invoice and get a shareable payment link instantly.',
    icon: FileText,
    href: '/dashboard',
    accent: 'from-purple-500/15 to-purple-500/5 border-purple-500/25 text-purple-400',
    iconBg: 'bg-purple-500/10 text-purple-400',
    cta: 'Create Invoice',
  },
];

export default function OnboardingChecklistCard({ state, workspaceName }: Props) {
  const remaining = STEPS.filter((s) => !state[s.key]);
  const nextStep = remaining[0];
  const NextIcon = nextStep?.icon ?? Rocket;

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 relative overflow-hidden">
      {/* Decorative gradient blob in the corner */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-25 bg-gradient-to-br from-emerald-500 to-cyan-500"
        aria-hidden
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 relative">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-lg shadow-[#10B981]/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                Welcome to {workspaceName || 'ThubPay'}!
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                {state.completionPct}% complete
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {remaining.length === 0
                ? 'You’re all set up! 🎉'
                : `${remaining.length} step${remaining.length !== 1 ? 's' : ''} remaining to complete setup.`}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-emerald-300 tabular-nums">{state.completionPct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[#1a1a1f] overflow-hidden mb-5 relative">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700 relative"
          style={{ width: `${state.completionPct}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Next-step CTA (highlighted) */}
      {nextStep && (
        <Link
          href={nextStep.href}
          className={`group block relative overflow-hidden rounded-2xl p-4 mb-4 border bg-gradient-to-br ${nextStep.accent} transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-emerald-500/10 hover-glow-border`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${nextStep.iconBg}`}>
              <NextIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Next step
                </span>
              </div>
              <p className="text-sm font-bold text-white truncate">{nextStep.label}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{nextStep.description}</p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-semibold text-white transition-colors">
                {nextStep.cta}
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </Link>
      )}

      {/* All steps checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {STEPS.map((step, i) => {
          const isDone = state[step.key];
          const SIcon = step.icon;
          return (
            <Link
              key={step.key}
              href={step.href}
              className={`group relative rounded-xl p-3 border transition-all hover-lift ${
                isDone
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-[#1a1a1f]/60 border-[#252529] hover:border-[#3a3a3f] hover:bg-[#1d1d22]'
              }`}
            >
              {/* Step number badge */}
              <span
                className={`absolute -top-2 -left-2 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border ${
                  isDone
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-[#0a0a0c] border-[#252529] text-zinc-500'
                }`}
              >
                {i + 1}
              </span>

              <div className="flex items-start gap-2.5">
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    isDone ? 'bg-emerald-500/15 text-emerald-400' : step.iconBg
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : <SIcon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[11px] font-bold leading-tight ${
                      isDone ? 'text-emerald-300/80 line-through' : 'text-zinc-200'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">
                    {isDone ? 'Completed' : step.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#252529]/50 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {state.completionPct === 100
            ? 'Setup complete — you can dismiss this card'
            : 'Complete all steps to unlock the full dashboard experience'}
        </span>
        <Link
          href="/dashboard/settings"
          className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
        >
          Skip setup
          <X className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
