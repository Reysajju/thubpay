import { createClient } from '@/utils/supabase/server';

export type PortalRole = 'owner' | 'admin' | 'viewer' | 'member' | 'billing';

export async function getUserRole(
  tenantId: string,
  userId: string
): Promise<PortalRole | null> {
  const supabase = createClient();
  const { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (member) return member.role as PortalRole;

  // Fallback: check if user is the workspace owner even if membership record is missing
  const { data: workspace } = await (supabase as any)
    .from('workspaces')
    .select('owner_user_id')
    .eq('id', tenantId)
    .maybeSingle();

  if (workspace?.owner_user_id === userId) {
    return 'owner';
  }

  return null;
}

export function canManageKeys(role: PortalRole | null): boolean {
  return role === 'owner';
}

export function canViewReports(role: PortalRole | null): boolean {
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'viewer' ||
    role === 'member'
  );
}

export function canWriteBilling(role: PortalRole | null): boolean {
  return (
    role === 'owner' ||
    role === 'admin' ||
    role === 'billing' ||
    role === 'member'
  );
}
