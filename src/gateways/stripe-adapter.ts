import { stripe } from '@/utils/stripe/config';
import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';

export class StripeAdapter implements GatewayAdapter {
  slug = 'stripe';

  async charge(input: ChargeInput): Promise<PaymentResult> {
    const intent = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      description: input.description,
      metadata: {
        tenant_id: input.tenantId,
        invoice_id: input.invoiceId ?? '',
        ...(input.metadata ?? {})
      },
      automatic_payment_methods: { enabled: true }
    });

    return {
      ok: true,
      gateway: 'stripe',
      transactionId: intent.id,
      status: intent.status === 'succeeded' ? 'succeeded' : 'pending',
      amount: input.amount,
      currency: input.currency,
      raw: intent
    };
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    const refund = await stripe.refunds.create({
      payment_intent: transactionId,
      amount: input.amount
    });
    return {
      ok: true,
      gateway: 'stripe',
      transactionId: refund.id,
      status: refund.status === 'succeeded' ? 'succeeded' : 'pending',
      amount: input.amount ?? 0,
      currency: 'usd',
      raw: refund
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    const pi = await stripe.paymentIntents.retrieve(transactionId);
    return {
      ok: true,
      gateway: 'stripe',
      transactionId: pi.id,
      status: pi.status === 'succeeded' ? 'succeeded' : pi.status === 'canceled' ? 'failed' : 'pending',
      amount: pi.amount ?? 0,
      currency: pi.currency ?? 'usd',
      raw: pi
    };
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    try {
      await stripe.accounts.retrieve();
      return { ok: true };
    } catch (error: any) {
      return { ok: false, message: error?.message ?? 'Unable to verify Stripe credentials' };
    }
  }
}
