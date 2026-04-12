import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

// PayPal SDK types (simplified for TypeScript)
interface PayPalOrder {
  id: string;
  status: 'CREATED' | 'APPROVED' | 'SAVED' | 'VOIDED' | 'CAPTURED';
  payer: {
    name: {
      given_name: string;
      surname: string;
    };
    email_address: string;
  };
  purchase_units?: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
  }>;
}

interface PayPalOrderCapture {
  id: string;
  status: 'COMPLETED' | 'DECLINED' | 'PAYER_ACTION_REQUIRED' | 'CAPTURED' | 'FAILED';
  payer: {
    email_address: string;
  };
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
  }>;
}

interface PayPalWebhookEvent {
  id: string;
  event_type: string;
  event_version: string;
  create_time: string;
  resource_type: string;
  resource: any;
}

export class PaypalAdapter implements GatewayAdapter {
  slug = 'paypal' as GatewaySlug;

  private async getAccessToken(): Promise<string> {
    // OAuth 2.0 token request using client credentials
    const clientId = process.env.PAYPAL_CLIENT_ID || '';
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured');
    }

    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal OAuth failed: ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    try {
      const token = await this.getAccessToken();
      const amountInCents = Math.round(input.amount * 100);

      // Create an order via PayPal Orders API
      const createOrderResponse = await fetch(
        'https://api-m.sandbox.paypal.com/v2/checkout/orders',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              {
                amount: {
                  currency_code: input.currency.toUpperCase(),
                  value: input.amount.toFixed(2)
                },
                description: input.description || 'Payment'
              }
            ],
            application_context: {
              brand_name: 'ThubPay',
              landing_page: 'BILLING',
              user_action: 'PAY_NOW'
            }
          })
        }
      );

      if (!createOrderResponse.ok) {
        const error = await createOrderResponse.text();
        return {
          ok: false,
          gateway: 'paypal',
          status: 'failed',
          amount: input.amount,
          currency: input.currency,
          error: `PayPal order creation failed: ${error}`
        };
      }

      const order: PayPalOrder = await createOrderResponse.json();

      // Return the order ID for frontend checkout redirection
      return {
        ok: true,
        gateway: 'paypal',
        status: 'pending',
        amount: input.amount,
        currency: input.currency,
        transactionId: order.id,
        raw: order
      };
    } catch (error) {
      console.error('PayPal charge error:', error);
      return {
        ok: false,
        gateway: 'paypal',
        status: 'failed',
        amount: input.amount,
        currency: input.currency,
        error: error instanceof Error ? error.message : 'Unknown PayPal error'
      };
    }
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    try {
      const token = await this.getAccessToken();
      const amountInCents = input.amount ? Math.round(input.amount * 100) : null;

      const response = await fetch(
        `https://api-m.sandbox.paypal.com/v2/transactions/${transactionId}/refunds`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: amountInCents
            ? JSON.stringify({
                amount: {
                  currency_code: 'USD',
                  value: amountInCents.toString()
                },
                reason: input.reason || 'Refund'
              })
            : JSON.stringify({ reason: input.reason || 'Refund' })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return {
          ok: false,
          gateway: 'paypal',
          status: 'failed',
          amount: input.amount || 0,
          currency: 'usd',
          error: `PayPal refund failed: ${error}`
        };
      }

      const refund = await response.json();

      return {
        ok: true,
        gateway: 'paypal',
        status: 'succeeded',
        amount: input.amount || 0,
        currency: 'usd',
        transactionId,
        raw: refund
      };
    } catch (error) {
      console.error('PayPal refund error:', error);
      return {
        ok: false,
        gateway: 'paypal',
        status: 'failed',
        amount: input.amount || 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown PayPal error'
      };
    }
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://api-m.sandbox.paypal.com/v2/checkout/orders/${transactionId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`PayPal transaction lookup failed: ${response.statusText}`);
      }

      const order = await response.json();

      // Determine status based on PayPal order state
      const statusMap: Record<string, 'pending' | 'succeeded' | 'failed'> = {
        'CREATED': 'pending',
        'APPROVED': 'pending',
        'SAVED': 'pending',
        'VOIDED': 'failed',
        'CAPTURED': 'succeeded'
      };

      const status = statusMap[order.status] || 'pending';

      return {
        ok: true,
        gateway: 'paypal',
        status,
        amount: order.purchase_units?.[0]?.amount?.value
          ? parseFloat(order.purchase_units[0].amount.value)
          : 0,
        currency: order.purchase_units?.[0]?.amount?.currency_code || 'USD',
        transactionId,
        raw: order
      };
    } catch (error) {
      console.error('PayPal transaction lookup error:', error);
      return {
        ok: false,
        gateway: 'paypal',
        status: 'failed',
        amount: 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown PayPal error'
      };
    }
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    try {
      const token = await this.getAccessToken();

      // Get account information
      const response = await fetch('https://api-m.sandbox.paypal.com/v2/identity/oauth2/userinfo', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { ok: true };
      } else {
        const error = await response.text();
        return {
          ok: false,
          message: `PayPal verification failed: ${error}`
        };
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error verifying PayPal credentials'
      };
    }
  }

  // IPN handler for PayPal Instant Payment Notifications
  async handleWebhook(event: PayPalWebhookEvent): Promise<void> {
    // PayPal webhook signature verification would go here
    // For now, we'll process based on event type

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        console.log('PayPal payment completed:', event.resource);
        // Process payment completion
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        console.log('PayPal payment denied:', event.resource);
        // Process payment denial
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        console.log('PayPal payment refunded:', event.resource);
        // Process refund
        break;

      case 'PAYMENT.CAPTURE.REFUNDED.COMPLETED':
        console.log('PayPal refund completed:', event.resource);
        // Process refund completion
        break;

      default:
        console.log('Unknown PayPal webhook event:', event.event_type);
    }
  }
}