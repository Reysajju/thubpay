import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

export class VerifoneAdapter implements GatewayAdapter {
  slug = 'verifone' as GatewaySlug;

  private async getApiKey(): Promise<string> {
    const apiKey = process.env.VERIFONE_API_KEY || '';
    if (!apiKey) throw new Error('Verifone API key not configured');
    return apiKey;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'verifone',
      status: 'failed',
      amount: input.amount,
      currency: input.currency,
      error: 'Verifone adapter not fully implemented'
    };
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'verifone',
      status: 'failed',
      amount: input.amount || 0,
      currency: 'usd',
      error: 'Verifone adapter not fully implemented'
    };
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    return {
      ok: false,
      gateway: 'verifone',
      status: 'failed',
      amount: 0,
      currency: 'usd',
      error: 'Verifone adapter not fully implemented'
    };
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: 'Verifone adapter not fully implemented' };
  }
}