import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

export class CheckoutComAdapter implements GatewayAdapter {
  slug = 'checkout_com' as GatewaySlug;

  private async getApiKey(): Promise<string> {
    const apiKey = process.env.CHECKOUT_API_KEY || '';
    if (!apiKey) throw new Error('Checkout.com API key not configured');
    return apiKey;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'checkout_com',
      status: 'failed',
      amount: input.amount,
      currency: input.currency,
      error: 'Checkout.com adapter not fully implemented'
    };
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'checkout_com',
      status: 'failed',
      amount: input.amount || 0,
      currency: 'usd',
      error: 'Checkout.com adapter not fully implemented'
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'checkout_com',
      status: 'failed',
      amount: 0,
      currency: 'usd',
      error: 'Checkout.com adapter not fully implemented'
    };
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'Checkout.com adapter not fully implemented' };
  }
}
