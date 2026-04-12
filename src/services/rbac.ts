import { createClient } from '@/utils/supabase/server';

export type PortalRole = 'owner' | 'admin' | 'viewer' | 'member' | 'billing';

export async function getUserRole(tenantId: string, userId: string): Promise<PortalRole | null> {
  const supabase = createClient();
  const { data } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.role as PortalRole | undefined) ?? null;
}

export function canManageKeys(role: PortalRole | null): boolean {
  return role === 'owner';
}

export function canViewReports(role: PortalRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'viewer' || role === 'member';
}

export function canWriteBilling(role: PortalRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'billing' || role === 'member';
}
