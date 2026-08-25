import React from 'react';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import DashboardSidebar from './components/DashboardSidebar';
import MobileTopBar from './components/MobileTopBar';
import CommandPaletteHost from './components/CommandPaletteHost';
import HelpHost from './components/HelpHost';
import { OnboardingWalkthrough } from './components/OnboardingWalkthrough';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect('/signin');
    return;
  }

  // Lightweight workspace lookup — just the ID, name, and theme preference
  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    select: {
      workspaceId: true,
      workspace: { select: { name: true, themePreference: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!membership) {
    redirect('/signin');
    return;
  }

  // Server-side theme preference hint — passed to the client via a data attribute.
  const serverThemeHint = membership.workspace.themePreference || 'dark';

  return (
    <div
      className="flex w-full min-h-screen bg-[#0a0a0c] relative"
      data-server-theme-hint={serverThemeHint}
    >
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar workspaceId={membership.workspaceId} workspaceName={membership.workspace.name} />
      </div>

      {/* Mobile top bar */}
      <MobileTopBar />

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto pt-14 lg:pt-0 pb-24 lg:pb-20">
        <div className="min-h-full">{children}</div>
      </main>

      {/* Onboarding walkthrough (shows on first visit) */}
      <OnboardingWalkthrough
        workspaceId={membership.workspaceId}
        workspaceName={membership.workspace.name}
      />

      {/* Single global mount for the Cmd+K command palette.
          Previously mounted in both DashboardSidebar and MobileTopBar,
          which caused duplicate overlays + autofocus races. */}
      <CommandPaletteHost />

      {/* Floating Help button + keyboard shortcuts overlay + g-prefix / n-prefix
          keyboard navigation. Single mount at layout root so the global
          keydown listener is bound exactly once. */}
      <HelpHost />
    </div>
  );
}
