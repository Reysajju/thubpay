'use server';

/**
 * ThubPay — Payment Page Server Actions
 * ─────────────────────────────────────────────────────────────
 * Extracted OUT of the async `PayPage` server component.
 *
 * WHY: defining an inline `'use server'` function inside an async
 * server component (the previous implementation) forces Next.js to
 * serialize the entire closure — including the Prisma `invoice`
 * object with nested `client` / `workspace` relations and `Date`
 * fields — into the client bundle so the action can be re-bound on
 * submit. On Vercel's serverless production runtime this produced:
 *
 *   • HTTP 500 on GET /pay/[uuid]  (closure serialization failed)
 *   • React minified error #441   (server HTML didn't match client)
 *
 * The fix: the action lives in its own `'use server'` module and
 * receives the invoice id through a hidden form field. It re-fetches
 * the invoice from the DB inside the action so the closure stays
 * tiny + serializable (just the uuid string).
 */

import { db } from '@/lib/db';
import { getBaseUrl } from '@/lib/urls';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  transactionId?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

/**
 * Mark an invoice as paid (demo / test-mode checkout).
 *
 * Form fields:
 *   - invoiceId     (required)  the invoice to mark paid
 *   - customerEmail (optional)  payer email — for the receipt
 *   - customerName  (optional)  payer name
 *   - paymentMethod (optional)  stripe | paypal | card | apple_pay | google_pay
 */
export async function markInvoicePaid(formData: FormData): Promise<void> {
  const invoiceId = String(formData.get('invoiceId') ?? '').trim();
  const customerEmail = String(formData.get('customerEmail') ?? '').trim().toLowerCase();
  const customerName = String(formData.get('customerName') ?? '').trim();
  const paymentMethod = String(formData.get('paymentMethod') ?? 'stripe').trim() || 'stripe';

  if (!invoiceId) {
    redirect('/signin');
    return;
  }

  // Validate email if provided.
  if (customerEmail && !isValidEmail(customerEmail)) {
    // bounce back to the checkout with an error flag
    redirect(`/pay/${invoiceId}?error=invalid_email`);
    return;
  }

  // Re-fetch inside the action — never trust a stale closure copy.
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      workspaceId: true,
      clientId: true,
      invoiceNumber: true,
      totalCents: true,
      currency: true,
      status: true,
      paidAt: true,
      workspace: { select: { name: true, logoUrl: true } },
      client: { select: { name: true, email: true } },
    },
  });

  if (!invoice) {
    redirect('/');
    return;
  }

  // Already paid? Idempotent — just revalidate and bounce to success.
  if (invoice.status === 'paid') {
    revalidatePath(`/pay/${invoice.id}`);
    revalidatePath(`/invoice/${invoice.id}`);
    redirect(`/pay/success?invoice=${invoice.id}&method=${paymentMethod}`);
    return;
  }

  if (invoice.status === 'void') {
    redirect(`/pay/${invoice.id}?error=voided`);
    return;
  }

  const now = new Date();
  const gatewaySlug = paymentMethod === 'paypal' ? 'paypal' : 'stripe';

  // Execute database mutations atomically within a single ACID transaction
  const { transaction, webhookEventId } = await db.$transaction(async (prisma) => {
    // 1. Flip invoice status
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'paid',
        paidAt: now,
        paidViaGateway: gatewaySlug,
      },
    });

    // 2. Create the transaction record
    const createdTx = await prisma.transaction.create({
      data: {
        workspaceId: invoice.workspaceId,
        invoiceId: invoice.id,
        amountCents: invoice.totalCents,
        currency: invoice.currency || 'USD',
        status: 'succeeded',
        gatewaySlug,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
      },
      select: { id: true, customerEmail: true, customerName: true },
    });

    // 3. Roll up client spend totals (if a client was attached)
    if (invoice.clientId) {
      await prisma.client.update({
        where: { id: invoice.clientId },
        data: {
          totalSpendCents: { increment: invoice.totalCents },
          transactionCount: { increment: 1 },
        },
      });
    }

    // 4. Drop a notification for the merchant
    await prisma.notification.create({
      data: {
        workspaceId: invoice.workspaceId,
        title: 'Payment received',
        body: `Invoice ${invoice.invoiceNumber || invoice.id.slice(0, 8)} was just paid ($${(
          invoice.totalCents / 100
        ).toFixed(2)}) via ${paymentMethod}.`,
        type: 'payment',
      },
    });

    // 5. Emit an invoice.paid webhook event
    const payload = {
      event: 'invoice.paid',
      timestamp: now.toISOString(),
      data: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoiceNumber,
        workspace_id: invoice.workspaceId,
        amount_cents: invoice.totalCents,
        currency: invoice.currency,
        method: paymentMethod,
        customer_email: customerEmail || null,
        customer_name: customerName || null,
        transaction_id: createdTx.id,
      },
    };

    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        workspaceId: invoice.workspaceId,
        eventType: 'invoice.paid',
        gateway: gatewaySlug,
        status: 'success',
        payload: JSON.stringify(payload),
      },
    });

    // 6. Audit log entry for customer payment
    await prisma.auditLog.create({
      data: {
        workspaceId: invoice.workspaceId,
        userId: null,
        action: 'invoice.paid',
        entity: 'invoice',
        entityId: invoice.id,
        metadata: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          amountCents: invoice.totalCents,
          currency: invoice.currency,
          method: paymentMethod,
          transactionId: createdTx.id,
          customerEmail: customerEmail || null,
          customerName: customerName || null,
          source: 'public_checkout',
        }),
      },
    });

    return { transaction: createdTx, webhookEventId: webhookEvent.id };
  });

  // Fan out webhooks asynchronously outside the database transaction
  import('@/lib/webhook-dispatch')
    .then((m) => m.dispatchWebhookEvent(webhookEventId))
    .catch(() => {
      /* non-fatal */
    });

  // 5b. Email the customer a payment receipt (best-effort, non-blocking).
  // The success page already promises "A receipt has been sent to {email}",
  // so we must actually send one when an email is available. The PDF receipt
  // is generated and attached directly to the email so the customer gets it
  // without needing to click through to the web app.
  const receiptEmail = customerEmail || transaction.customerEmail || invoice.client?.email || '';
  if (receiptEmail) {
    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (invoice.currency || 'USD').toUpperCase(),
    }).format(invoice.totalCents / 100);
    const receiptUrl = `${getBaseUrl()}/pay/receipt/${transaction.id}`;
    const safeInvoiceNo = (invoice.invoiceNumber || invoice.id.slice(0, 8)).replace(/[^a-zA-Z0-9-_]/g, '') || 'receipt';

    // Generate the PDF receipt asynchronously (best-effort — if it fails,
    // we still send the email with just the link).
    Promise.all([
      import('@/lib/email'),
      import('@/lib/receipt-pdf')
        .then((m) =>
          m.generateReceiptPdf({
            transaction: {
              id: transaction.id,
              amountCents: invoice.totalCents,
              currency: invoice.currency || 'USD',
              gatewaySlug: gatewaySlug,
              customerEmail: receiptEmail,
              customerName: customerName || transaction.customerName || invoice.client?.name || null,
              createdAt: now,
            },
            invoice: {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              totalCents: invoice.totalCents,
              currency: invoice.currency || 'USD',
              paidAt: now,
              client: invoice.client,
              workspace: invoice.workspace,
            },
          })
        )
        .then((buf) => ({
          filename: `thubpay-receipt-${safeInvoiceNo}.pdf`,
          content: buf,
        }))
        .catch((err) => {
          console.warn('[pay/actions] PDF generation failed, sending email without attachment:', err);
          return undefined;
        }),
    ])
      .then(([emailMod, pdfAttachment]) =>
        emailMod.sendReceiptEmail({
          to: receiptEmail,
          clientName: customerName || transaction.customerName || invoice.client?.name || undefined,
          invoiceNumber: invoice.invoiceNumber || invoice.id.slice(0, 8),
          amountFormatted,
          transactionId: transaction.id,
          receiptUrl,
          paymentMethod,
          merchantName: invoice.workspace?.name || undefined,
          pdfAttachment: pdfAttachment || undefined,
        })
      )
      .then((res) => {
        if (res.simulated) {
          console.log(`[pay/actions] Receipt email (with PDF) simulated for ${receiptEmail}`);
        } else if (!res.success) {
          console.warn(`[pay/actions] Receipt email failed for ${receiptEmail}:`, res.error);
        } else {
          console.log(`[pay/actions] Receipt email sent to ${receiptEmail}`);
        }
      })
      .catch((err) => console.warn('[pay/actions] Receipt email error:', err));
  }

  // 6. Invalidate every cached view that shows this invoice.
  revalidatePath(`/pay/${invoice.id}`);
  revalidatePath(`/invoice/${invoice.id}`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/finance');
  revalidatePath('/dashboard/customers');

  // 7. Send the customer to the success page.
  const params = new URLSearchParams({
    invoice: invoice.id,
    method: paymentMethod,
    tx: transaction.id,
  });
  if (customerEmail) params.set('email', customerEmail);
  redirect(`/pay/success?${params.toString()}`);
}
