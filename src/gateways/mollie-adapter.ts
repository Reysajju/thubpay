import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

export class MollieAdapter implements GatewayAdapter {
  slug = 'mollie' as GatewaySlug;

  private async getApiKey(): Promise<string> {
    const apiKey = process.env.MOLLIE_API_KEY || '';
    if (!apiKey) throw new Error('Mollie API key not configured');
    return apiKey;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'mollie',
      status: 'failed',
      amount: input.amount,
      currency: input.currency,
      error: 'Mollie adapter not fully implemented'
    };
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'mollie',
      status: 'failed',
      amount: input.amount || 0,
      currency: 'usd',
      error: 'Mollie adapter not fully implemented'
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'mollie',
      status: 'failed',
      amount: 0,
      currency: 'usd',
      error: 'Mollie adapter not fully implemented'
    };
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'Mollie adapter not fully implemented' };
  }
}