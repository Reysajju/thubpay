/**
 * ThubPay — Gateway Registry & Factory
 * Maps gateway name strings to adapter instances.
 * API routes call getGateway('stripe') — never import adapters directly.
 * Per instructions.docx §2.3
 */

import type { PaymentGateway, GatewayName } from './types';
import { StripeAdapter } from './stripe';

// Registry holds singleton adapter instances (lazy-initialised)
const registry = new Map<GatewayName, PaymentGateway>();

/**
 * Get a gateway adapter by name.
 * Throws if the gateway is not registered or has been disabled.
 */
export function getGateway(name: GatewayName): PaymentGateway {
  if (registry.has(name)) {
    return registry.get(name)!;
  }

  // Check if gateway is enabled via environment feature flag
  const envKey = `GATEWAY_${name.toUpperCase()}_ENABLED`;
  const enabled = process.env[envKey] !== 'false'; // enabled by default unless explicitly disabled

  if (!enabled) {
    throw new Error(
      `Gateway "${name}" is disabled. Set ${envKey}=true to enable it.`
    );
  }

  let adapter: PaymentGateway;

  switch (name) {
    case 'stripe':
      adapter = new StripeAdapter();
      break;

    // Future adapters — uncomment as you implement them:
    // case 'paypal':
    //   adapter = new PayPalAdapter();
    //   break;
    // case 'square':
    //   adapter = new SquareAdapter();
    //   break;
    // case 'adyen':
    //   adapter = new AdyenAdapter();
    //   break;
    // case 'razorpay':
    //   adapter = new RazorpayAdapter();
    //   break;
    // case 'authorize_net':
    //   adapter = new AuthorizeNetAdapter();
    //   break;

    default:
      throw new Error(
        `Gateway "${name}" is not yet implemented. ` +
          `Add its adapter in lib/gateways/${name}.ts and register it here.`
      );
  }

  registry.set(name, adapter);
  return adapter;
}

/**
 * List all currently registered (instantiated) gateway names.
 */
export function listActiveGateways(): GatewayName[] {
  return Array.from(registry.keys());
}

/**
 * Clear the registry — useful in tests to reset state.
 */
export function clearRegistry(): void {
  registry.clear();
}
