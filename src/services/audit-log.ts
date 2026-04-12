import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface AuditLogEntry {
  id?: string;
  workspace_id: string;
  user_id: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'password_change'
  | 'api_key_generated'
  | 'api_key_revoked'
  | 'payout_initiated'
  | 'payout_failed'
  | 'refund_initiated'
  | 'refund_failed'
  | 'dispute_created'
  | 'subscription_created'
  | 'subscription_cancelled'
  | 'subscription_renewed'
  | 'payment.charge.attempted';

/**
 * Log an audit event
 */
export async function writeAuditLog(input: {
  workspaceId: string;
  userId: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}) {
  try {
    await admin.from('transaction_events').insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      user_email: '',
      event_type: input.action,
      payload: JSON.stringify({
        resource_type: input.resourceType || 'general',
        resource_id: input.resourceId,
        details: input.details
      })
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

/**
 * Log user login
 */
export async function logUserLogin(userId: string, workspaceId: string, ip: string) {
  await writeAuditLog({
    workspaceId,
    userId,
    action: 'login',
    ipAddress: ip
  });
}

/**
 * Log user logout
 */
export async function logUserLogout(userId: string, workspaceId: string, ip: string) {
  await writeAuditLog({
    workspaceId,
    userId,
    action: 'logout',
    ipAddress: ip
  });
}

/**
 * Get audit log entries for workspace
 */
export async function getAuditLogEntries(
  workspaceId: string,
  limit: number = 100
) {
  try {
    const { data, error } = await admin
      .from('transaction_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit log:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return [];
  }
}
