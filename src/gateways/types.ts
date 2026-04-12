import type { ChargeInput, PaymentResult, RefundInput } from '@/src/models/payment';

export interface GatewayAdapter {
  slug: string;
  charge(input: ChargeInput): Promise<PaymentResult>;
  refund(transactionId: string, input: RefundInput): Promise<PaymentResult>;
  getTransaction(transactionId: string): Promise<PaymentResult>;
  verifyCredentials(): Promise<{ ok: boolean; message?: string }>;
}
