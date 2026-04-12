import type { GatewaySlug } from '@/src/config/gateways';

export type CurrencyCode = string;

export interface ChargeInput {
  tenantId: string;
  amount: number;
  currency: CurrencyCode;
  gatewayPreference?: GatewaySlug;
  description?: string;
  invoiceId?: string;
  metadata?: Record<string, string>;
}

export interface PaymentResult {
  ok: boolean;
  gateway: GatewaySlug;
  transactionId?: string;
  status: 'pending' | 'succeeded' | 'failed';
  amount: number;
  currency: CurrencyCode;
  error?: string;
  raw?: unknown;
}

export interface RefundInput {
  amount?: number;
  reason?: string;
}
