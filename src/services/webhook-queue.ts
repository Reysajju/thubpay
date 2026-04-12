import { createClient as createAdminClient } from '@supabase/supabase-js';

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function enqueueWebhookJob(input: {
  gateway: string;
  eventId: string;
  eventType: string;
  payload: string;
}) {
  const admin = getAdminClient();
  await (admin as any).from('webhook_jobs').insert({
    gateway_slug: input.gateway,
    event_id: input.eventId,
    event_type: input.eventType,
    payload: input.payload,
    status: 'queued'
  });
}
