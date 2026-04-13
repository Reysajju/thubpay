import type { GatewayAdapter } from '@/src/gateways/types';
import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';
import type { GatewaySlug } from '@/src/config/gateways';

export class AuthorizeNetAdapter implements GatewayAdapter {
  slug = 'authorize_net' as GatewaySlug;

  private async getApiCredentials(): Promise<{ apiLoginId: string; transactionKey: string }> {
    const apiLoginId = process.env.AUTHORIZENET_API_LOGIN_ID || '';
    const transactionKey = process.env.AUTHORIZENET_TRANSACTION_KEY || '';

    if (!apiLoginId || !transactionKey) {
      throw new Error('Authorize.Net credentials not configured');
    }

    return { apiLoginId, transactionKey };
  }

  private async generateTransactionKey(apiLoginId: string, transactionKey: string): Promise<string> {
    return Buffer.from(`${apiLoginId}:${transactionKey}`).toString('base64');
  }

  async charge(input: ChargeInput): Promise<PaymentResult> {
    try {
      const { apiLoginId, transactionKey: originalKey } = await this.getApiCredentials();
      const transactionKey = await this.generateTransactionKey(apiLoginId, originalKey);

      const response = await fetch('https://api.authorize.net/xml/v1/request.api', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Authorization': `Basic ${transactionKey}`
        },
        body: this.buildAuthNetXML({
          transactionType: 'auth_capture',
          amount: input.amount.toFixed(2),
          currency: input.currency.toUpperCase(),
          invoiceNumber: `thubpay_${input.tenantId}_${Date.now()}`
        })
      });

      if (!response.ok) {
        return {
          ok: false,
          gateway: 'authorize_net',
          status: 'failed',
          amount: input.amount,
          currency: input.currency,
          error: 'Authorize.Net request failed'
        };
      }

      const xml = await response.text();
      const result = this.parseAuthNetResponse(xml);

      if (result.responseCode === '1') {
        return {
          ok: true,
          gateway: 'authorize_net',
          status: 'succeeded',
          amount: input.amount,
          currency: input.currency,
          transactionId: result.transId,
          raw: result
        };
      } else {
        return {
          ok: false,
          gateway: 'authorize_net',
          status: 'failed',
          amount: input.amount,
          currency: input.currency,
          error: result.reasonText,
          raw: result
        };
      }
    } catch (error) {
      console.error('Authorize.Net charge error:', error);
      return {
        ok: false,
        gateway: 'authorize_net',
        status: 'failed',
        amount: input.amount,
        currency: input.currency,
        error: error instanceof Error ? error.message : 'Unknown Authorize.Net error'
      };
    }
  }

  async refund(transactionId: string, input: RefundInput): Promise<PaymentResult> {
    try {
      const { apiLoginId, transactionKey: originalKey } = await this.getApiCredentials();
      const transactionKey = await this.generateTransactionKey(apiLoginId, originalKey);

      const response = await fetch('https://api.authorize.net/xml/v1/request.api', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Authorization': `Basic ${transactionKey}`
        },
        body: this.buildAuthNetXML({
          transactionType: 'refund',
          amount: input.amount ? input.amount.toFixed(2) : undefined,
          transId: transactionId,
          reason: input.reason || 'Refund'
        })
      });

      if (!response.ok) {
        return {
          ok: false,
          gateway: 'authorize_net',
          status: 'failed',
          amount: input.amount || 0,
          currency: 'usd',
          error: 'Authorize.Net refund failed'
        };
      }

      const xml = await response.text();
      const result = this.parseAuthNetResponse(xml);

      if (result.responseCode === '1') {
        return {
          ok: true,
          gateway: 'authorize_net',
          status: 'succeeded',
          amount: input.amount || 0,
          currency: 'usd',
          transactionId: transactionId,
          raw: result
        };
      } else {
        return {
          ok: false,
          gateway: 'authorize_net',
          status: 'failed',
          amount: input.amount || 0,
          currency: 'usd',
          error: result.reasonText,
          raw: result
        };
      }
    } catch (error) {
      console.error('Authorize.Net refund error:', error);
      return {
        ok: false,
        gateway: 'authorize_net',
        status: 'failed',
        amount: input.amount || 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown Authorize.Net error'
      };
    }
  }

  async getTransaction(transactionId: string): Promise<PaymentResult> {
    try {
      const { apiLoginId, transactionKey: originalKey } = await this.getApiCredentials();
      const transactionKey = await this.generateTransactionKey(apiLoginId, originalKey);

      const response = await fetch('https://api.authorize.net/xml/v1/request.api', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Authorization': `Basic ${transactionKey}`
        },
        body: this.buildAuthNetXML({
          transactionType: 'get_transaction_details',
          transId: transactionId
        })
      });

      if (!response.ok) {
        throw new Error('Authorize.Net transaction lookup failed');
      }

      const xml = await response.text();
      const result = this.parseAuthNetResponse(xml);

      return {
        ok: true,
        gateway: 'authorize_net',
        status: result.responseCode === '1' ? 'succeeded' : 'pending',
        amount: result.amount,
        currency: 'usd',
        transactionId,
        raw: result
      };
    } catch (error) {
      console.error('Authorize.Net transaction lookup error:', error);
      return {
        ok: false,
        gateway: 'authorize_net',
        status: 'failed',
        amount: 0,
        currency: 'usd',
        error: error instanceof Error ? error.message : 'Unknown Authorize.Net error'
      };
    }
  }

  async verifyCredentials(): Promise<{ ok: boolean; message?: string }> {
    try {
      const { apiLoginId, transactionKey } = await this.getApiCredentials();

      const response = await fetch('https://api.authorize.net/xml/v1/request.api', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'Authorization': `Basic ${transactionKey}`
        },
        body: this.buildAuthNetXML({
          transactionType: 'get_transaction_details',
          transId: 'test_' + Date.now()
        })
      });

      if (response.ok) {
        return { ok: true };
      } else {
        return {
          ok: false,
          message: 'Authorize.Net verification failed'
        };
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown error verifying Authorize.Net credentials'
      };
    }
  }

  private buildAuthNetXML(params: {
    transactionType: string;
    amount?: string;
    currency?: string;
    invoiceNumber?: string;
    transId?: string;
    reason?: string;
  }): string {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<merge>
  <transactionRequest>
    <merchantAuthentication>
      <name>${params.transactionType === 'get_transaction_details' ? '' : params.invoiceNumber || ''}</name>
      <transactionKey>${params.transactionType === 'get_transaction_details' ? params.invoiceNumber || '' : ''}</transactionKey>
    </merchantAuthentication>
    <transactionType>${params.transactionType}</transactionType>
    ${params.amount ? `<amount>${params.amount}</amount>` : ''}
    ${params.currency ? `<currency>${params.currency}</currency>` : ''}
    ${params.invoiceNumber ? `<invoiceNumber>${params.invoiceNumber}</invoiceNumber>` : ''}
    ${params.transId ? `<transId>${params.transId}</transId>` : ''}
    ${params.reason ? `<reason>${params.reason}</reason>` : ''}
  </transactionRequest>
</merge>`;
    return xml;
  }

  private parseAuthNetResponse(xml: string): any {
    // Simple XML parser for Authorize.Net responses
    // In production, use a proper XML parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const responseCode = doc.querySelector('responseCode')?.textContent || '0';
    const transId = doc.querySelector('transId')?.textContent || '';
    const reasonText = doc.querySelector('reasonText')?.textContent || '';
    const amount = doc.querySelector('amount')?.textContent || '0';

    return {
      responseCode,
      transId,
      reasonText,
      amount: parseFloat(amount)
    };
  }
}
