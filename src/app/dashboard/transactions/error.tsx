'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CreditCard,
  RotateCcw,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-background text-foreground relative flex min-h-screen items-center justify-center p-6">
      {error?.digest ? (
        <span className="bg-muted text-muted-foreground absolute right-3 top-3 rounded border px-2 py-0.5 font-mono text-[10px]">
          {error.digest}
        </span>
      ) : null}

      <Card className="border-border bg-card text-card-foreground w-full max-w-md border-zinc-200 dark:border-zinc-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <CardTitle className="text-2xl">
            Transaction data failed to load
          </CardTitle>
          <CardDescription>
            We couldn&apos;t load the transaction list right now. Please try
            again, or navigate back to the transactions page.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Collapsible
            open={showDetails}
            onOpenChange={setShowDetails}
            className="bg-muted/40 rounded-md border px-3 py-2"
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  {showDetails ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  Show error details
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 text-xs text-muted-foreground">
              <div className="space-y-1 break-words font-mono">
                {error?.message ? (
                  <p>
                    <span className="font-semibold">Message: </span>
                    {error.message}
                  </p>
                ) : (
                  <p>No error message available.</p>
                )}
                {error?.digest ? (
                  <p>
                    <span className="font-semibold">Digest: </span>
                    {error.digest}
                  </p>
                ) : null}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RotateCcw className="size-4" />
            Try again
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto"
            onClick={reset}
          >
            <Link href="/dashboard/transactions">
              <CreditCard className="size-4" />
              Go to transactions
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
