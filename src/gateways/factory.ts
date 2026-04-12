import { StripeAdapter } from '@/src/gateways/stripe-adapter';
import { PaypalAdapter } from '@/src/gateways/paypal-adapter';
import type { GatewayAdapter } from '@/src/gateways/types';
import type { GatewaySlug } from '@/src/config/gateways';

export function createGatewayAdapter(slug: GatewaySlug): GatewayAdapter {
  switch (slug) {
    case 'stripe':
      return new StripeAdapter();
    case 'paypal':
      return new PaypalAdapter();
    default:
      // Forward-compatible fallback for gateways planned in phase 2.
      return new StripeAdapter();
  }
}
