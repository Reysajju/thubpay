'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { stripe } from '@/utils/stripe/config';
import { getURL } from '@/utils/helpers';
import { sendInvoiceEmail, sendPaidReceiptEmail } from '@/utils/mailer';

// ── Helpers ──────────────────────────────────────────────────

async function getWorkspaceContext() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await (supabase as any)
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!member?.workspace_id) return null;
  return { supabase, user, workspaceId: member.workspace_id, role: member.role };
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── CREATE BRAND ──────────────────────────────────────────────

export async function createBrand(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const website = String(formData.get('website') ?? '').trim();
  const gradientFrom = String(formData.get('gradient_from') ?? '#7A5A2B').trim();
  const gradientTo = String(formData.get('gradient_to') ?? '#D4B27A').trim();
  const logoUrl = String(formData.get('logo_url') ?? '').trim();

  const baseSlug = slugify(name);
  let publicSlug = baseSlug;
  // Ensure slug uniqueness within workspace
  const { data: existing } = await (ctx.supabase as any)
    .from('brands')
    .select('public_slug')
    .eq('workspace_id', ctx.workspaceId)
    .ilike('public_slug', `${baseSlug}%`);

  if (existing && existing.length > 0) {
    publicSlug = `${baseSlug}-${existing.length}`;
  }

  const { error } = await (ctx.supabase as any).from('brands').insert({
    workspace_id: ctx.workspaceId,
    name,
    website: website || null,
    gradient_from: gradientFrom,
    gradient_to: gradientTo,
    logo_url: logoUrl || null,
    primary_color: gradientFrom,
    public_slug: publicSlug
  });

  if (!error) {
    revalidatePath('/dashboard');
  }
}

// ── CREATE CLIENT ─────────────────────────────────────────────

export async function createPortalClient(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const { error } = await (ctx.supabase as any).from('clients').insert({
    workspace_id: ctx.workspaceId,
    name,
    email: String(formData.get('email') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    company: String(formData.get('company') ?? '').trim() || null,
    address: String(formData.get('address') ?? '').trim() || null,
    services: String(formData.get('services') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null
  });

  if (!error) {
    revalidatePath('/dashboard');
  }
}

// ── CREATE INVOICE ────────────────────────────────────────────

export async function createInvoice(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const clientId = String(formData.get('client_id') ?? '').trim();
  const brandId = String(formData.get('brand_id') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const paymentTerms = String(formData.get('payment_terms') ?? 'Net 30').trim();
  const dueDate = String(formData.get('due_date') ?? '').trim();
  const gatewaySlug = String(formData.get('gateway_slug') ?? '').trim();

  const amount = Number(formData.get('total_usd') ?? 0);
  const taxRatePct = Number(formData.get('tax_rate_pct') ?? 0);

  if (!clientId || !Number.isFinite(amount) || amount <= 0) return;

  const subtotalCents = Math.round(amount * 100);
  const taxCents = Math.round(subtotalCents * (taxRatePct / 100));
  const totalCents = subtotalCents + taxCents;

  // Auto-generate invoice number
  const { count } = await (ctx.supabase as any)
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', ctx.workspaceId);

  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const { data: invoice, error } = await (ctx.supabase as any)
    .from('invoices')
    .insert({
      workspace_id: ctx.workspaceId,
      client_id: clientId,
      brand_id: brandId || null,
      invoice_number: invoiceNumber,
      status: 'draft',
      currency: 'usd',
      description: description || null,
      notes: notes || null,
      payment_terms: paymentTerms,
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      tax_rate_pct: taxRatePct,
      total_cents: totalCents,
      balance_due_cents: totalCents,
      due_date: dueDate || null,
      custom_payment_gateway: gatewaySlug || null
    })
    .select()
    .single();

  if (!error && invoice) {
    revalidatePath('/dashboard');
    redirect(`/invoice/${invoice.id}`);
  }
}

// ── DISPATCH INVOICE (one-time send) ─────────────────────────

export async function dispatchInvoice(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) return;

  const { data: invoice } = await (ctx.supabase as any)
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!invoice) return;
  // Guard: already dispatched
  if (invoice.dispatched_at) return;

  const [{ data: client }, { data: brand }] = await Promise.all([
    (ctx.supabase as any).from('clients').select('*').eq('id', invoice.client_id).maybeSingle(),
    invoice.brand_id
      ? (ctx.supabase as any).from('brands').select('*').eq('id', invoice.brand_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  // Create permanent Stripe checkout session
  let paymentUrl = getURL(`/pay/${invoiceId}`);
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: invoice.currency || 'usd',
            product_data: {
              name: invoice.description
                ? `${brand?.name ?? 'Invoice'} — ${invoice.description}`
                : `Invoice ${invoice.invoice_number}`,
              description: invoice.notes ?? undefined
            },
            unit_amount: invoice.total_cents
          },
          quantity: 1
        }
      ],
      metadata: {
        invoice_id: invoice.id,
        workspace_id: ctx.workspaceId
      },
      customer_email: client?.email ?? undefined,
      success_url: getURL(`/pay/${invoiceId}/success?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: getURL(`/pay/${invoiceId}`)
    });

    // Upsert payment link
    await (ctx.supabase as any).from('payment_links').upsert({
      workspace_id: ctx.workspaceId,
      invoice_id: invoiceId,
      provider: 'stripe',
      external_url: session.url,
      status: 'active'
    });

    paymentUrl = getURL(`/pay/${invoiceId}`);
  } catch (e) {
    console.error('Stripe session creation failed:', e);
  }

  // Send email to client
  if (client?.email) {
    await sendInvoiceEmail({
      to: client.email,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      brandName: brand?.name ?? 'ThubPay',
      description: invoice.description,
      totalCents: invoice.total_cents,
      dueDateStr: invoice.due_date,
      paymentUrl
    });
  }

  // Mark dispatched
  await (ctx.supabase as any)
    .from('invoices')
    .update({ status: 'sent', dispatched_at: new Date().toISOString() })
    .eq('id', invoiceId);

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath('/dashboard');
}

// ── LEGACY createPaymentLink (kept for compatibility) ─────────

export async function createPaymentLink(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const dispatchForm = new FormData();
  dispatchForm.append('invoice_id', invoiceId);
  return dispatchInvoice(dispatchForm);
}

// ── SEND INVOICE (alias) ───────────────────────────────────────

export async function sendInvoice(formData: FormData) {
  return dispatchInvoice(formData);
}

// ── CASH LEDGER ───────────────────────────────────────────────

export async function addLedgerEntry(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const direction = String(formData.get('direction') ?? '').trim();
  const amount = Number(formData.get('amount_usd') ?? 0);
  const note = String(formData.get('note') ?? '').trim();

  if (!['incoming', 'outgoing'].includes(direction)) return;
  if (!Number.isFinite(amount) || amount <= 0) return;

  await (ctx.supabase as any).from('cash_ledger').insert({
    workspace_id: ctx.workspaceId,
    direction,
    amount_cents: Math.round(amount * 100),
    note: note || null
  });

  revalidatePath('/dashboard');
}

// ── WORKSPACE MEMBERS ─────────────────────────────────────────

export async function addWorkspaceMember(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const userId = String(formData.get('user_id') ?? '').trim();
  const role = String(formData.get('role') ?? 'member').trim();
  if (!userId) return;
  if (!['admin', 'member', 'billing'].includes(role)) return;

  await (ctx.supabase as any).from('workspace_members').upsert({
    workspace_id: ctx.workspaceId,
    user_id: userId,
    role
  });

  revalidatePath('/dashboard');
}

// ── WORKSPACE PREFERENCES ─────────────────────────────────────

export async function setMonthlyTarget(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const target = Number(formData.get('target_usd') ?? 0);
  if (target < 0) return;
  const targetCents = Math.round(target * 100);

  const { error } = await (ctx.supabase as any)
    .from('workspaces')
    .update({ monthly_target_cents: targetCents })
    .eq('id', ctx.workspaceId);
  
  if (error) {
    console.error('Migration Required: Ensure you have added the `monthly_target_cents` BIGINT column to the `workspaces` table in Supabase.', error);
  }

  revalidatePath('/dashboard');
}

// ── MANUAL OVERRIDES ──────────────────────────────────────────

export async function markInvoicePaidManually(invoiceId: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { error: 'Unauthorized' };

  const { data: invoice } = await (ctx.supabase as any)
    .from('invoices')
    .select('status, notes')
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .single();

  if (!invoice) return { error: 'Invoice not found' };

  const newNotes = invoice.notes 
    ? `${invoice.notes}\n\n[System]: Marked completed manually` 
    : '[System]: Marked completed manually';

  await (ctx.supabase as any)
    .from('invoices')
    .update({ 
      status: 'paid', 
      paid_via_gateway: 'manual',
      notes: newNotes,
      paid_at: new Date().toISOString()
    })
    .eq('id', invoiceId);
    
  revalidatePath('/dashboard');
  revalidatePath(`/invoice/${invoiceId}`);
  return { success: true };
}
