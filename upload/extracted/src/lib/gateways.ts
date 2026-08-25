import { db } from '@/lib/db';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { decryptSecret } from '@/lib/crypto';
import crypto from 'crypto';

// ─── ISO 4217 Currency Subunit Precision ───────────────────────
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'OMR', 'TND'
]);

export function getCurrencyDecimals(currency: string): number {
  const code = (currency || 'USD').toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

export function toSubunits(amount: number, currency: string = 'USD'): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return Math.round(amount * factor);
}

export function fromSubunits(subunits: number, currency: string = 'USD'): number {
  const decimals = getCurrencyDecimals(currency);
  const factor = Math.pow(10, decimals);
  return subunits / factor;
}

export function formatCurrencyAmount(subunits: number, currency: string = 'USD'): string {
  const code = (currency || 'USD').toUpperCase();
  const decimals = getCurrencyDecimals(code);
  const amount = fromSubunits(subunits, code);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// ─── Multi-Gateway Payment Abstraction ────────────────────────
// Each gateway implements the same interface so the rest of the
// app is gateway-agnostic. New gateways can be attached at runtime
// via the dashboard's "Custom Gateway" type.

export type GatewaySlug =
  | 'stripe'
  | 'paypal'
  | 'square'
  | 'adyen'
  | 'razorpay'
  | 'authorize_net'
  | 'braintree'
  | 'mollie'
  | 'custom';

export interface PaymentIntentRequest {
  amountCents: number;
  currency: string;
  customerEmail?: string;
  customerName?: string;
  invoiceId?: string;
  description?: string;
  returnUrl?: string;
}

export interface PaymentIntentResponse {
  id: string;
  clientSecret?: string;
  status: 'requires_action' | 'succeeded' | 'failed' | 'pending';
  redirectUrl?: string;
  raw?: Record<string, any>;
}

export interface GatewayAdapter {
  slug: GatewaySlug;
  label: string;
  /** Create a payment intent / order on the gateway. */
  createIntent(
    credential: GatewayCredential,
    req: PaymentIntentRequest
  ): Promise<PaymentIntentResponse>;
  /** Verify an incoming webhook signature. */
  verifyWebhook?(
    credential: GatewayCredential,
    payload: string,
    signature: string
  ): Promise<boolean>;
  /** Parse a webhook event into a normalized shape. */
  parseWebhookEvent?(
    credential: GatewayCredential,
    payload: string
  ): Promise<NormalizedWebhookEvent>;
  /** Refund a previously succeeded payment (full or partial). */
  refund?(
    credential: GatewayCredential,
    externalId: string,
    amountCents?: number,
    reason?: string
  ): Promise<{ id: string; status: 'succeeded' | 'failed' | 'pending'; raw?: Record<string, any> }>;
}

export interface GatewayCredential {
  id: string;
  gatewaySlug: string;
  label: string;
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
  mode: string;
  metadata: Record<string, any> | null;
}

export interface NormalizedWebhookEvent {
  eventType: string;
  externalId: string;
  amountCents: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  customerEmail?: string;
  raw: Record<string, any>;
}

// ─── Registry ─────────────────────────────────────────────────

const REGISTRY = new Map<GatewaySlug, GatewayAdapter>();

export function registerGateway(adapter: GatewayAdapter) {
  REGISTRY.set(adapter.slug, adapter);
}

export function getAdapter(slug: GatewaySlug): GatewayAdapter | undefined {
  return REGISTRY.get(slug);
}

export function listSupportedGateways(): { slug: GatewaySlug; label: string }[] {
  return Array.from(REGISTRY.values()).map((a) => ({ slug: a.slug, label: a.label }));
}

// ─── Stripe Adapter (demo / test mode safe) ───────────────────

registerGateway({
  slug: 'stripe',
  label: 'Stripe',
  async createIntent(cred, req) {
    // In production this would call stripe.paymentIntents.create().
    // For the portal demo we synthesize an intent id.
    const id = `pi_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      clientSecret: `${id}_secret_${cred.publishableKey?.slice(-6) || 'demo'}`,
      status: 'requires_action',
      raw: { gateway: 'stripe', mode: cred.mode, amount: req.amountCents },
    };
  },
  async verifyWebhook(cred, _payload, signature) {
    // Real verification: stripe.webhooks.constructEvent(payload, signature, cred.webhookSecret)
    return Boolean(signature && cred.webhookSecret);
  },
  async parseWebhookEvent(_cred, payload) {
    const evt = JSON.parse(payload);
    const obj = evt.data?.object || {};
    return {
      eventType: evt.type || 'unknown',
      externalId: obj.id || evt.id,
      amountCents: obj.amount_received || obj.amount || 0,
      currency: (obj.currency || 'usd').toUpperCase(),
      status: obj.status === 'succeeded' ? 'succeeded' : obj.status === 'failed' ? 'failed' : 'pending',
      customerEmail: obj.receipt_email,
      raw: evt,
    };
  },
  async refund(cred, externalId, amountCents, reason) {
    // In production: stripe.refunds.create({ payment_intent: externalId, amount: amountCents })
    const id = `re_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      status: 'succeeded',
      raw: { gateway: 'stripe', externalId, amount: amountCents, reason, mode: cred.mode },
    };
  },
});

// ─── PayPal Adapter ───────────────────────────────────────────

registerGateway({
  slug: 'paypal',
  label: 'PayPal',
  async createIntent(cred, req) {
    const id = `PAYID_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      status: 'pending',
      redirectUrl: req.returnUrl
        ? `${req.returnUrl}?paypal_order=${id}`
        : undefined,
      raw: { gateway: 'paypal', mode: cred.mode, amount: req.amountCents },
    };
  },
  async verifyWebhook(cred, _payload, signature) {
    return Boolean(signature && cred.webhookSecret);
  },
  async parseWebhookEvent(_cred, payload) {
    const evt = JSON.parse(payload);
    return {
      eventType: evt.event_type || 'unknown',
      externalId: evt.resource?.id || evt.id,
      amountCents: Math.round((evt.resource?.amount?.total || 0) * 100),
      currency: (evt.resource?.amount?.currency || 'USD').toUpperCase(),
      status: evt.event_type?.includes('PAYMENT.CAPTURE.COMPLETED')
        ? 'succeeded'
        : evt.event_type?.includes('DENIED')
        ? 'failed'
        : 'pending',
      customerEmail: evt.resource?.payer?.email_address,
      raw: evt,
    };
  },
  async refund(cred, externalId, amountCents, reason) {
    // In production: POST /v2/payments/captures/{id}/refund
    const id = `REFID_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      status: 'succeeded',
      raw: { gateway: 'paypal', externalId, amount: amountCents, reason, mode: cred.mode },
    };
  },
});

// ─── Square Adapter ───────────────────────────────────────────

registerGateway({
  slug: 'square',
  label: 'Square',
  async createIntent(cred, req) {
    const id = `sq_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      clientSecret: `${id}_cs`,
      status: 'requires_action',
      raw: { gateway: 'square', mode: cred.mode },
    };
  },
  async verifyWebhook(cred, _payload, signature) {
    return Boolean(signature && cred.webhookSecret);
  },
  async parseWebhookEvent(_cred, payload) {
    const evt = JSON.parse(payload);
    return {
      eventType: evt.type || 'unknown',
      externalId: evt.data?.object?.payment?.id || evt.id,
      amountCents: evt.data?.object?.payment?.amount_money?.amount || 0,
      currency: (evt.data?.object?.payment?.amount_money?.currency || 'USD').toUpperCase(),
      status: 'pending',
      raw: evt,
    };
  },
});

// ─── Razorpay Adapter ─────────────────────────────────────────

registerGateway({
  slug: 'razorpay',
  label: 'Razorpay',
  async createIntent(cred, req) {
    const id = `order_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      clientSecret: `${id}_rzp`,
      status: 'requires_action',
      raw: { gateway: 'razorpay', mode: cred.mode },
    };
  },
  async verifyWebhook(cred, _payload, signature) {
    return Boolean(signature && cred.webhookSecret);
  },
  async parseWebhookEvent(_cred, payload) {
    const evt = JSON.parse(payload);
    return {
      eventType: evt.event || 'unknown',
      externalId: evt.payload?.payment?.entity?.id || evt.id,
      amountCents: evt.payload?.payment?.entity?.amount || 0,
      currency: (evt.payload?.payment?.entity?.currency || 'INR').toUpperCase(),
      status: evt.event?.includes('captured') ? 'succeeded' : evt.event?.includes('failed') ? 'failed' : 'pending',
      raw: evt,
    };
  },
});

// ─── Authorize.Net Adapter ────────────────────────────────────

registerGateway({
  slug: 'authorize_net',
  label: 'Authorize.Net',
  async createIntent(cred, req) {
    const id = `anet_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      status: 'pending',
      raw: { gateway: 'authorize_net', mode: cred.mode },
    };
  },
});

// ─── Braintree Adapter ────────────────────────────────────────

registerGateway({
  slug: 'braintree',
  label: 'Braintree',
  async createIntent(cred, req) {
    const id = `bt_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      clientSecret: id,
      status: 'requires_action',
      raw: { gateway: 'braintree', mode: cred.mode },
    };
  },
});

// ─── Adyen Adapter ────────────────────────────────────────────

registerGateway({
  slug: 'adyen',
  label: 'Adyen',
  async createIntent(cred, req) {
    const id = `adyen_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      clientSecret: `${id}_adyen`,
      status: 'requires_action',
      raw: { gateway: 'adyen', mode: cred.mode },
    };
  },
  async verifyWebhook(cred, _payload, signature) {
    return Boolean(signature && cred.webhookSecret);
  },
  async parseWebhookEvent(_cred, payload) {
    const evt = JSON.parse(payload);
    return {
      eventType: evt.eventCode || 'unknown',
      externalId: evt.eventDate || evt.id,
      amountCents: evt.amount?.value || 0,
      currency: (evt.amount?.currency || 'USD').toUpperCase(),
      status: evt.success === 'true' ? 'succeeded' : 'failed',
      raw: evt,
    };
  },
});

// ─── Mollie Adapter ───────────────────────────────────────────

registerGateway({
  slug: 'mollie',
  label: 'Mollie',
  async createIntent(cred, req) {
    const id = `mol_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      status: 'pending',
      redirectUrl: req.returnUrl ? `${req.returnUrl}?mollie=${id}` : undefined,
      raw: { gateway: 'mollie', mode: cred.mode },
    };
  },
});

// ─── Custom Gateway Adapter (user-defined external endpoint) ──

registerGateway({
  slug: 'custom',
  label: 'Custom Gateway',
  async createIntent(cred, req) {
    const endpoint = cred.metadata?.endpoint || cred.publishableKey || '';
    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: req.amountCents,
            currency: req.currency,
            reference: req.invoiceId,
            customer: { email: req.customerEmail, name: req.customerName },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          return {
            id: data.id || `custom_${Date.now()}`,
            clientSecret: data.client_secret,
            status: data.status === 'succeeded' ? 'succeeded' : 'requires_action',
            redirectUrl: data.redirect_url,
            raw: data,
          };
        }
      } catch (err) {
        // Fall through to demo mode
      }
    }
    const id = `custom_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      id,
      clientSecret: `${id}_cs`,
      status: 'requires_action',
      raw: { gateway: 'custom', mode: cred.mode, endpoint },
    };
  },
});

// ─── Credential resolver ──────────────────────────────────────

export async function resolveCredentialForRequest(): Promise<
  | { ok: true; credential: GatewayCredential; workspaceId: string }
  | { ok: false; error: string; status: number }
> {
  const ws = await requireWorkspace();
  if (!ws.ok) return ws;

  // Prefer the default gateway; fall back to any active one.
  let cred = await db.gatewayCredential.findFirst({
    where: { workspaceId: ws.context.workspaceId, isActive: true, isDefault: true },
  });
  if (!cred) {
    cred = await db.gatewayCredential.findFirst({
      where: { workspaceId: ws.context.workspaceId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }
  if (!cred) {
    return {
      ok: false,
      error: 'No active payment gateway connected. Add one in Settings → Gateways.',
      status: 400,
    };
  }

  return {
    ok: true,
    workspaceId: ws.context.workspaceId,
    credential: {
      id: cred.id,
      gatewaySlug: cred.gatewaySlug,
      label: cred.label,
      publishableKey: cred.publishableKey,
      secretKey: decryptSecret(cred.secretKeyEnc),
      webhookSecret: decryptSecret(cred.webhookSecret) || cred.webhookSecret,
      mode: cred.mode,
      metadata: cred.metadata ? JSON.parse(cred.metadata) : null,
    },
  };
}

// ─── Public helper: create intent via the active adapter ──────

export async function createPaymentIntent(
  req: PaymentIntentRequest
): Promise<
  | { ok: true; intent: PaymentIntentResponse; gatewaySlug: string; gatewayId: string }
  | { ok: false; error: string; status: number }
> {
  const resolved = await resolveCredentialForRequest();
  if (!resolved.ok) return resolved;

  const adapter = getAdapter(resolved.credential.gatewaySlug as GatewaySlug);
  if (!adapter) {
    return {
      ok: false,
      error: `Unsupported gateway: ${resolved.credential.gatewaySlug}`,
      status: 400,
    };
  }

  const intent = await adapter.createIntent(resolved.credential, req);

  // Persist the transaction record
  const tx = await db.transaction.create({
    data: {
      workspaceId: resolved.workspaceId,
      invoiceId: req.invoiceId || null,
      gatewayId: resolved.credential.id,
      gatewaySlug: resolved.credential.gatewaySlug,
      externalId: intent.id,
      amountCents: req.amountCents,
      currency: req.currency,
      status: 'pending',
      customerEmail: req.customerEmail || null,
      customerName: req.customerName || null,
    },
  });

  return {
    ok: true,
    intent,
    gatewaySlug: resolved.credential.gatewaySlug,
    gatewayId: resolved.credential.id,
  };
}
