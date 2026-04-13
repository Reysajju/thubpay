import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

export class AdyenAdapter implements GatewayAdapter {
  slug = 'adyen' as GatewaySlug;

  private async getApiKey(): Promise<string> {
    const apiKey = process.env.ADYEN_API_KEY || '';
    if (!apiKey) throw new Error('Adyen API key not configured');
    return apiKey;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'adyen',
      status: 'failed',
      amount: input.amount,
      currency: input.currency,
      error: 'Adyen adapter not fully implemented'
    };
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'adyen',
      status: 'failed',
      amount: input.amount || 0,
      currency: 'usd',
      error: 'Adyen adapter not fully implemented'
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'adyen',
      status: 'failed',
      amount: 0,
      currency: 'usd',
      error: 'Adyen adapter not fully implemented'
    };
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'Adyen adapter not fully implemented' };
  }
}
