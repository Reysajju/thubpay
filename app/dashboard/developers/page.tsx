import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import DeveloperToolsClient from './DeveloperToolsClient';

export const dynamic = 'force-dynamic';

export default async function DevelopersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/signin');

  const { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = member?.workspace_id;

  // Fetch real API keys
  const { data: apiKeys } = workspaceId
    ? await (supabase as any)
        .from('api_keys')
        .select('*')
        .eq('tenant_id', workspaceId)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Fetch real webhook events
  const { data: webhookEvents } = await (supabase as any)
    .from('webhook_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch gateway credentials
  const { data: gateways } = workspaceId
    ? await (supabase as any)
        .from('gateway_credentials')
        .select('gateway_slug, is_live, created_at')
        .eq('workspace_id', workspaceId)
    : { data: [] };

  return (
    <DeveloperToolsClient
      apiKeys={apiKeys ?? []}
      webhookEvents={webhookEvents ?? []}
      gateways={gateways ?? []}
    />
  );
}
