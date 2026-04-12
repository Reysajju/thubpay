import { DEFAULT_GATEWAY } from '@/src/config/gateways';
import type { GatewaySlug } from '@/src/config/gateways';
import { createGatewayAdapter } from '@/src/gateways/factory';
import type { ChargeInput, PaymentResult } from '@/src/models/payment';
import { createClient } from '@/utils/supabase/server';

async function resolveGatewayForTenant(
  tenantId: string,
  requested?: GatewaySlug
): Promise<GatewaySlug> {
  if (requested) return requested;

  const supabase = createClient();
  const { data } = await (supabase as any)
    .from('gateway_credentials')
    .select('gateway_slug')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle();

  return (data?.gateway_slug as GatewaySlug | undefined) ?? DEFAULT_GATEWAY;
}

export async function routeCharge(input: ChargeInput): Promise<PaymentResult> {
  const gateway = await resolveGatewayForTenant(input.tenantId, input.gatewayPreference);
  const adapter = createGatewayAdapter(gateway);
  return adapter.charge(input);
}
