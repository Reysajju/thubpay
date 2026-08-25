'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    const loginEmail = customEmail || email;
    const loginPassword = customPassword || password;

    if (!loginEmail || !loginPassword) {
      setError('Please provide email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error || 'Invalid credentials. Click "1-Click Demo Login" to enter instantly.');
        setLoading(false);
        setDemoLoading(false);
      } else {
        const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl');
        window.location.href = callbackUrl || '/dashboard';
      }
    } catch {
      setError('Connection error. Please try again or use 1-Click Demo Login.');
      setLoading(false);
      setDemoLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setEmail('admin@thubpay.com');
    setPassword('admin123');
    setDemoLoading(true);
    await handleSignIn(undefined, 'admin@thubpay.com', 'admin123');
  };

  const fillCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669] to-[#34D399] shadow-lg shadow-emerald-950/40">
              <span className="text-base font-black text-white">T</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">ThubPay</span>
          </Link>
          <h2 className="mt-8 text-3xl font-black tracking-tight text-white">Welcome back</h2>
          <p className="mt-2 text-sm text-zinc-400">Sign in to manage your workspace and payments</p>
        </div>

        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-8 shadow-2xl backdrop-blur-xl">
          {/* 1-Click Demo Login Banner */}
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            disabled={loading || demoLoading}
            className="group flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-left transition-all hover:border-emerald-500/60 hover:bg-emerald-950/40 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-300">1-Click Instant Demo Login</p>
                <p className="text-[11px] text-emerald-400/70">Seamless access as admin@thubpay.com</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-emerald-400 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-white/5" />
            <span className="bg-[#0a0a0b] px-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Or sign in with email
            </span>
          </div>

          <form onSubmit={(e) => handleSignIn(e)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-[#1d1d20] px-4 py-3 text-white outline-none focus:border-[#059669] transition-all placeholder:text-zinc-600 text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-[#1d1d20] px-4 py-3 text-white outline-none focus:border-[#059669] transition-all placeholder:text-zinc-600 text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full rounded-xl bg-gradient-to-r from-[#059669] to-[#34D399] py-3 text-sm font-bold text-black hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-emerald-950/30"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="pt-3 border-t border-white/5 space-y-2">
            <p className="text-center text-xs text-zinc-500">Click to autofill demo credentials:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('admin@thubpay.com', 'admin123')}
                className="rounded-lg bg-[#18181b] border border-zinc-800/80 p-2 text-left hover:border-emerald-500/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Admin
                </div>
                <p className="text-[10px] text-zinc-500 font-mono truncate">admin@thubpay.com</p>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('demo@thubpay.com', 'demo123')}
                className="rounded-lg bg-[#18181b] border border-zinc-800/80 p-2 text-left hover:border-emerald-500/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Demo User
                </div>
                <p className="text-[10px] text-zinc-500 font-mono truncate">demo@thubpay.com</p>
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-zinc-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-[#34D399] font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
