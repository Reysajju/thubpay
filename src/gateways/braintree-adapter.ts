import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

export class BraintreeAdapter implements GatewayAdapter {
  slug = 'braintree' as GatewaySlug;

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.BRAINTREE_CLIENT_ID || '';
    const clientSecret = process.env.BRAINTREE_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      throw new Error('Braintree credentials not configured');
    }

    // Create a token with client credentials
    const response = await fetch('https://api.braintreegateway.com/api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      throw new Error('Braintree OAuth failed');
    }

    const data = await response.json();
    return data.access_token;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    try {
      const token = await this.getAccessToken();

      // Create a transaction using Braintree API
      const response = await fetch('https://api.braintreegateway.com/api/v3/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: input.amount.toFixed(2),
          payment_method_nonce: 'fake-valid-nonce', // In production, use stored nonce
          order_id: `thubpay_${input.tenantId}_${Date.now()}`,
          device_data: 'some_device_data' // Capture device fingerprint
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          ok: false,
          gateway: 'braintree',
          status: 'failed',
          amount: input.amount,
          currency: input.currency,
          error: `Braintree charge failed: ${error}`
        };
      }

      const transaction = await response.json();

      return {
        ok: true,
        gateway: 'braintree',
        status: transaction.status === 'authorized' || transaction.status === 'settled'
          ? 'succeeded'
          : 'pending',
        amount: input.amount,
        currency: input.currency,
        transactionId: transaction.id,
        raw: transaction
      };
    } catch (error) {
      console.error('Braintree charge error:', error);
      return {
        ok: false,
        gateway: 'braintree',
        status: 'failed',
        amount: input.amount,
        currency: input.currency,
        error: error instanceof Error ? error.message : 'Unknown Braintree error'
      };
    }
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://api.braintreegateway.com/api/v3/transactions/${transactionId}/refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: input.amount ? input.amount.toFixed(2) : undefined,
            reason: input.reason || 'Refund'
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          ok: false,
          gateway: 'braintree',
          status: 'failed',
          amount: input.amount || 0,
          currency: 'usd',
          error: `Braintree refund failed: ${error}`
        };
      }

      const refund = await response.json();

      return {
        ok: true,
        gateway: 'braintree',
        status: refund.status === 'refunded' ? 'succeeded' : 'pending',
        amount: input.amount || 0,
        currency: 'usd',
        transactionId,
        raw: refund
      };
    } catch (error) {
      console.error('Braintree refund error:', error);
      return {
        ok: false,
        gateway: 'braintree',
        status: 'failed',
        amount: input.amount || 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown Braintree error'
      };
    }
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://api.braintreegateway.com/api/v3/transactions/${transactionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Braintree transaction lookup failed: ${response.statusText}`);
      }

      const transaction = await response.json();

      const statusMap: Record<string, 'pending' | 'succeeded' | 'failed'> = {
        'authorized': 'pending',
        'settled': 'succeeded',
        'failed': 'failed',
        'voided': 'failed'
      };

      const status = statusMap[transaction.status] || 'pending';

      return {
        ok: true,
        gateway: 'braintree',
        status,
        amount: transaction.amount,
        currency: 'usd',
        transactionId,
        raw: transaction
      };
    } catch (error) {
      console.error('Braintree transaction lookup error:', error);
      return {
        ok: false,
        gateway: 'braintree',
        status: 'failed',
        amount: 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown Braintree error'
      };
    }
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    try {
      const token = await this.getAccessToken();

      // Get account information
      const response = await fetch(
        'https://api.braintreegateway.com/api/v3/merchant_information',
        {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return { ok: true };
      } else {
        const error = await response.text();
        return {
          ok: false,
          message: `Braintree verification failed: ${error}`
        };
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error verifying Braintree credentials'
      };
    }
  }
}