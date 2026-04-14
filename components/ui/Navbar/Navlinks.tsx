'use client';

import Link from 'next/link';
import { SignOut } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import Logo from '@/components/icons/Logo';
import { usePathname, useRouter } from 'next/navigation';
import { getRedirectMethod } from '@/utils/auth-helpers/settings';
import { useState } from 'react';

interface NavlinksProps {
  user?: any;
}

const navLink =
  'px-3 py-2 text-sm font-medium text-zinc-400 hover:text-white rounded-md hover:bg-white/5 transition-all duration-200';

const mobileLink =
  'px-4 py-3 text-sm font-medium text-zinc-300 hover:text-white rounded-lg hover:bg-white/5';

export default function Navlinks({ user }: NavlinksProps) {
  const router = getRedirectMethod() === 'client' ? useRouter() : null;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex flex-row justify-between items-center gap-2 py-4 md:py-5 min-w-0">
      <div className="flex items-center flex-1 min-w-0">
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-2.5 group min-w-0"
          aria-label="ThubPay Home"
          onClick={() => setMenuOpen(false)}
        >
          <Logo />
        </Link>

        <nav className="hidden ml-8 space-x-1 md:flex items-center">
          <Link href="/" className={navLink}>
            Home
          </Link>
          <Link href="/how-it-works" className={navLink}>
            How it works
          </Link>
          <Link href="/faqs" className={navLink}>
            FAQs
          </Link>
          <Link href="/blogs" className={navLink}>
            Blogs
          </Link>
          {user && (
            <Link href="/dashboard" className={navLink}>
              Dashboard
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
              <input type="hidden" name="pathName" value={usePathname()} />
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
              >
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link
                href="/signin"
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
              >
                Sign In
              </Link>
              <Link
                href="/signin/signup"
                className="btn-gradient px-4 py-2 text-sm font-semibold text-[#111] rounded-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-thubpay-gold hover:text-thubpay-gold/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-thubpay-gold rounded-md"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle Navigation"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed left-3 right-3 top-[4.25rem] z-50 flex max-h-[min(70dvh,calc(100dvh-5.5rem))] flex-col gap-2 overflow-y-auto rounded-xl border border-thubpay-border bg-thubpay-surface p-4 shadow-xl md:hidden">
            <nav className="flex flex-col space-y-1">
              <Link href="/" onClick={() => setMenuOpen(false)} className={mobileLink}>
                Home
              </Link>
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)} className={mobileLink}>
                How it works
              </Link>
              <Link href="/faqs" onClick={() => setMenuOpen(false)} className={mobileLink}>
                FAQs
              </Link>
              <Link href="/blogs" onClick={() => setMenuOpen(false)} className={mobileLink}>
                Blogs
              </Link>
              {user && (
                <Link href="/dashboard" onClick={() => setMenuOpen(false)} className={mobileLink}>
                  Dashboard
                </Link>
              )}
            </nav>

            <div className="h-px bg-thubpay-border my-2" />

            <div className="flex flex-col space-y-2">
              {user ? (
                <form
                  onSubmit={(e) => {
                    setMenuOpen(false);
                    handleRequest(e, SignOut, router);
                  }}
                  className="w-full"
                >
                  <input type="hidden" name="pathName" value={usePathname()} />
                  <button type="submit" className={`w-full text-left ${mobileLink}`}>
                    Sign out
                  </button>
                </form>
              ) : (
                <>
                  <Link
                    href="/signin"
                    onClick={() => setMenuOpen(false)}
                    className="px-4 py-3 text-sm font-medium text-center text-zinc-300 border border-thubpay-border rounded-lg hover:bg-white/5"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signin/signup"
                    onClick={() => setMenuOpen(false)}
                    className="btn-gradient px-4 py-3 text-sm font-semibold text-center text-[#111] rounded-lg hover:shadow-lg"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
