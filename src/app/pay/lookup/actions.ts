/**
 * Receipt lookup types (shared between the API route and the client).
 *
 * The actual lookup logic lives in the API route
 * `/api/public/lookup` (POST) which applies rate limiting.
 * This file is kept only for the `PublicReceipt` type re-export
 * so the client component can import it without duplicating it.
 */

export interface PublicReceipt {
  transactionId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  method: string;
  merchantName: string;
}
