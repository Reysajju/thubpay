/**
 * ThubPay — Stripe Gateway Adapter
 * Implements PaymentGateway using the Stripe Node SDK.
 * Per instructions.docx §2.2
 */

import Stripe from 'stripe';
import type {
  PaymentGateway,
  GatewayName,
  CustomerParams,
  GatewayCustomer,
  PaymentMethodParams,
  GatewayPaymentMethod,
  SubscriptionParams,
  GatewaySubscription,
  RefundParams,
  GatewayRefund,
  WebhookEvent,
  GatewayWebhookResult
} from './types';

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

function mapStatus(status: Stripe.Subscription.Status): GatewaySubscription['status'] {
  const map: Record<string, GatewaySubscription['status']> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    paused: 'paused',
    incomplete: 'unpaid',
    incomplete_expired: 'canceled'
  };
  return map[status] ?? 'unpaid';
}

function mapSubscription(sub: Stripe.Subscription): GatewaySubscription {
  return {
    id: sub.id,
    gateway: 'stripe',
    customerId: sub.customer as string,
    status: mapStatus(sub.status),
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    raw: sub
  };
}

function mapPaymentMethod(pm: Stripe.PaymentMethod): GatewayPaymentMethod {
  return {
    id: pm.id,
    gateway: 'stripe',
    brand: pm.card?.brand ?? 'unknown',
    last4: pm.card?.last4 ?? '****',
    expiryMonth: pm.card?.exp_month ?? 0,
    expiryYear: pm.card?.exp_year ?? 0,
    isDefault: false // resolved by caller from customer default_source
  };
}

export class StripeAdapter implements PaymentGateway {
  readonly name: GatewayName = 'stripe';

  // ── Customers ──────────────────────────────────────────────────────

  async createCustomer(params: CustomerParams): Promise<GatewayCustomer> {
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata
    });
    return {
      id: customer.id,
      gateway: 'stripe',
      email: customer.email ?? params.email,
      name: customer.name ?? params.name,
      raw: customer
    };
  }

  async getCustomer(customerId: string): Promise<GatewayCustomer> {
    const stripe = getStripeClient();
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) throw new Error(`Customer ${customerId} was deleted`);
    return {
      id: customer.id,
      gateway: 'stripe',
      email: customer.email ?? '',
      name: customer.name ?? '',
      raw: customer
    };
  }

  async deleteCustomer(customerId: string): Promise<void> {
    const stripe = getStripeClient();
    await stripe.customers.del(customerId);
  }

  // ── Payment Methods ────────────────────────────────────────────────

  async attachPaymentMethod(
    params: PaymentMethodParams
  ): Promise<GatewayPaymentMethod> {
    const stripe = getStripeClient();
    const pm = await stripe.paymentMethods.attach(params.token, {
      customer: params.customerId
    });
    if (params.setAsDefault) {
      await stripe.customers.update(params.customerId, {
        invoice_settings: { default_payment_method: pm.id }
      });
    }
    return { ...mapPaymentMethod(pm), isDefault: params.setAsDefault ?? false };
  }

  async listPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]> {
    const stripe = getStripeClient();
    const customer = await stripe.customers.retrieve(customerId);
    const defaultPmId =
      !customer.deleted &&
      typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : null;

    const { data } = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    return data.map((pm) => ({
      ...mapPaymentMethod(pm),
      isDefault: pm.id === defaultPmId
    }));
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    const stripe = getStripeClient();
    await stripe.paymentMethods.detach(paymentMethodId);
  }

  // ── Subscriptions ──────────────────────────────────────────────────

  async createSubscription(
    params: SubscriptionParams
  ): Promise<GatewaySubscription> {
    const stripe = getStripeClient();
    const sub = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      default_payment_method: params.paymentMethodId,
      trial_period_days: params.trialDays,
      metadata: params.metadata,
      expand: ['latest_invoice.payment_intent']
    });
    return mapSubscription(sub);
  }

  async getSubscription(subscriptionId: string): Promise<GatewaySubscription> {
    const stripe = getStripeClient();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    return mapSubscription(sub);
  }

  async cancelSubscription(
    subscriptionId: string,
    immediately = false
  ): Promise<GatewaySubscription> {
    const stripe = getStripeClient();
    const sub = immediately
      ? await stripe.subscriptions.cancel(subscriptionId)
      : await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
    return mapSubscription(sub);
  }

  async updateSubscription(
    subscriptionId: string,
    params: Partial<SubscriptionParams>
  ): Promise<GatewaySubscription> {
    const stripe = getStripeClient();
    const update: Stripe.SubscriptionUpdateParams = {};
    if (params.priceId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      update.items = [{ id: sub.items.data[0].id, price: params.priceId }];
      update.proration_behavior = 'create_prorations';
    }
    if (params.paymentMethodId) {
      update.default_payment_method = params.paymentMethodId;
    }
    const updated = await stripe.subscriptions.update(subscriptionId, update);
    return mapSubscription(updated);
  }

  // ── Refunds ────────────────────────────────────────────────────────

  async createRefund(params: RefundParams): Promise<GatewayRefund> {
    const stripe = getStripeClient();
    const refund = await stripe.refunds.create({
      payment_intent: params.transactionId,
      amount: params.amount,
      reason: (params.reason as Stripe.RefundCreateParams.Reason) ?? 'requested_by_customer'
    });
    return {
      id: refund.id,
      gateway: 'stripe',
      transactionId: params.transactionId,
      amount: refund.amount,
      status:
        refund.status === 'succeeded'
          ? 'succeeded'
          : refund.status === 'failed'
          ? 'failed'
          : 'pending'
    };
  }

  // ── Webhooks ───────────────────────────────────────────────────────

  async handleWebhook(event: WebhookEvent): Promise<GatewayWebhookResult> {
    const stripe = getStripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.rawBody,
        event.signature,
        secret
      );
    } catch {
      throw new Error('Stripe webhook signature verification failed');
    }

    // Normalised payload returned for DB storage
    return {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      processed: true
    };
  }
}
