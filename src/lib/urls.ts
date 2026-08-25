// ─── Centralized URL Helpers ─────────────────────────────────
// Single source of truth for absolute URLs sent in emails, PDFs,
// webhooks, etc. Always reads NEXTAUTH_URL — and in production
// refuses to operate without it (so customer emails never ship
// with a `http://localhost:3000` link).

function readBaseUrl(): string {
  const fromEnv = process.env.NEXTAUTH_URL;
  const isProd = process.env.NODE_ENV === 'production';

  if (!fromEnv) {
    if (isProd) {
      // Critical misconfiguration — better to throw loudly than to
      // silently send customers to a localhost link.
      throw new Error(
        '[urls] NEXTAUTH_URL is not set. Configure it in your environment before generating absolute URLs.'
      );
    }
    // Dev only — explicit fallback so logs make it obvious this is a dev value.
    return 'http://localhost:3000';
  }

  return fromEnv.replace(/\/+$/, ''); // strip trailing slashes
}

let cachedBaseUrl: string | null = null;

/**
 * Get the configured base URL of the app (e.g. https://app.thubpay.com).
 * Throws in production if NEXTAUTH_URL is missing.
 */
export function getBaseUrl(): string {
  if (cachedBaseUrl) return cachedBaseUrl;
  cachedBaseUrl = readBaseUrl();
  return cachedBaseUrl;
}

/**
 * Absolute public checkout URL for an invoice (sent in customer emails,
 * embedded in PDFs, returned from API responses).
 */
export function getPaymentUrl(invoiceId: string): string {
  return `${getBaseUrl()}/pay/${invoiceId}`;
}

/**
 * Absolute public invoice-view URL (sent in customer emails).
 */
export function getInvoiceUrl(invoiceId: string): string {
  return `${getBaseUrl()}/invoice/${invoiceId}`;
}

/**
 * Absolute public receipt-download URL for a transaction.
 */
export function getReceiptUrl(txId: string): string {
  return `${getBaseUrl()}/api/public/receipt/${txId}/pdf`;
}

/**
 * Absolute public credit-note (refund receipt) URL for a transaction.
 */
export function getCreditNoteUrl(txId: string): string {
  return `${getBaseUrl()}/api/public/credit-note/${txId}/pdf`;
}

/**
 * Absolute dashboard URL (used in merchant notifications).
 */
export function getDashboardUrl(path = '/dashboard'): string {
  const base = getBaseUrl();
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${safePath}`;
}
