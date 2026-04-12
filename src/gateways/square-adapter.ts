import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

interface SquareTransaction {
  id: string;
  amount_money: {
    amount: number;
    currency: string;
  };
  status: 'COMPLETED' | 'VOIDED' | 'PENDING' | 'CANCELED';
}

interface SquareRefund {
  id: string;
  transaction_id: string;
  amount_money: {
    amount: number;
    currency: string;
  };
  status: 'PENDING' | 'COMPLETED';
}

export class SquareAdapter implements GatewayAdapter {
  slug = 'square' as GatewaySlug;

  private async getAccessToken(): Promise<string> {
    const locationId = process.env.SQUARE_LOCATION_ID || '';
    const accessToken = process.env.SQUARE_ACCESS_TOKEN || '';

    if (!accessToken) {
      throw new Error('Square access token not configured');
    }

    return accessToken;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    try {
      const accessToken = await this.getAccessToken();
      const locationId = process.env.SQUARE_LOCATION_ID || '';
      const amountInCents = Math.round(input.amount * 100);

      // Create a charge using Square Connect API
      const response = await fetch(`https://connect.squareup.com/v2/locations/${locationId}/pay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-01'
        },
        body: JSON.stringify({
          idempotency_key: `thubpay_${input.tenantId}_${Date.now()}`,
          source_id: 'cc_on_file', // In production, this would be a stored card token
          amount_money: {
            amount: amountInCents,
            currency: input.currency.toUpperCase()
          },
          idempotency_key: `charge_${input.tenantId}_${Date.now()}`,
          remember_card: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          ok: false,
          gateway: 'square',
          status: 'failed',
          amount: input.amount,
          currency: input.currency,
          error: `Square charge failed: ${error}`
        };
      }

      const transaction: SquareTransaction = await response.json();

      return {
        ok: true,
        gateway: 'square',
        status: transaction.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: input.amount,
        currency: input.currency,
        transactionId: transaction.id,
        raw: transaction
      };
    } catch (error) {
      console.error('Square charge error:', error);
      return {
        ok: false,
        gateway: 'square',
        status: 'failed',
        amount: input.amount,
        currency: input.currency,
        error: error instanceof Error ? error.message : 'Unknown Square error'
      };
    }
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    try {
      const accessToken = await this.getAccessToken();
      const amountInCents = input.amount ? Math.round(input.amount * 100) : null;

      const response = await fetch(
        `https://connect.squareup.com/v2/transactions/${transactionId}/refunds`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-01'
          },
          body: amountInCents
            ? JSON.stringify({
                idempotency_key: `refund_${Date.now()}`,
                amount_money: {
                  amount: amountInCents,
                  currency: 'USD'
                },
                reason: input.reason || 'Refund'
              })
            : JSON.stringify({
                idempotency_key: `refund_${Date.now()}`,
                reason: input.reason || 'Refund'
              })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          ok: false,
          gateway: 'square',
          status: 'failed',
          amount: input.amount || 0,
          currency: 'usd',
          error: `Square refund failed: ${error}`
        };
      }

      const refund: SquareRefund = await response.json();

      return {
        ok: true,
        gateway: 'square',
        status: refund.status === 'COMPLETED' ? 'succeeded' : 'pending',
        amount: input.amount || 0,
        currency: 'usd',
        transactionId,
        raw: refund
      };
    } catch (error) {
      console.error('Square refund error:', error);
      return {
        ok: false,
        gateway: 'square',
        status: 'failed',
        amount: input.amount || 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown Square error'
      };
    }
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `https://connect.squareup.com/v2/transactions/${transactionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-01'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Square transaction lookup failed: ${response.statusText}`);
      }

      const transaction = await response.json();

      const statusMap: Record<string, 'pending' | 'succeeded' | 'failed'> = {
        'COMPLETED': 'succeeded',
        'VOIDED': 'failed',
        'PENDING': 'pending',
        'CANCELED': 'failed'
      };

      const status = statusMap[transaction.transaction ? 'COMPLETED' : 'PENDING'] || 'pending';

      return {
        ok: true,
        gateway: 'square',
        status,
        amount: transaction.transaction?.total_money?.amount
          ? transaction.transaction.total_money.amount / 100
          : 0,
        currency: transaction.transaction?.total_money?.currency || 'USD',
        transactionId,
        raw: transaction
      };
    } catch (error) {
      console.error('Square transaction lookup error:', error);
      return {
        ok: false,
        gateway: 'square',
        status: 'failed',
        amount: 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown Square error'
      };
    }
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const locationId = process.env.SQUARE_LOCATION_ID || '';

      const response = await fetch(
        `https://connect.squareup.com/v2/locations/${locationId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-01'
          }
        }
      );

      if (response.ok) {
        return { ok: true };
      } else {
        const error = await response.text();
        return {
          ok: false,
          message: `Square verification failed: ${error}`
        };
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error verifying Square credentials'
      };
    }
  }
}