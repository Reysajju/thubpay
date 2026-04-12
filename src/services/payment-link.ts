import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PaymentLinkData {
  id: string;
  invoice_id?: string;
  amount_cents: number;
  currency: string;
  description: string;
  gateway_slug: string;
  max_uses: number;
  current_uses: number;
  expires_at?: string;
  status: string;
  public_url?: string;
  viewed_at?: string;
}

interface CreatePaymentLinkInput {
  workspaceId: string;
  amountCents: number;
  currency?: string;
  description?: string;
  gatewaySlug?: string;
  maxUses?: number;
  expiresAt?: string;
  invoiceId?: string;
}

/**
 * Create a payment link
 */
export async function createPaymentLink(data: CreatePaymentLinkInput): Promise<PaymentLinkData> {
  const gatewaySlug = data.gatewaySlug || 'stripe';

  // Create payment link
  const { data: paymentLink, error } = await admin
    .from('payment_links')
    .insert({
      workspace_id: data.workspaceId,
      invoice_id: data.invoiceId || null,
      amount_cents: data.amountCents,
      currency: data.currency || 'usd',
      description: data.description || '',
      gateway_slug: gatewaySlug,
      max_uses: data.maxUses || 1,
      current_uses: 0,
      status: 'active',
      expires_at: data.expiresAt || null
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payment link: ${error.message}`);
  }

  // Generate public URL
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentLink.id}`;
  paymentLink.public_url = publicUrl;

  return paymentLink as PaymentLinkData;
}

/**
 * Get payment link by ID
 */
export async function getPaymentLink(paymentLinkId: string): Promise<PaymentLinkData> {
  const { data: paymentLink } = await admin
    .from('payment_links')
    .select('*')
    .eq('id', paymentLinkId)
    .single();

  if (!paymentLink) {
    throw new Error('Payment link not found');
  }

  return paymentLink as PaymentLinkData;
}

/**
 * Use payment link (increment usage counter)
 */
export async function usePaymentLink(paymentLinkId: string): Promise<void> {
  const { data: paymentLink } = await admin
    .from('payment_links')
    .select('*')
    .eq('id', paymentLinkId)
    .single();

  if (!paymentLink) {
    throw new Error('Payment link not found');
  }

  // Check if link is still active
  if (paymentLink.status !== 'active') {
    throw new Error('Payment link is not active');
  }

  // Check max uses
  if (paymentLink.max_uses && paymentLink.current_uses >= paymentLink.max_uses) {
    throw new Error('Payment link has reached maximum uses');
  }

  // Check expiration
  if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
    throw new Error('Payment link has expired');
  }

  // Increment usage
  await admin
    .from('payment_links')
    .update({
      current_uses: admin.sql`current_uses + 1`,
      viewed_at: new Date().toISOString()
    })
    .eq('id', paymentLinkId);
}

/**
 * Get payment links for workspace
 */
export async function getPaymentLinksByWorkspace(
  workspaceId: string,
  limit: number = 50
): Promise<PaymentLinkData[]> {
  const { data: paymentLinks } = await admin
    .from('payment_links')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return paymentLinks || [];
}

/**
 * Check if payment link is still valid
 */
export async function isPaymentLinkValid(paymentLinkId: string): Promise<boolean> {
  try {
    const paymentLink = await getPaymentLink(paymentLinkId);

    if (paymentLink.status !== 'active') {
      return false;
    }

    if (paymentLink.max_uses && paymentLink.current_uses >= paymentLink.max_uses) {
      return false;
    }

    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get payment link usage statistics
 */
export async function getPaymentLinkStats(workspaceId: string): Promise<{
  total: number;
  active: number;
  expired: number;
  totalUses: number;
}> {
  const { data: paymentLinks } = await admin
    .from('payment_links')
    .select('*')
    .eq('workspace_id', workspaceId);

  const total = paymentLinks?.length || 0;
  const active = paymentLinks?.filter((p) => p.status === 'active').length || 0;
  const expired = paymentLinks?.filter((p) => p.expires_at && new Date(p.expires_at) < new Date()).length || 0;
  const totalUses = paymentLinks?.reduce((sum, p) => sum + p.current_uses, 0) || 0;

  return { total, active, expired, totalUses };
}

/**
 * Calculate payout due amount for all payment links
 */
export async function calculateTotalPayoutDue(workspaceId: string): Promise<number> {
  const { data: paymentLinks } = await admin
    .from('payment_links')
    .select('amount_cents')
    .eq('workspace_id', workspaceId);

  return paymentLinks?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;
}

/**
 * Get payment link usage history
 */
export async function getPaymentLinkUsageHistory(paymentLinkId: string): Promise<
  Array<{
    timestamp: string;
    ip: string;
    user_agent: string;
  }>
> {
  // In production, this would be stored in a payment_link_clicks table
  // For now, return mock data
  return [];
}

/**
 * Check if payment link is overpaid
 */
export async function checkIfOverpaid(paymentLinkId: string): Promise<boolean> {
  const { data: paymentLink } = await admin
    .from('payment_links')
    .select('*')
    .eq('id', paymentLinkId)
    .single();

  if (!paymentLink || !paymentLink.invoice_id) {
    return false;
  }

  const { data: invoice } = await admin
    .from('invoices')
    .select('amount_cents, balance_due_cents')
    .eq('id', paymentLink.invoice_id)
    .single();

  if (!invoice) {
    return false;
  }

  // Check if paid amount exceeds balance due
  return invoice.balance_due_cents <= 0;
}

/**
 * Create payment link from invoice
 */
export async function createPaymentLinkFromInvoice(
  invoiceId: string,
  workspaceId: string
): Promise<PaymentLinkData> {
  const { data: invoice } = await admin
    .from('invoices')
    .select('*, clients(email)')
    .eq('id', invoiceId)
    .single();

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // Create payment link with invoice amount
  return createPaymentLink({
    workspaceId,
    amountCents: invoice.amount_cents,
    currency: invoice.currency,
    description: invoice.notes || `Payment for ${invoice.invoice_number}`,
    gatewaySlug: invoice.gateway_slug || 'stripe',
    invoiceId
  });
}

/**
 * Update payment link status
 */
export async function updatePaymentLinkStatus(
  paymentLinkId: string,
  status: 'active' | 'expired' | 'revoked'
): Promise<void> {
  const { error } = await admin
    .from('payment_links')
    .update({ status })
    .eq('id', paymentLinkId);

  if (error) {
    throw new Error(`Failed to update payment link status: ${error.message}`);
  }
}

/**
 * Get payment link by public URL
 */
export async function getPaymentLinkByPublicUrl(publicUrl: string): Promise<PaymentLinkData> {
  const parts = publicUrl.split('/');
  const paymentLinkId = parts[parts.length - 1];

  return getPaymentLink(paymentLinkId);
}