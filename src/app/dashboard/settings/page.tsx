import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getGateways, getOnboardingState, type OnboardingState } from '@/lib/demo-data';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId, workspace } = ctx.context;

  const [gateways, onboarding] = await Promise.all([
    getGateways(workspaceId),
    getOnboardingState(workspaceId).catch(() => null as OnboardingState | null),
  ]);

  // Map demo gateways to the shape SettingsClient expects
  const mappedGateways = gateways.map(gw => ({
    id: gw.id,
    gateway_slug: gw.gateway_slug,
    label: gw.label,
    publishable_key: gw.publishable_key,
    mode: gw.mode,
    created_at: gw.created_at,
  }));

  return (
    <SettingsClient
      workspace={{
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        monthly_target_cents: workspace.monthlyTargetCents,
      }}
      gateways={mappedGateways}
      initialOnboarding={onboarding}
    />
  );
}
