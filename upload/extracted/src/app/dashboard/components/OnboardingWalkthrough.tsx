'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Building2,
  Users,
  FileText,
  X,
  Check,
  ChevronRight,
  Rocket,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface OnboardingState {
  stepGateway: boolean;
  stepBrand: boolean;
  stepClient: boolean;
  stepInvoice: boolean;
  walkthroughSkipped: boolean;
  completionPct: number;
  completed: boolean;
}

interface Props {
  workspaceId: string;
  workspaceName: string;
}

const STEPS = [
  {
    key: 'stepGateway' as const,
    label: 'Connect a Payment Gateway',
    description: 'Add your Stripe, PayPal, or other gateway API keys to start accepting payments.',
    icon: CreditCard,
    href: '/dashboard/settings?tab=gateways',
    color: 'text-[#10B981] bg-[#10B981]/10',
  },
  {
    key: 'stepBrand' as const,
    label: 'Set Up Your Brand',
    description: 'Customize your workspace name and logo for invoices and checkout pages.',
    icon: Building2,
    href: '/dashboard/settings?tab=general',
    color: 'text-[#10B981] bg-[#10B981]/10',
  },
  {
    key: 'stepClient' as const,
    label: 'Add Your First Client',
    description: 'Create a customer profile to start sending invoices and collecting payments.',
    icon: Users,
    href: '/dashboard/customers',
    color: 'text-[#10B981] bg-[#10B981]/10',
  },
  {
    key: 'stepInvoice' as const,
    label: 'Create Your First Invoice',
    description: 'Send your first invoice and get a shareable payment link instantly.',
    icon: FileText,
    href: '/dashboard',
    color: 'text-[#10B981] bg-[#10B981]/10',
  },
];

export function OnboardingWalkthrough({ workspaceId, workspaceName }: Props) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const router = useRouter();

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/onboarding');
      if (res.ok) {
        const data = await res.json();
        setState(data);

        // Show modal if not completed and not skipped
        if (!data.completed && !data.walkthroughSkipped) {
          // Find first incomplete step
          const firstIncomplete = STEPS.findIndex((s) => !data[s.key]);
          setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0);
          setShowModal(true);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await fetch('/api/dashboard/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipWalkthrough: true }),
      });
      setShowModal(false);
      setState((prev) => prev ? { ...prev, walkthroughSkipped: true } : prev);
    } catch {
      // silent
    } finally {
      setSkipping(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowModal(false);
    }
  };

  const handleGoToStep = (href: string) => {
    setShowModal(false);
    router.push(href);
  };

  if (loading || !state) return null;

  // Don't render anything if completed or skipped
  if (state.completed || state.walkthroughSkipped) return null;

  const step = STEPS[currentStep];
  const StepIcon = step.icon;

  return (
    <>
      {/* Walkthrough Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fadeIn"
            onClick={() => setShowModal(false)}
          />
          <div className="relative w-full max-w-lg bg-[#0d0d0f] rounded-3xl border border-[#1a1a20] shadow-2xl overflow-hidden animate-scaleIn">
            {/* Header with gradient */}
            <div className="relative px-6 py-8 bg-gradient-to-br from-[#10B981]/10 via-transparent to-[#10B981]/5 border-b border-[#1a1a20]">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center text-white hover:bg-black/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-lg shadow-[#10B981]/20">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Welcome to ThubPay!</h2>
                  <p className="text-sm text-zinc-400">Let&apos;s get you set up in 4 quick steps</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[#1a1a20] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-500"
                    style={{ width: `${state.completionPct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#10B981]">{state.completionPct}%</span>
              </div>
            </div>

            {/* Step content */}
            <div className="px-6 py-6">
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-5">
                {STEPS.map((s, i) => {
                  const isDone = state[s.key];
                  const isCurrent = i === currentStep;
                  const SIcon = s.icon;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setCurrentStep(i)}
                      className={`flex-1 flex flex-col items-center gap-1.5 transition-all ${
                        isCurrent ? 'scale-105' : 'opacity-50 hover:opacity-80'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isDone
                            ? 'bg-[#10B981]/20 border border-[#10B981]/30'
                            : isCurrent
                            ? 'bg-[#10B981]/10 border border-[#10B981]/40'
                            : 'bg-[#1a1a20] border border-[#252529]'
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-4 h-4 text-[#10B981]" />
                        ) : (
                          <SIcon className={`w-4 h-4 ${isCurrent ? 'text-[#10B981]' : 'text-zinc-500'}`} />
                        )}
                      </div>
                      <span className={`text-[9px] font-medium ${isCurrent ? 'text-white' : 'text-zinc-500'}`}>
                        {i + 1}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Current step detail */}
              <div className="p-4 rounded-2xl bg-[#0a0a0c] border border-[#1a1a20]">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${step.color}`}>
                    <StepIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">{step.label}</h3>
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{step.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleGoToStep(step.href)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white text-sm font-bold hover:opacity-90 transition-all"
                >
                  {state[step.key] ? 'Completed — Next' : 'Set Up Now'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-5">
                <button
                  onClick={handleSkip}
                  disabled={skipping}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
                >
                  {skipping ? 'Skipping...' : 'Skip for now'}
                </button>
                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <button
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-[#10B981] bg-[#10B981]/10 hover:bg-[#10B981]/20 transition-all"
                  >
                    {currentStep === STEPS.length - 1 ? 'Finish' : 'Next Step'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Completion Indicator (always visible in sidebar until 100%) ──

export function OnboardingIndicator({ workspaceId }: { workspaceId: string }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/dashboard/onboarding')
      .then((res) => res.json())
      .then((data) => {
        if (data.completionPct !== undefined) setState(data);
      })
      .catch(() => {});
  }, []);

  if (!state || state.completed) return null;

  const remainingSteps = STEPS.filter((s) => !state[s.key]);

  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 rounded-xl bg-gradient-to-br from-[#10B981]/10 to-transparent border border-[#10B981]/20 hover:border-[#10B981]/40 transition-all group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#10B981] uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Setup
          </span>
          <span className="text-xs font-bold text-white">{state.completionPct}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-[#1a1a20] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] transition-all duration-500"
            style={{ width: `${state.completionPct}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-500 mt-1.5">
          {remainingSteps.length} step{remainingSteps.length !== 1 ? 's' : ''} remaining
        </p>
      </button>

      {/* Expanded steps */}
      {expanded && (
        <div className="mt-2 space-y-1 animate-fadeIn">
          {STEPS.map((s) => {
            const isDone = state[s.key];
            const SIcon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => router.push(s.href)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left ${
                  isDone ? 'opacity-50' : 'hover:bg-white/5'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${
                    isDone ? 'bg-[#10B981]/20' : 'bg-[#1a1a20]'
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3 h-3 text-[#10B981]" />
                  ) : (
                    <SIcon className="w-3 h-3 text-zinc-500" />
                  )}
                </div>
                <span className={`text-[11px] flex-1 ${isDone ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                  {s.label}
                </span>
                {!isDone && <ChevronRight className="w-3 h-3 text-zinc-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
