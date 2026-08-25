import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getGateways } from '@/lib/demo-data';
import GatewaySettingsClient from './GatewaySettingsClient';

export const dynamic = 'force-dynamic';

export default async function GatewaySettingsPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const gateways = (await getGateways(workspaceId)).map(gw => ({
    id: gw.id,
    gateway_slug: gw.gateway_slug,
    label: gw.label,
    publishable_key: gw.publishable_key,
    mode: gw.mode,
    is_active: gw.is_active,
    is_default: gw.is_default,
    created_at: gw.created_at,
  }));

  return <GatewaySettingsClient initialGateways={gateways} />;
}
