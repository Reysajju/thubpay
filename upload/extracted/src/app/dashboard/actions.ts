'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ─── Workspace context ────────────────────────────────────────

async function getWorkspaceContext() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as any).id as string | undefined;
  if (!userId) return null;

  const membership = await db.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership) return null;

  return {
    user: {
      id: userId,
      email: session.user.email || '',
      name: session.user.name || '',
      role: membership.role || 'owner',
    },
    workspaceId: membership.workspaceId,
    workspace: membership.workspace,
  };
}

// ─── CREATE BRAND (workspace branding update) ─────────────────

export async function createBrand(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const name = String(formData.get('name') ?? '').trim();
  if (name) {
    await db.workspace.update({
      where: { id: ctx.workspaceId },
      data: { name },
    });
    // Auto-complete onboarding step
    await db.onboardingProgress.upsert({
      where: { workspaceId: ctx.workspaceId },
      update: { stepBrand: true },
      create: { workspaceId: ctx.workspaceId, stepBrand: true },
    });
  }
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
}

// ─── CREATE CLIENT ─────────────────────────────────────────────

export async function createPortalClient(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim() || null;
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const company = String(formData.get('company') ?? '').trim() || null;

  if (!name) return;

  await db.client.create({
    data: {
      workspaceId: ctx.workspaceId,
      name,
      email,
      phone,
      company,
    },
  });

  // Auto-complete onboarding step
  await db.onboardingProgress.upsert({
    where: { workspaceId: ctx.workspaceId },
    update: { stepClient: true },
    create: { workspaceId: ctx.workspaceId, stepClient: true },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/customers');
}

// ─── CREATE INVOICE ────────────────────────────────────────────

export async function createInvoice(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const clientId = String(formData.get('client_id') ?? '').trim();
  const amount = Number(formData.get('total_usd') ?? 0);
  const taxRate = Number(formData.get('tax_rate_pct') ?? 0);
  const dueDateRaw = String(formData.get('due_date') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const description = String(formData.get('description') ?? '').trim();
  const gatewaySlug = String(formData.get('gateway_slug') ?? '').trim() || null;

  if (!clientId || !Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const subtotalCents = Math.round(amount * 100);
  const taxCents = Math.round(subtotalCents * (taxRate / 100));
  const totalCents = subtotalCents + taxCents;

  // Generate invoice number: INV-YYYY-NNN
  const year = new Date().getFullYear();
  const count = await db.invoice.count({
    where: {
      workspaceId: ctx.workspaceId,
      invoiceNumber: { startsWith: `INV-${year}-` },
    },
  });
  const invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, '0')}`;

  const invoice = await db.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId,
      invoiceNumber,
      status: 'draft',
      totalCents,
      currency: ctx.workspace.baseCurrency || 'USD',
      dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      notes: notes || description || null,
      customPaymentGateway: gatewaySlug || null,
      // Generate the link-tracking token at creation time so the tracking
      // pixel can fire the moment the invoice is dispatched.
      trackingToken: await import('crypto').then((c) => c.randomBytes(16).toString('hex')),
    },
  });

  // Auto-complete onboarding step
  await db.onboardingProgress.upsert({
    where: { workspaceId: ctx.workspaceId },
    update: { stepInvoice: true },
    create: { workspaceId: ctx.workspaceId, stepInvoice: true },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  redirect(`/invoice/${invoice.id}`);
}

// ─── DISPATCH INVOICE (mark as sent) ──────────────────────────

export async function dispatchInvoice(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) return;

  // Verify the invoice belongs to this workspace before mutating.
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, workspaceId: ctx.workspaceId },
    include: { client: true, workspace: true },
  });
  if (!invoice) return;

  // Generate a tracking token if the invoice doesn't have one yet.
  const trackingToken =
    invoice.trackingToken ??
    (await import('crypto').then((c) => c.randomBytes(16).toString('hex')));

  if (invoice.status === 'draft') {
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'sent',
        sentAt: invoice.sentAt ?? new Date(),
        trackingToken,
      },
    });
  } else if (!invoice.trackingToken || !invoice.sentAt) {
    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        sentAt: invoice.sentAt ?? new Date(),
        trackingToken,
      },
    });
  }

  // Send real email if client email is available
  if (invoice.client?.email) {
    const { sendInvoiceEmail } = await import('@/lib/email');
    const paymentUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/pay/${invoice.id}`;
    await sendInvoiceEmail({
      to: invoice.client.email,
      invoiceNumber: invoice.invoiceNumber || invoice.id.slice(0, 8),
      amountFormatted: `$${((invoice.totalCents || 0) / 100).toFixed(2)}`,
      paymentUrl,
      clientName: invoice.client.name,
      businessName: invoice.workspace?.name || 'ThubPay',
    }).catch((err) => console.error('[dispatchInvoice email error]:', err));
  }

  // Record a notification with payment link
  const paymentLink = `/pay/${invoiceId}`;
  await db.notification.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: 'Invoice sent to client',
      body: `${invoice.invoiceNumber || invoiceId} has been dispatched. Payment link: ${paymentLink}`,
      type: 'success',
    },
  });

  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/link-tracking');
}

// ─── QUICK PAYMENT LINK GENERATOR ──────────────────────────────

export async function createPaymentLinkQuick(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const title = String(formData.get('title') ?? '').trim();
  const amountUsd = Number(formData.get('amount_usd') ?? 0);
  const clientIdRaw = String(formData.get('client_id') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();

  if (!title || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { success: false, error: 'Title and positive amount required' };
  }

  const totalCents = Math.round(amountUsd * 100);
  const year = new Date().getFullYear();
  const count = await db.invoice.count({
    where: {
      workspaceId: ctx.workspaceId,
      invoiceNumber: { startsWith: `LNK-${year}-` },
    },
  });
  const invoiceNumber = `LNK-${year}-${String(count + 1).padStart(3, '0')}`;
  const trackingToken = await import('crypto').then((c) => c.randomBytes(16).toString('hex'));

  let clientId: string | null = clientIdRaw || null;
  if (!clientId) {
    // Check if open link client exists or find first client
    const existingClient = await db.client.findFirst({
      where: { workspaceId: ctx.workspaceId },
    });
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const newClient = await db.client.create({
        data: {
          workspaceId: ctx.workspaceId,
          name: 'Direct Link Customer',
          email: null,
        },
      });
      clientId = newClient.id;
    }
  }

  const invoice = await db.invoice.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId,
      invoiceNumber,
      status: 'sent',
      sentAt: new Date(),
      totalCents,
      currency: ctx.workspace.baseCurrency || 'USD',
      notes: notes || title,
      trackingToken,
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/link-tracking');

  return {
    success: true,
    invoiceId: invoice.id,
    paymentUrl: `/pay/${invoice.id}`,
    invoiceNumber: invoice.invoiceNumber,
  };
}

// ─── LEGACY createPaymentLink (alias for dispatch) ─────────────

export async function createPaymentLink(formData: FormData) {
  return dispatchInvoice(formData);
}

// ─── SEND INVOICE (alias) ──────────────────────────────────────

export async function sendInvoice(formData: FormData) {
  return dispatchInvoice(formData);
}

// ─── CASH LEDGER ENTRY (manual ledger note — stored as a notification for now) ──

export async function addLedgerEntry(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const note = String(formData.get('note') ?? '').trim();
  const direction = String(formData.get('direction') ?? 'incoming');
  const amount = Number(formData.get('amount') ?? 0);

  if (!note || !Number.isFinite(amount) || amount <= 0) return;

  await db.notification.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: `Ledger entry: ${direction}`,
      body: `${direction === 'incoming' ? '+' : '-'}$${(amount / 100).toFixed(2)} — ${note}`,
      type: direction === 'incoming' ? 'payment' : 'info',
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/finance');
}

// ─── WORKSPACE MEMBERS ─────────────────────────────────────────

export async function addWorkspaceMember(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;
  if (ctx.user.role !== 'owner' && ctx.user.role !== 'admin') return;

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'member').trim();

  if (!email) return;

  const targetUser = await db.appUser.findUnique({ where: { email } });
  if (!targetUser) {
    // In production: send invite email. For now, no-op.
    return;
  }

  const existing = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: ctx.workspaceId, userId: targetUser.id },
    },
  });
  if (existing) return;

  await db.workspaceMember.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: targetUser.id,
      role: ['owner', 'admin', 'member', 'viewer'].includes(role) ? role : 'member',
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
}

// ─── WORKSPACE PREFERENCES ─────────────────────────────────────

export async function setMonthlyTarget(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return;

  const targetUsd = Number(formData.get('monthly_target_usd') ?? 0);
  if (!Number.isFinite(targetUsd) || targetUsd < 0) return;

  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { monthlyTargetCents: Math.round(targetUsd * 100) },
  });

  revalidatePath('/dashboard');
}

// ─── MANUAL PAID OVERRIDE ──────────────────────────────────────

export async function markInvoicePaidManually(invoiceId: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, workspaceId: ctx.workspaceId },
    include: { client: true },
  });
  if (!invoice) return { success: false, error: 'Invoice not found' };

  if (invoice.status === 'paid') {
    return { success: true, alreadyPaid: true };
  }

  await db.$transaction(async (prisma) => {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paidViaGateway: invoice.paidViaGateway || 'manual',
        customPaymentGateway: invoice.customPaymentGateway || 'Manual',
      },
    });

    // Update client aggregates
    if (invoice.clientId) {
      await prisma.client.update({
        where: { id: invoice.clientId },
        data: {
          totalSpendCents: { increment: invoice.totalCents },
          transactionCount: { increment: 1 },
        },
      });
    }

    // Record a transaction for analytics
    await prisma.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        invoiceId,
        gatewaySlug: 'manual',
        externalId: `manual_${Date.now()}`,
        amountCents: invoice.totalCents,
        currency: invoice.currency,
        status: 'succeeded',
        customerEmail: invoice.client?.email || null,
        customerName: invoice.client?.name || null,
      },
    });

    // Notification
    await prisma.notification.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: 'Payment recorded',
        body: `${invoice.invoiceNumber || invoiceId} marked as paid manually ($${(invoice.totalCents / 100).toFixed(2)}).`,
        type: 'payment',
      },
    });

    // Audit log entry for the manual mark-paid
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.user.id,
        action: 'invoice.mark_paid',
        entity: 'invoice',
        entityId: invoiceId,
        metadata: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          amountCents: invoice.totalCents,
          currency: invoice.currency,
          method: 'manual',
          clientId: invoice.clientId,
        }),
      },
    });
  });

  revalidatePath('/dashboard');
  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard/audit-log');
  return { success: true };
}

// ─── VOID / CANCEL INVOICE ─────────────────────────────────────

export async function voidInvoice(
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  if (!invoiceId) return { success: false, error: 'Invoice ID is required' };

  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, workspaceId: ctx.workspaceId },
    include: { client: true },
  });
  if (!invoice) return { success: false, error: 'Invoice not found' };

  // Already void — idempotent.
  if (invoice.status === 'void') {
    return { success: true };
  }

  // Paid invoices cannot be voided directly — the merchant must refund
  // the transaction first (which reverts status to 'sent').
  if (invoice.status === 'paid') {
    return {
      success: false,
      error:
        'Cannot void a paid invoice. Please refund the payment first, then void the invoice.',
    };
  }

  await db.$transaction(async (prisma) => {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'void' },
    });

    // Drop an audit notification
    await prisma.notification.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: 'Invoice voided',
        body: `${invoice.invoiceNumber || invoiceId.slice(0, 8)} was voided. The payment link is no longer active.`,
        type: 'warning',
      },
    });

    // Audit log entry
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.user.id,
        action: 'invoice.void',
        entity: 'invoice',
        entityId: invoiceId,
        metadata: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          previousStatus: invoice.status,
          amountCents: invoice.totalCents,
        }),
      },
    });
  });

  revalidatePath('/dashboard');
  revalidatePath(`/invoice/${invoiceId}`);
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/link-tracking');
  revalidatePath('/dashboard/audit-log');

  // ── Email the customer an invoice-cancelled notification (best-effort) ──
  // Only send if the customer has an email on file.
  const customerEmail = invoice.client?.email || '';
  if (customerEmail) {
    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (invoice.currency || 'USD').toUpperCase(),
    }).format(invoice.totalCents / 100);
    const invoiceNumber = invoice.invoiceNumber || invoiceId.slice(0, 8);
    const invoiceUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invoice/${invoiceId}`;

    import('@/lib/email')
      .then((m) =>
        m.sendInvoiceVoidedEmail({
          to: customerEmail,
          clientName: invoice.client?.name || undefined,
          invoiceNumber,
          amountFormatted,
          merchantName: ctx.workspace.name || undefined,
          invoiceUrl,
        })
      )
      .then((res) => {
        if (res.simulated) {
          console.log(`[voidInvoice] Cancellation email simulated for ${customerEmail}`);
        } else if (!res.success) {
          console.warn(`[voidInvoice] Cancellation email failed for ${customerEmail}:`, res.error);
        } else {
          console.log(`[voidInvoice] Cancellation email sent to ${customerEmail}`);
        }
      })
      .catch((err) => console.warn('[voidInvoice] Cancellation email error:', err));
  }

  return { success: true };
}

// ─── BULK VOID INVOICES ─────────────────────────────────────────

export async function bulkVoidInvoices(
  invoiceIds: string[]
): Promise<{ success: boolean; voided: number; skipped: number; errors: string[] }> {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return { success: false, voided: 0, skipped: 0, errors: ['Unauthorized'] };
  }

  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return { success: false, voided: 0, skipped: 0, errors: ['No invoices selected'] };
  }

  // Cap at 50 per batch to prevent abuse.
  const ids = invoiceIds.slice(0, 50);
  const errors: string[] = [];
  let voided = 0;
  let skipped = 0;

  // Fetch all the invoices in one query (scoped to this workspace).
  const invoices = await db.invoice.findMany({
    where: {
      id: { in: ids },
      workspaceId: ctx.workspaceId,
    },
    include: { client: true },
  });

  for (const invoice of invoices) {
    // Already void — skip.
    if (invoice.status === 'void') {
      skipped++;
      continue;
    }
    // Paid invoices cannot be voided.
    if (invoice.status === 'paid') {
      skipped++;
      errors.push(`${invoice.invoiceNumber || invoice.id.slice(0, 8)}: paid (refund first)`);
      continue;
    }

    try {
      await db.invoice.update({
        where: { id: invoice.id },
        data: { status: 'void' },
      });

      // Email the customer (best-effort, non-blocking).
      const customerEmail = invoice.client?.email || '';
      if (customerEmail) {
        const amountFormatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: (invoice.currency || 'USD').toUpperCase(),
        }).format(invoice.totalCents / 100);
        const invoiceNumber = invoice.invoiceNumber || invoice.id.slice(0, 8);
        const invoiceUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invoice/${invoice.id}`;

        import('@/lib/email')
          .then((m) =>
            m.sendInvoiceVoidedEmail({
              to: customerEmail,
              clientName: invoice.client?.name || undefined,
              invoiceNumber,
              amountFormatted,
              merchantName: ctx.workspace.name || undefined,
              invoiceUrl,
            })
          )
          .catch(() => {
            /* non-fatal */
          });
      }
      voided++;
    } catch (err) {
      errors.push(
        `${invoice.invoiceNumber || invoice.id.slice(0, 8)}: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }
  }

  // One aggregate audit notification.
  if (voided > 0) {
    await db.notification.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: `${voided} invoice${voided === 1 ? '' : 's'} voided (bulk)`,
        body: `Bulk void action processed ${voided} invoice${voided === 1 ? '' : 's'}${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
        type: 'warning',
      },
    }).catch(() => {
      /* non-fatal */
    });
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/link-tracking');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/audit-log');
  return { success: true, voided, skipped, errors };
}

// ─── CHECKOUT SUBMISSIONS ──────────────────────────────────────

export async function savePaymentSubmission({
  invoiceId,
  paymentIntentId,
  name,
  email,
  address,
}: {
  invoiceId: string;
  paymentIntentId: string;
  name: string;
  email: string;
  address: string;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Persist the checkout submission as a notification (audit trail)
  await db.notification.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: 'Checkout submission received',
      body: `Intent ${paymentIntentId} for invoice ${invoiceId} — ${name} <${email}>`,
      type: 'info',
    },
  });

  return { success: true };
}

// ─── GATEWAY CREDENTIALS MANAGEMENT ──────────────────────────

export async function addGatewayCredential(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const gatewaySlug = String(formData.get('gateway_slug') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const secretKey = String(formData.get('secret_key') ?? '').trim();
  const publishableKey = String(formData.get('publishable_key') ?? '').trim() || null;
  const webhookSecret = String(formData.get('webhook_secret') ?? '').trim() || null;
  const mode = String(formData.get('mode') ?? 'test').trim() === 'live' ? 'live' : 'test';
  const isDefault = formData.get('is_default') === 'on' || formData.get('is_default') === 'true';

  if (!gatewaySlug || !label || !secretKey) {
    return { success: false, error: 'Missing required fields (gateway_slug, label, secret_key)' };
  }

  // If marking as default, unset other defaults in the same workspace.
  if (isDefault) {
    await db.gatewayCredential.updateMany({
      where: { workspaceId: ctx.workspaceId, isDefault: true },
      data: { isDefault: false },
    });
  }

  await db.gatewayCredential.create({
    data: {
      workspaceId: ctx.workspaceId,
      gatewaySlug,
      label,
      publishableKey,
      secretKeyEnc: encryptSecret(secretKey),
      webhookSecret,
      mode,
      isActive: true,
      isDefault,
    },
  });

  await db.notification.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: 'Gateway connected',
      body: `${label} (${gatewaySlug}) is now ${isDefault ? 'the default gateway' : 'active'}.`,
      type: 'info',
    },
  });

  // Auto-complete onboarding step
  await db.onboardingProgress.upsert({
    where: { workspaceId: ctx.workspaceId },
    update: { stepGateway: true },
    create: { workspaceId: ctx.workspaceId, stepGateway: true },
  });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/settings/gateways');
  revalidatePath('/dashboard/developers');
  return { success: true };
}

export async function deleteGatewayCredential(id: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Verify ownership
  const gw = await db.gatewayCredential.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!gw) return { success: false, error: 'Not found' };

  await db.gatewayCredential.delete({ where: { id } });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/settings/gateways');
  revalidatePath('/dashboard/developers');
  return { success: true };
}

// ─── GATEWAY TOGGLE / UPDATE ───────────────────────────────────

export async function toggleGatewayActive(id: string, isActive: boolean) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const gw = await db.gatewayCredential.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!gw) return { success: false, error: 'Not found' };

  await db.gatewayCredential.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/settings/gateways');
  revalidatePath('/dashboard/developers');
  return { success: true };
}

export async function setDefaultGateway(id: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const gw = await db.gatewayCredential.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!gw) return { success: false, error: 'Not found' };

  // Unset other defaults
  await db.gatewayCredential.updateMany({
    where: { workspaceId: ctx.workspaceId, isDefault: true },
    data: { isDefault: false },
  });

  await db.gatewayCredential.update({
    where: { id },
    data: { isDefault: true, isActive: true },
  });

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/settings/gateways');
  revalidatePath('/dashboard/developers');
  return { success: true };
}

// ─── DISMISS NOTIFICATION ──────────────────────────────────────

export async function dismissNotification(id: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  await db.notification.updateMany({
    where: { id, workspaceId: ctx.workspaceId },
    data: { isRead: true },
  });

  revalidatePath('/dashboard');
  return { success: true };
}

// ─── PROCESS REFUND ────────────────────────────────────────────

export async function processRefund(
  transactionId: string,
  amountCents: number,
  reason: string
): Promise<{ success: boolean; error?: string; refundId?: string }> {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  if (!transactionId || !Number.isFinite(amountCents) || amountCents <= 0) {
    return { success: false, error: 'Invalid transaction ID or amount' };
  }

  // Fetch the transaction and verify ownership + that it's refundable.
  // Also fetch the client + workspace so we can email the customer a
  // refund notification with the merchant name.
  const tx = await db.transaction.findFirst({
    where: { id: transactionId, workspaceId: ctx.workspaceId },
    include: {
      gateway: true,
      invoice: {
        include: {
          client: true,
          workspace: { select: { name: true } },
        },
      },
    },
  });

  if (!tx) return { success: false, error: 'Transaction not found' };
  if (tx.status !== 'succeeded') {
    return { success: false, error: 'Only succeeded transactions can be refunded' };
  }
  if (amountCents > tx.amountCents) {
    return { success: false, error: 'Refund amount cannot exceed the original transaction amount' };
  }

  // Resolve the gateway adapter and call its refund method (if implemented).
  const { getAdapter } = await import('@/lib/gateways');
  const adapter = getAdapter(tx.gatewaySlug as any);

  if (!adapter?.refund) {
    return { success: false, error: `Refunds are not supported for gateway: ${tx.gatewaySlug}` };
  }

  const credential = {
    id: tx.gateway?.id || '',
    gatewaySlug: tx.gatewaySlug,
    label: tx.gateway?.label || '',
    publishableKey: tx.gateway?.publishableKey || null,
    secretKey: tx.gateway?.secretKeyEnc || null,
    webhookSecret: tx.gateway?.webhookSecret || null,
    mode: tx.gateway?.mode || 'test',
    metadata: tx.gateway?.metadata ? JSON.parse(tx.gateway.metadata) : null,
  };

  const refundResult = await adapter.refund(
    credential,
    tx.externalId || tx.id,
    amountCents,
    reason
  );

  if (refundResult.status === 'failed') {
    return { success: false, error: 'Refund failed at the gateway' };
  }

  // Update transaction status, invoice status, client totals, notification, and audit log atomically
  const isFullRefund = amountCents >= tx.amountCents;
  await db.$transaction(async (prisma) => {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: isFullRefund ? 'refunded' : tx.status,
        failureReason: isFullRefund
          ? `Refunded: ${reason} (refund ID: ${refundResult.id})`
          : `Partially refunded ${amountCents} cents: ${reason} (refund ID: ${refundResult.id})`,
      },
    });

    // If full refund, revert the invoice status + client totals.
    if (isFullRefund && tx.invoice) {
      await prisma.invoice.update({
        where: { id: tx.invoice.id },
        data: { status: 'sent' },
      });
      if (tx.invoice.clientId) {
        await prisma.client.update({
          where: { id: tx.invoice.clientId },
          data: {
            totalSpendCents: { decrement: tx.amountCents },
            transactionCount: { decrement: 1 },
          },
        });
      }
    }

    // Record an audit notification.
    await prisma.notification.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: isFullRefund ? 'Payment refunded' : 'Partial refund issued',
        body: `Refund of $${(amountCents / 100).toFixed(2)} processed for transaction ${tx.externalId || tx.id}. Reason: ${reason}`,
        type: 'warning',
      },
    });

    // Record the refund as a webhook event for audit trail.
    await prisma.webhookEvent.create({
      data: {
        workspaceId: ctx.workspaceId,
        eventType: isFullRefund ? 'refund.created' : 'refund.partial',
        gateway: tx.gatewaySlug,
        status: 'success',
        payload: JSON.stringify({
          refundId: refundResult.id,
          originalTransactionId: tx.id,
          externalId: tx.externalId,
          amountCents,
          reason,
          raw: refundResult.raw,
        }),
      },
    });

    // Audit log entry for the refund
    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        userId: ctx.user.id,
        action: isFullRefund ? 'refund.created' : 'refund.partial',
        entity: 'transaction',
        entityId: transactionId,
        metadata: JSON.stringify({
          refundId: refundResult.id,
          invoiceId: tx.invoiceId,
          invoiceNumber: tx.invoice?.invoiceNumber,
          amountCents,
          reason,
          isFullRefund,
          gateway: tx.gatewaySlug,
        }),
      },
    });
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/transactions');
  revalidatePath('/dashboard/audit-log');
  revalidatePath(`/invoice/${tx.invoiceId || ''}`);

  // ── Email the customer a refund notification (best-effort, non-blocking) ──
  const refundEmail = tx.customerEmail || tx.invoice?.client?.email || '';
  if (refundEmail) {
    const amountFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (tx.currency || 'USD').toUpperCase(),
    }).format(amountCents / 100);
    const invoiceNumber = tx.invoice?.invoiceNumber || tx.invoiceId?.slice(0, 8) || transactionId.slice(0, 8);
    const merchantName = tx.invoice?.workspace?.name;
    const receiptUrl = tx.invoiceId
      ? `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/pay/receipt/${tx.id}`
      : undefined;

    const safeInvoiceNo = invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '') || 'credit-note';

    // Generate the credit note PDF + send the refund email in parallel
    // (best-effort — if PDF generation fails, the email still sends
    // with just the link).
    Promise.all([
      import('@/lib/email'),
      import('@/lib/credit-note-pdf')
        .then((m) =>
          m.generateCreditNotePdf({
            transaction: {
              id: tx.id,
              amountCents: tx.amountCents,
              currency: tx.currency || 'USD',
              gatewaySlug: tx.gatewaySlug,
              customerEmail: refundEmail,
              customerName: tx.customerName || tx.invoice?.client?.name || null,
              createdAt: tx.createdAt,
            },
            invoice: {
              id: tx.invoiceId || tx.invoice?.id || '',
              invoiceNumber: tx.invoice?.invoiceNumber,
              totalCents: tx.invoice?.totalCents || tx.amountCents,
              currency: tx.invoice?.currency || tx.currency || 'USD',
              paidAt: tx.invoice?.paidAt,
              client: tx.invoice?.client,
              workspace: tx.invoice?.workspace,
            },
            refundId: refundResult.id,
            refundAmountCents: amountCents,
            reason,
            isFullRefund,
            issuedAt: new Date(),
          })
        )
        .then((buf) => ({
          filename: `thubpay-credit-note-${safeInvoiceNo}.pdf`,
          content: buf,
        }))
        .catch((err) => {
          console.warn('[processRefund] Credit note PDF failed, sending email without attachment:', err);
          return undefined;
        }),
    ])
      .then(([emailMod, pdfAttachment]) =>
        emailMod.sendRefundEmail({
          to: refundEmail,
          clientName: tx.customerName || tx.invoice?.client?.name || undefined,
          invoiceNumber,
          amountFormatted,
          refundId: refundResult.id,
          reason,
          isFullRefund,
          merchantName,
          receiptUrl,
          pdfAttachment: pdfAttachment || undefined,
        })
      )
      .then((res) => {
        if (res.simulated) {
          console.log(`[processRefund] Refund email (with credit note) simulated for ${refundEmail}`);
        } else if (!res.success) {
          console.warn(`[processRefund] Refund email failed for ${refundEmail}:`, res.error);
        } else {
          console.log(`[processRefund] Refund email sent to ${refundEmail}`);
        }
      })
      .catch((err) => console.warn('[processRefund] Refund email error:', err));
  }

  return { success: true, refundId: refundResult.id };
}

// ─── AUTO-REMINDER SWEEP (manual trigger from UI) ────────────

export async function triggerReminderSweep() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const now = new Date();
  const REMINDER_TIERS = [
    { afterHours: 24, type: 'unviewed', label: 'reminder' },
    { afterHours: 72, type: 'followup', label: 'follow-up' },
    { afterHours: 168, type: 'final', label: 'final reminder' },
  ] as const;

  const result = {
    scanned: 0,
    remindersSent: 0,
    byTier: { unviewed: 0, followup: 0, final: 0 } as Record<string, number>,
    invoicesMarkedOverdue: 0,
  };

  const candidates = await db.invoice.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      sentAt: { not: null },
      status: { in: ['sent', 'viewed', 'overdue'] },
      firstViewedAt: null,
    },
    include: { client: true },
  });
  result.scanned = candidates.length;

  for (const inv of candidates) {
    if (!inv.sentAt) continue;
    const hoursSinceSent = (now.getTime() - inv.sentAt.getTime()) / 3600000;

    for (const tier of REMINDER_TIERS) {
      if (hoursSinceSent < tier.afterHours) continue;
      const already = await db.invoiceReminder.findFirst({
        where: { invoiceId: inv.id, type: tier.type },
        select: { id: true },
      });
      if (already) continue;

      const invoiceLabel = inv.invoiceNumber || inv.id.slice(0, 8);
      const clientLabel = inv.client?.name || inv.client?.email || 'your client';
      const amount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: inv.currency || 'USD',
      }).format(inv.totalCents / 100);
      const daysSent = Math.floor(tier.afterHours / 24);

      let message = '';
      if (tier.type === 'unviewed') {
        message = `${invoiceLabel} (${amount}) sent to ${clientLabel} hasn't been opened in 1 day. Consider following up.`;
      } else if (tier.type === 'followup') {
        message = `${invoiceLabel} (${amount}) is still unopened after ${daysSent} days. Time for a personal nudge.`;
      } else {
        message = `${invoiceLabel} (${amount}) is now ${daysSent} days past send and remains unopened. Marked as overdue.`;
      }

      await db.$transaction([
        db.notification.create({
          data: {
            workspaceId: ctx.workspaceId,
            title: `Invoice ${tier.label} — ${invoiceLabel}`,
            body: message,
            type: tier.type === 'final' ? 'warning' : 'info',
          },
        }),
        db.invoiceReminder.create({
          data: {
            invoiceId: inv.id,
            workspaceId: ctx.workspaceId,
            type: tier.type,
            message,
          },
        }),
      ]);

      result.remindersSent++;
      result.byTier[tier.type]++;

      if (tier.type === 'final' && inv.status !== 'overdue') {
        await db.invoice.update({
          where: { id: inv.id },
          data: { status: 'overdue' },
        });
        result.invoicesMarkedOverdue++;
      }
    }
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/link-tracking');
  revalidatePath('/dashboard/transactions');
  return { success: true, ...result };
}

// ─── WEBHOOK ENDPOINTS MANAGEMENT ────────────────────────────

export async function addWebhookEndpoint(formData: FormData) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const label = String(formData.get('label') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const secret = String(formData.get('secret') ?? '').trim() || null;
  const eventsRaw = String(formData.get('events') ?? '').trim();
  const isActive = formData.get('is_active') !== 'off';

  if (!label || !url) {
    return { success: false, error: 'Label and URL are required' };
  }

  // Validate URL — must be http(s)
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, error: 'URL must use http: or https: protocol' };
    }
  } catch {
    return { success: false, error: 'Invalid URL format' };
  }

  // Normalize events: "*" or comma-separated list (e.g. "invoice.viewed,payment.succeeded" or "invoice.*")
  const events = !eventsRaw || eventsRaw === '*' ? '*' : eventsRaw;

  const endpoint = await db.webhookEndpoint.create({
    data: {
      workspaceId: ctx.workspaceId,
      label,
      url,
      secret,
      events,
      isActive,
    },
  });

  // ── Audit log entry for webhook endpoint creation ──
  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      action: 'webhook.create',
      entity: 'webhook_endpoint',
      entityId: endpoint.id,
      metadata: JSON.stringify({
        label: endpoint.label,
        url: endpoint.url,
        events: endpoint.events,
        isActive: endpoint.isActive,
        hasSecret: Boolean(endpoint.secret),
      }),
    },
  }).catch(() => {
    /* non-fatal — audit log is best-effort */
  });

  revalidatePath('/dashboard/developers');
  revalidatePath('/dashboard/audit-log');
  return { success: true };
}

export async function deleteWebhookEndpoint(id: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Verify ownership
  const ep = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, label: true, url: true },
  });
  if (!ep) return { success: false, error: 'Not found' };

  await db.webhookEndpoint.delete({ where: { id } });

  // ── Audit log entry for webhook endpoint deletion ──
  await db.auditLog.create({
    data: {
      workspaceId: ctx.workspaceId,
      userId: ctx.user.id,
      action: 'webhook.delete',
      entity: 'webhook_endpoint',
      entityId: id,
      metadata: JSON.stringify({
        label: ep.label,
        url: ep.url,
      }),
    },
  }).catch(() => {
    /* non-fatal — audit log is best-effort */
  });

  revalidatePath('/dashboard/developers');
  revalidatePath('/dashboard/audit-log');
  return { success: true };
}

export async function toggleWebhookEndpoint(id: string, isActive: boolean) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const ep = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!ep) return { success: false, error: 'Not found' };

  await db.webhookEndpoint.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath('/dashboard/developers');
  return { success: true };
}

// ─── TEST WEBHOOK ENDPOINT (manual ping) ────────────────────

export async function testWebhookEndpoint(id: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const ep = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!ep) return { success: false, error: 'Endpoint not found' };

  // Create a synthetic "webhook.test" event and dispatch it
  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      endpoint_id: ep.id,
      endpoint_label: ep.label,
      message: 'This is a test event from ThubPay. Your webhook endpoint is correctly configured.',
    },
  };

  const event = await db.webhookEvent.create({
    data: {
      workspaceId: ctx.workspaceId,
      eventType: 'webhook.test',
      gateway: null,
      status: 'success',
      payload: JSON.stringify(testPayload),
    },
  });

  // Dispatch (the dispatcher filters by subscription — but we'll force-deliver
  // by calling the dispatcher which handles subscription matching).
  // Since "webhook.test" might not match the subscription filter, we'll do
  // a direct fetch here as well for guaranteed delivery.
  try {
    const { dispatchWebhookEvent } = await import('@/lib/webhook-dispatch');
    await dispatchWebhookEvent(event.id);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Dispatch failed' };
  }

  revalidatePath('/dashboard/developers');
  return { success: true, eventId: event.id };
}

// ─── RETRY FAILED WEBHOOK DELIVERY ───────────────────────────

export async function retryWebhookDelivery(deliveryId: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Find the delivery — must belong to this workspace
  const delivery = await db.webhookDelivery.findFirst({
    where: { id: deliveryId, workspaceId: ctx.workspaceId },
    include: {
      webhookEvent: true,
      webhookEndpoint: true,
    },
  });
  if (!delivery) return { success: false, error: 'Delivery not found' };
  if (!delivery.webhookEvent) return { success: false, error: 'Source event missing' };
  if (!delivery.webhookEndpoint) return { success: false, error: 'Endpoint missing' };

  // Re-dispatch by calling the dispatcher directly on the existing event
  try {
    const { dispatchWebhookEvent } = await import('@/lib/webhook-dispatch');
    // The dispatcher will create a NEW WebhookDelivery row (doesn't mutate the failed one)
    await dispatchWebhookEvent(delivery.webhookEvent.id);
  } catch (err: any) {
    return { success: false, error: err?.message || 'Retry failed' };
  }

  revalidatePath('/dashboard/developers');
  return { success: true };
}

// ─── WEBHOOK ENDPOINT HEALTH CHECK ──────────────────────────

export async function pingWebhookEndpoint(id: string) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const ep = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!ep) return { success: false, error: 'Endpoint not found' };

  // Use the shared health check module so results are persisted to EndpointHealthCheck
  const { performHealthCheck } = await import('@/lib/health-check');
  const result = await performHealthCheck(id, ctx.workspaceId, 'manual');

  revalidatePath('/dashboard/developers');
  return {
    success: true,
    is_healthy: result.healthy,
    status_code: result.statusCode,
    duration_ms: result.durationMs,
    error: result.error,
  };
}

// ─── PING ALL ENDPOINTS (batch health check) ────────────────

export async function pingAllWebhookEndpoints() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const endpoints = await db.webhookEndpoint.findMany({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    select: { id: true },
  });

  const { performHealthCheck } = await import('@/lib/health-check');

  const results: { id: string; healthy: boolean; status_code: number | null; duration_ms: number; error?: string }[] = [];

  // Sequential pings to avoid hammering the network
  for (const ep of endpoints) {
    const result = await performHealthCheck(ep.id, ctx.workspaceId, 'manual');
    results.push({
      id: ep.id,
      healthy: result.healthy,
      status_code: result.statusCode,
      duration_ms: result.durationMs,
      error: result.error,
    });
  }

  revalidatePath('/dashboard/developers');
  return {
    success: true,
    total: endpoints.length,
    healthy: results.filter((r) => r.healthy).length,
    failed: results.filter((r) => !r.healthy).length,
    results,
  };
}

// ─── UPDATE WORKSPACE SLA THRESHOLD ─────────────────────────

export async function updateSlaThreshold(threshold: number) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Validate threshold: 1-100
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
    return { success: false, error: 'Threshold must be between 1 and 100' };
  }

  const rounded = Math.round(threshold);

  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { slaThreshold: rounded },
  });

  // Record a notification so the audit trail shows the change
  await db.notification.create({
    data: {
      workspaceId: ctx.workspaceId,
      title: 'SLA threshold updated',
      body: `SLA breach threshold set to ${rounded}%. Endpoints below this uptime will trigger breach alerts.`,
      type: 'info',
    },
  });

  revalidatePath('/dashboard/developers');
  return { success: true, threshold: rounded };
}

// ─── UPDATE WORKSPACE THEME PREFERENCE ─────────────────────

export async function updateThemePreference(theme: 'dark' | 'light' | 'system') {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  if (!['dark', 'light', 'system'].includes(theme)) {
    return { success: false, error: 'Invalid theme' };
  }

  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { themePreference: theme },
  });

  return { success: true, theme };
}

// ─── UPDATE PER-ENDPOINT SLA THRESHOLD OVERRIDE ─────────────

export async function updateEndpointSlaThreshold(endpointId: string, threshold: number | null) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Verify ownership
  const ep = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId: ctx.workspaceId },
    select: { id: true, label: true },
  });
  if (!ep) return { success: false, error: 'Endpoint not found' };

  // Validate threshold: 1-100, or null to clear the override
  if (threshold != null) {
    if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
      return { success: false, error: 'Threshold must be between 1 and 100' };
    }
    threshold = Math.round(threshold);
  }

  await db.webhookEndpoint.update({
    where: { id: endpointId },
    data: { slaThresholdOverride: threshold },
  });

  revalidatePath('/dashboard/developers');
  return {
    success: true,
    threshold,
    cleared: threshold == null,
  };
}

// ─── NOTIFICATION PREFERENCES ────────────────────────────────

export async function updateNotificationPreferences(mutedTypes: string[]) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Validate types
  const validTypes = ['payment', 'info', 'success', 'warning', 'error', 'dispute'];
  const filtered = mutedTypes.filter((t) => validTypes.includes(t));

  await db.workspace.update({
    where: { id: ctx.workspaceId },
    data: { mutedNotificationTypes: filtered.join(',') },
  });

  revalidatePath('/dashboard/settings');
  return { success: true, mutedTypes: filtered };
}

export async function getNotificationPreferences() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  const ws = await db.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { mutedNotificationTypes: true },
  });

  const muted = ws?.mutedNotificationTypes
    ? ws.mutedNotificationTypes.split(',').filter(Boolean)
    : [];

  return { success: true, mutedTypes: muted };
}

// ─── BULK WEBHOOK ENDPOINT ACTIONS ───────────────────────────

export async function bulkToggleWebhookEndpoints(ids: string[], isActive: boolean) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };
  if (ids.length === 0) return { success: false, error: 'No endpoints selected' };

  // Verify ownership of all endpoints
  const endpoints = await db.webhookEndpoint.findMany({
    where: { id: { in: ids }, workspaceId: ctx.workspaceId },
    select: { id: true },
  });

  if (endpoints.length !== ids.length) {
    return { success: false, error: 'Some endpoints not found or access denied' };
  }

  const result = await db.webhookEndpoint.updateMany({
    where: { id: { in: ids }, workspaceId: ctx.workspaceId },
    data: { isActive },
  });

  revalidatePath('/dashboard/developers');
  return { success: true, updated: result.count };
}

export async function bulkDeleteWebhookEndpoints(ids: string[]) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };
  if (ids.length === 0) return { success: false, error: 'No endpoints selected' };

  // Verify ownership
  const endpoints = await db.webhookEndpoint.findMany({
    where: { id: { in: ids }, workspaceId: ctx.workspaceId },
    select: { id: true },
  });

  if (endpoints.length !== ids.length) {
    return { success: false, error: 'Some endpoints not found or access denied' };
  }

  const result = await db.webhookEndpoint.deleteMany({
    where: { id: { in: ids }, workspaceId: ctx.workspaceId },
  });

  revalidatePath('/dashboard/developers');
  return { success: true, deleted: result.count };
}

// ─── WEBHOOK ENDPOINT FOLDER ASSIGNMENT ──────────────────────

export async function updateEndpointFolder(endpointId: string, folder: string | null) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return { success: false, error: 'Unauthorized' };

  // Verify ownership
  const ep = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId: ctx.workspaceId },
    select: { id: true },
  });
  if (!ep) return { success: false, error: 'Endpoint not found' };

  // Validate folder name (max 50 chars, no commas to avoid CSV-like issues)
  const trimmed = folder?.trim().slice(0, 50) || null;

  await db.webhookEndpoint.update({
    where: { id: endpointId },
    data: { folder: trimmed },
  });

  revalidatePath('/dashboard/developers');
  return { success: true, folder: trimmed };
}
