import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface InvoiceData {
  id: string;
  workspace_id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  notes: string;
  paid_at?: string;
  paid_via_gateway?: string;
  gateway_transaction_id?: string;
  viewed_at?: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_amount_cents: number;
  tax_rate: number;
  discount_percent: number;
  sort_order: number;
}

/**
 * Create a new invoice with line items
 */
export async function createInvoice(data: {
  workspaceId: string;
  clientId: string;
  invoiceNumber: string;
  lineItems: LineItem[];
  amountCents: number;
  currency: string;
  dueDate: string;
  notes?: string;
  paymentTerms?: string;
  discountPercent?: number;
}): Promise<InvoiceData> {
  const { data: invoice, error } = await admin
    .from('invoices')
    .insert({
      workspace_id: data.workspaceId,
      client_id: data.clientId,
      invoice_number: data.invoiceNumber,
      status: 'draft',
      amount_cents: data.amountCents,
      currency: data.currency,
      due_date: data.dueDate,
      notes: data.notes,
      payment_terms: data.paymentTerms,
      discount_percent: data.discountPercent || 0,
      balance_due_cents: data.amountCents
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create invoice: ${error.message}`);
  }

  // Insert line items
  for (const item of data.lineItems) {
    await admin.from('invoice_line_items').insert({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_amount_cents: item.unit_amount_cents,
      tax_rate: item.tax_rate,
      discount_percent: item.discount_percent,
      sort_order: item.sort_order
    });
  }

  return invoice as InvoiceData;
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'void' | 'overdue'
): Promise<void> {
  const updateData: any = {
    status
  };

  if (status === 'sent') {
    updateData.sent_at = new Date().toISOString();
  }
  if (status === 'viewed') {
    updateData.viewed_at = new Date().toISOString();
  }
  if (status === 'paid') {
    updateData.paid_at = new Date().toISOString();
  }

  const { error } = await admin.from('invoices').update(updateData).eq('id', invoiceId);

  if (error) {
    throw new Error(`Failed to update invoice status: ${error.message}`);
  }
}

/**
 * Apply payment to invoice
 */
export async function applyPaymentToInvoice(
  invoiceId: string,
  amountCents: number,
  paymentGateway?: string,
  gatewayTransactionId?: string
): Promise<void> {
  const { data: invoice } = await admin
    .from('invoices')
    .select('amount_cents, balance_due_cents, status, client_id')
    .eq('id', invoiceId)
    .single();

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const remainingBalance = invoice.balance_due_cents - amountCents;
  let newStatus = invoice.status;

  if (remainingBalance <= 0) {
    newStatus = 'paid';
  } else if (invoice.balance_due_cents > amountCents) {
    newStatus = 'partially_paid';
  }

  const updateData: any = {
    balance_due_cents: Math.max(0, remainingBalance)
  };

  if (newStatus !== invoice.status) {
    updateData.status = newStatus;
  }

  if (paymentGateway) {
    updateData.paid_via_gateway = paymentGateway;
  }
  if (gatewayTransactionId) {
    updateData.gateway_transaction_id = gatewayTransactionId;
  }

  const { error } = await admin
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId);

  if (error) {
    throw new Error(`Failed to apply payment: ${error.message}`);
  }

  // Update client total spend
  const { data: client } = await admin
    .from('clients')
    .select('total_spend_cents, transaction_count')
    .eq('id', invoice.client_id)
    .single();

  if (client) {
    await admin
      .from('clients')
      .update({
        total_spend_cents: (client.total_spend_cents || 0) + amountCents,
        transaction_count: (client.transaction_count || 0) + 1,
        last_payment_at: new Date().toISOString()
      })
      .eq('id', invoice.client_id);
  }
}

/**
 * Get invoice by ID with line items
 */
export async function getInvoiceWithLineItems(invoiceId: string) {
  const { data: invoice } = await admin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const { data: lineItems } = await admin
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order');

  return {
    invoice,
    lineItems: lineItems || []
  };
}

/**
 * Get invoices by workspace
 */
export async function getInvoicesByWorkspace(workspaceId: string) {
  const { data: invoices } = await admin
    .from('invoices')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return invoices || [];
}

/**
 * Get invoice PDF data
 */
export async function getInvoicePDFData(invoiceId: string) {
  const { invoice, lineItems } = await getInvoiceWithLineItems(invoiceId);

  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_amount_cents,
    0
  );

  const taxCents = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.unit_amount_cents * item.tax_rate) / 100,
    0
  );

  const discountCents = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.unit_amount_cents * item.discount_percent) / 100,
    0
  );

  const totalCents = subtotalCents + taxCents - discountCents;

  return {
    invoice,
    lineItems,
    subtotalCents,
    taxCents,
    discountCents,
    totalCents
  };
}

/**
 * Update invoice notes
 */
export async function updateInvoiceNotes(invoiceId: string, notes: string): Promise<void> {
  const { error } = await admin
    .from('invoices')
    .update({ notes })
    .eq('id', invoiceId);

  if (error) {
    throw new Error(`Failed to update invoice notes: ${error.message}`);
  }
}

/**
 * Get payment terms
 */
export function getPaymentTerms(terms: string): string {
  const termsMap: Record<string, string> = {
    'due_on_receipt': 'Due on receipt',
    'due_net_7': 'Due in 7 days',
    'due_net_14': 'Due in 14 days',
    'due_net_30': 'Due in 30 days',
    'due_net_45': 'Due in 45 days',
    'due_net_60': 'Due in 60 days'
  };

  return termsMap[terms] || terms;
}

/**
 * Check if invoice is overdue
 */
export function isInvoiceOverdue(dueDate: string, status: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const isPaid = status === 'paid' || status === 'partially_paid';

  return !isPaid && today > due;
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(workspaceId: string) {
  const { data: invoices } = await admin
    .from('invoices')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['sent', 'viewed'])
    .lt('due_date', new Date().toISOString())
    .order('due_date', { ascending: false });

  return invoices || [];
}
