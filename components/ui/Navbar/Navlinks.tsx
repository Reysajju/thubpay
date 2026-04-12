'use client';

import Link from 'next/link';
import { SignOut } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import Logo from '@/components/icons/Logo';
import { usePathname, useRouter } from 'next/navigation';
import { getRedirectMethod } from '@/utils/auth-helpers/settings';
import s from './Navbar.module.css';
import { useState } from 'react';

interface NavlinksProps {
  user?: any;
}

export default function Navlinks({ user }: NavlinksProps) {
  const router = getRedirectMethod() === 'client' ? useRouter() : null;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative flex flex-row justify-between py-4 align-center md:py-5">
      {/* Logo + brand name */}
      <div className="flex items-center flex-1">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="ThubPay Home"
        >
          <Logo />
          <span
            className="text-xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(135deg, #6C5CE7 0%, #00B4D8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            ThubPay
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden ml-8 space-x-1 md:flex items-center">
          <Link
            href="/"
            className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-black/5 transition-all duration-200"
          >
            Home
          </Link>
          <Link
            href="/how-it-works"
            className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-black/5 transition-all duration-200"
          >
            How it works
          </Link>
          <Link
            href="/faqs"
            className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-black/5 transition-all duration-200"
          >
            FAQs
          </Link>
          <Link
            href="/blogs"
            className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-black/5 transition-all duration-200"
          >
            Blogs
          </Link>
          {user && (
            <Link
              href="/dashboard"
              className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-black/5 transition-all duration-200"
            >
              Dashboard
            </Link>
          )}
        </nav>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
            <input type="hidden" name="pathName" value={usePathname()} />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors duration-200"
            >
              Sign out
            </button>
          </form>
        ) : (
          <>
            <Link
              href="/signin"
              className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/signin/signup"
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(135deg, #6C5CE7 0%, #00B4D8 100%)'
              }}
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
