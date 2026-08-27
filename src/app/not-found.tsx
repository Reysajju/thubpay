import Link from 'next/link';
import { FileQuestion, Home, LayoutDashboard } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center p-6">
      <main className="flex w-full max-w-md flex-col items-center text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-8" />
        </div>

        <p className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
          Error
        </p>
        <h1 className="text-7xl font-bold tracking-tight sm:text-8xl">404</h1>
        <h2 className="mt-4 text-2xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/">
              <Home className="size-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" />
              View dashboard
            </Link>
          </Button>
        </div>
      </main>

      <footer className="text-muted-foreground mt-12 text-xs">
        &copy; {new Date().getFullYear()} ThubPay
      </footer>
    </div>
  );
}
