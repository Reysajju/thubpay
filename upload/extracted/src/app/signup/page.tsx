'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Register the user via API
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: fullName })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Auto sign in after registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setSuccess(true);
        setTimeout(() => router.push('/signin'), 1500);
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/dashboard'), 1500);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669] to-[#34D399]">
              <span className="text-sm font-black text-white">T</span>
            </div>
            <span className="text-2xl font-bold text-white">ThubPay</span>
          </Link>
          <h2 className="mt-8 text-3xl font-black text-white">Create your account</h2>
          <p className="mt-2 text-sm text-zinc-400">Start accepting payments in minutes</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
              Account created! Redirecting to dashboard...
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-[#1d1d20] px-4 py-3 text-white outline-none focus:border-[#059669] transition-all placeholder:text-zinc-600"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-[#1d1d20] px-4 py-3 text-white outline-none focus:border-[#059669] transition-all placeholder:text-zinc-600"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-[#1d1d20] px-4 py-3 text-white outline-none focus:border-[#059669] transition-all placeholder:text-zinc-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#059669] to-[#34D399] py-3 text-sm font-bold text-black hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link href="/signin" className="text-[#34D399] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
