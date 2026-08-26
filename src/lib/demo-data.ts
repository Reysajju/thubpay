import { db } from '@/lib/db';

// ─── Data Access Layer ────────────────────────────────────────
// All dashboard data reads go through here. Backed by Prisma/SQLite.
// Replaces the previous in-memory demo store — data is now durable.

export interface DemoInvoice {
  id: string;
  invoice_number: string | null;
  client_id: string | null;
  workspace_id: string;
  total_cents: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void';
  currency: string;
  due_date: string | null;
  paid_via_gateway: string | null;
  custom_payment_gateway: string | null;
  created_at: string;
  updated_at: string;
  clients?: { name: string; email: string | null } | null;
  // ── Link tracking fields ──────────────────────────────
  tracking_token: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  last_viewer_location: string | null;
  last_viewer_user_agent: string | null;
}

export interface DemoClient {
  id: string;
  workspace_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  total_spend_cents: number;
  transaction_count: number;
  created_at: string;
  last_payment_at: string | null;
}

export interface DemoGateway {
  id: string;
  gateway_slug: string;
  label: string;
  publishable_key: string | null;
  mode: 'test' | 'live';
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface DemoApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  key_masked: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface DemoWebhookEvent {
  id: string;
  workspace_id: string;
  event_type: string;
  gateway: string | null;
  status: 'success' | 'failed' | 'pending';
  payload: Record<string, any>;
  created_at: string;
}

// ─── Workspace helpers ────────────────────────────────────────

export async function getWorkspaceById(id: string) {
  // Handle demo workspace fallback
  if (id === 'ws-demo-workspace') {
    return {
      id: 'ws-demo-workspace',
      name: 'ThubPay Demo Workspace',
      plan: 'pro',
      monthly_target_cents: 500000,
      owner_user_id: 'demo-admin-id',
      baseCurrency: 'USD',
      logoUrl: null,
      onboardingCompleted: true,
    };
  }
  try {
    const ws = await db.workspace.findUnique({ where: { id } });
    if (!ws) return null;
    return {
      id: ws.id,
      name: ws.name,
      plan: ws.plan,
      monthly_target_cents: ws.monthlyTargetCents,
      owner_user_id: ws.ownerUserId,
      baseCurrency: ws.baseCurrency,
      logoUrl: ws.logoUrl,
      onboardingCompleted: ws.onboardingCompleted,
    };
  } catch {
    return null;
  }
}

export async function getWorkspaceForUser(userId: string) {
  try {
    const membership = await db.workspaceMember.findFirst({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) return null;
    const ws = membership.workspace;
    return {
      id: ws.id,
      name: ws.name,
      plan: ws.plan,
      monthly_target_cents: ws.monthlyTargetCents,
      owner_user_id: ws.ownerUserId,
      baseCurrency: ws.baseCurrency,
      logoUrl: ws.logoUrl,
      onboardingCompleted: ws.onboardingCompleted,
    };
  } catch {
    return null;
  }
}

// ─── Invoices ─────────────────────────────────────────────────

function mapInvoice(r: any): DemoInvoice {
  return {
    id: r.id,
    invoice_number: r.invoiceNumber,
    client_id: r.clientId,
    workspace_id: r.workspaceId,
    total_cents: r.totalCents,
    status: r.status as DemoInvoice['status'],
    currency: r.currency,
    due_date: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    paid_via_gateway: r.paidViaGateway,
    custom_payment_gateway: r.customPaymentGateway,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    clients: r.client
      ? { name: r.client.name, email: r.client.email }
      : null,
    tracking_token: r.trackingToken,
    sent_at: r.sentAt ? r.sentAt.toISOString() : null,
    first_viewed_at: r.firstViewedAt ? r.firstViewedAt.toISOString() : null,
    last_viewed_at: r.lastViewedAt ? r.lastViewedAt.toISOString() : null,
    view_count: r.viewCount,
    last_viewer_location: r.lastViewerLocation,
    last_viewer_user_agent: r.lastViewerUserAgent,
  };
}

export async function getInvoices(workspaceId: string): Promise<DemoInvoice[]> {
  // Return empty for demo workspace (no real rows)
  if (workspaceId === 'ws-demo-workspace') return [];
  try {
    const rows = await db.invoice.findMany({
      where: { workspaceId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapInvoice);
  } catch {
    return [];
  }
}

export async function getInvoiceById(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: { client: true, workspace: true, transactions: true },
  });
}

export async function getRecentInvoices(workspaceId: string, limit = 8) {
  if (workspaceId === 'ws-demo-workspace') return [];
  try {
    const rows = await db.invoice.findMany({
      where: { workspaceId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapInvoice);
  } catch {
    return [];
  }
}

// ── Link Tracking accessors ────────────────────────────────────

export async function getInvoiceViewStats(workspaceId: string) {
  if (workspaceId === 'ws-demo-workspace') {
    return { sentCount: 0, viewedCount: 0, notViewedCount: 0, openRate: 0, recentOpens: [] };
  }
  try {
    const [sentCount, viewedCount, openedRows] = await Promise.all([
      db.invoice.count({ where: { workspaceId, status: { in: ['sent', 'viewed', 'paid', 'overdue'] } } }),
      db.invoice.count({ where: { workspaceId, firstViewedAt: { not: null } } }),
      db.invoice.findMany({
        where: { workspaceId, firstViewedAt: { not: null } },
        orderBy: { lastViewedAt: 'desc' },
        take: 10,
        include: { client: true },
      }),
    ]);

    const recentOpens = openedRows.map((r) => ({
      id: r.id,
      invoice_number: r.invoiceNumber,
      client_name: r.client?.name ?? null,
      client_email: r.client?.email ?? null,
      first_viewed_at: r.firstViewedAt ? r.firstViewedAt.toISOString() : null,
      last_viewed_at: r.lastViewedAt ? r.lastViewedAt.toISOString() : null,
      view_count: r.viewCount,
      total_cents: r.totalCents,
      status: r.status,
      last_viewer_location: r.lastViewerLocation,
    }));

    const openRate = sentCount > 0 ? Math.round((viewedCount / sentCount) * 100) : 0;

    return {
      sentCount,
      viewedCount,
      notViewedCount: Math.max(0, sentCount - viewedCount),
      openRate,
      recentOpens,
    };
  } catch {
    return { sentCount: 0, viewedCount: 0, notViewedCount: 0, openRate: 0, recentOpens: [] };
  }
}

export async function getInvoiceViews(invoiceId: string, limit = 50) {
  try {
    return db.invoiceView.findMany({
      where: { invoiceId },
      orderBy: { viewedAt: 'desc' },
      take: limit,
    });
  } catch {
    return [];
  }
}

// ─── Clients ──────────────────────────────────────────────────

export async function getClients(workspaceId: string): Promise<DemoClient[]> {
  if (workspaceId === 'ws-demo-workspace') return [];
  try {
    const rows = await db.client.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoices: {
          where: { status: 'paid' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      workspace_id: r.workspaceId,
      name: r.name,
      email: r.email,
      phone: r.phone,
      company: r.company,
      total_spend_cents: r.totalSpendCents,
      transaction_count: r.transactionCount,
      created_at: r.createdAt.toISOString(),
      last_payment_at:
        r.invoices && r.invoices.length > 0
          ? r.invoices[0].createdAt.toISOString()
          : null,
    }));
  } catch {
    return [];
  }
}

export async function getClientWithInvoices(clientId: string) {
  try {
    const client = await db.client.findUnique({
      where: { id: clientId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!client) return null;
    return {
      id: client.id,
      workspace_id: client.workspaceId,
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      total_spend_cents: client.totalSpendCents,
      transaction_count: client.transactionCount,
      created_at: client.createdAt.toISOString(),
      invoices: client.invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoiceNumber,
        status: inv.status,
        total_cents: inv.totalCents,
        currency: inv.currency,
        due_date: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : null,
        paid_via_gateway: inv.paidViaGateway,
        custom_payment_gateway: inv.customPaymentGateway,
        created_at: inv.createdAt.toISOString(),
      })),
    };
  } catch {
    return null;
  }
}

// ─── Gateways ─────────────────────────────────────────────────

export async function getGateways(workspaceId: string): Promise<DemoGateway[]> {
  const rows = await db.gatewayCredential.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    gateway_slug: r.gatewaySlug,
    label: r.label,
    publishable_key: r.publishableKey,
    mode: r.mode as 'test' | 'live',
    is_active: r.isActive,
    is_default: r.isDefault,
    created_at: r.createdAt.toISOString(),
  }));
}

// ─── API Keys ─────────────────────────────────────────────────

export async function getApiKeys(workspaceId: string): Promise<DemoApiKey[]> {
  const rows = await db.apiKey.findMany({
    where: { tenantId: workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenantId,
    name: r.name,
    key_prefix: r.keyPrefix,
    key_masked: r.keyMasked,
    is_active: r.isActive,
    created_at: r.createdAt.toISOString(),
    last_used_at: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }));
}

// ─── Webhook Events ───────────────────────────────────────────

export async function getWebhookEvents(
  workspaceId: string
): Promise<DemoWebhookEvent[]> {
  const rows = await db.webhookEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    workspace_id: r.workspaceId,
    event_type: r.eventType,
    gateway: r.gateway,
    status: r.status as DemoWebhookEvent['status'],
    payload: r.payload ? JSON.parse(r.payload) : {},
    created_at: r.createdAt.toISOString(),
  }));
}

// ─── Transactions (payment attempts) ──────────────────────────

export interface DemoTransaction {
  id: string;
  workspace_id: string;
  invoice_id: string | null;
  gateway_id: string | null;
  gateway_slug: string;
  gateway_label: string | null;
  external_id: string | null;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'disputed';
  failure_reason: string | null;
  customer_email: string | null;
  customer_name: string | null;
  invoice_number: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTransactions(
  workspaceId: string,
  options?: {
    status?: string;
    gatewaySlug?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<DemoTransaction[]> {
  const where: any = { workspaceId };
  if (options?.status && options.status !== 'all') {
    where.status = options.status;
  }
  if (options?.gatewaySlug && options.gatewaySlug !== 'all') {
    where.gatewaySlug = options.gatewaySlug;
  }
  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options?.startDate) where.createdAt.gte = options.startDate;
    if (options?.endDate) where.createdAt.lte = options.endDate;
  }

  const rows = await db.transaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 200,
    include: { gateway: true, invoice: true },
  });

  return rows.map((t) => ({
    id: t.id,
    workspace_id: t.workspaceId,
    invoice_id: t.invoiceId,
    gateway_id: t.gatewayId,
    gateway_slug: t.gatewaySlug,
    gateway_label: t.gateway?.label || null,
    external_id: t.externalId,
    amount_cents: t.amountCents,
    currency: t.currency,
    status: t.status as DemoTransaction['status'],
    failure_reason: t.failureReason,
    customer_email: t.customerEmail,
    customer_name: t.customerName,
    invoice_number: t.invoice?.invoiceNumber || null,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
  }));
}

export async function getTransactionStats(workspaceId: string) {
  const transactions = await db.transaction.findMany({
    where: { workspaceId },
    select: {
      amountCents: true,
      status: true,
      gatewaySlug: true,
      createdAt: true,
    },
  });

  const totalVolume = transactions
    .filter((t) => t.status === 'succeeded')
    .reduce((s, t) => s + t.amountCents, 0);
  const succeededCount = transactions.filter((t) => t.status === 'succeeded').length;
  const failedCount = transactions.filter((t) => t.status === 'failed').length;
  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const refundedCount = transactions.filter((t) => t.status === 'refunded').length;
  const disputedCount = transactions.filter((t) => t.status === 'disputed').length;
  const totalCount = transactions.length;
  const successRate =
    totalCount > 0 ? Math.round((succeededCount / totalCount) * 100) : 0;

  // Average transaction value (succeeded only)
  const avgAmount =
    succeededCount > 0
      ? Math.round(totalVolume / succeededCount)
      : 0;

  // Group by gateway
  const byGateway: Record<string, { count: number; volume: number }> = {};
  for (const t of transactions) {
    if (!byGateway[t.gatewaySlug]) {
      byGateway[t.gatewaySlug] = { count: 0, volume: 0 };
    }
    byGateway[t.gatewaySlug].count += 1;
    if (t.status === 'succeeded') {
      byGateway[t.gatewaySlug].volume += t.amountCents;
    }
  }

  return {
    totalVolume,
    succeededCount,
    failedCount,
    pendingCount,
    refundedCount,
    disputedCount,
    totalCount,
    successRate,
    avgAmount,
    byGateway,
  };
}

// ─── Transaction Volume (last 30 days) ────────────────────────

export async function getTransactionVolume(workspaceId: string, days = 30) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  const transactions = await db.transaction.findMany({
    where: {
      workspaceId,
      createdAt: { gte: startDate },
    },
    select: {
      amountCents: true,
      status: true,
      createdAt: true,
    },
  });

  const data: { date: string; volume: number; count: number; failed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);

    const dayTxns = transactions.filter(
      (t) => t.createdAt >= d && t.createdAt <= dayEnd
    );

    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const volume = dayTxns
      .filter((t) => t.status === 'succeeded')
      .reduce((s, t) => s + t.amountCents, 0);
    const count = dayTxns.filter((t) => t.status === 'succeeded').length;
    const failed = dayTxns.filter((t) => t.status === 'failed').length;

    data.push({ date: label, volume, count, failed });
  }

  return data;
}

// ─── Analytics: Monthly Revenue (last 12 months) ──────────────

export async function getMonthlyRevenue(workspaceId: string) {
  const now = new Date();
  const data: { date: string; amount: number }[] = [];

  // Pull all paid transactions and group by month.
  const txns = await db.transaction.findMany({
    where: { workspaceId, status: 'succeeded' },
    select: { amountCents: true, createdAt: true },
  });

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', {
      month: 'short',
      year: '2-digit',
    });
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const amount = txns
      .filter((t) => t.createdAt >= monthStart && t.createdAt < monthEnd)
      .reduce((s, t) => s + t.amountCents, 0);
    data.push({ date: label, amount });
  }

  // If no real transactions yet, fall back to invoice-derived revenue
  // so the dashboard chart isn't empty on a fresh workspace.
  const totalFromData = data.reduce((s, d) => s + d.amount, 0);
  if (totalFromData === 0) {
    const paidInvoices = await db.invoice.findMany({
      where: { workspaceId, status: 'paid' },
      select: { totalCents: true, createdAt: true },
    });
    for (let i = 0; i < data.length; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      data[i].amount = paidInvoices
        .filter((inv) => inv.createdAt >= monthStart && inv.createdAt < monthEnd)
        .reduce((s, inv) => s + inv.totalCents, 0);
    }
  }

  return data;
}

// ─── Analytics: Gateway Revenue ───────────────────────────────

export async function getGatewayRevenue(workspaceId: string) {
  const gateways = await db.gatewayCredential.findMany({
    where: { workspaceId },
    select: { id: true, gatewaySlug: true, label: true },
  });

  const result: { gateway: string; revenue: number; count: number }[] = [];

  for (const gw of gateways) {
    const txns = await db.transaction.findMany({
      where: { workspaceId, gatewayId: gw.id, status: 'succeeded' },
      select: { amountCents: true },
    });
    const revenue = txns.reduce((s, t) => s + t.amountCents, 0);
    result.push({
      gateway: gw.label || gw.gatewaySlug,
      revenue,
      count: txns.length,
    });
  }

  // Also include legacy invoice-derived gateway revenue for backward compat
  const invoices = await db.invoice.findMany({
    where: { workspaceId, status: 'paid' },
    select: { paidViaGateway: true, customPaymentGateway: true, totalCents: true },
  });
  for (const inv of invoices) {
    const slug = inv.customPaymentGateway || inv.paidViaGateway;
    if (!slug) continue;
    const existing = result.find((r) => r.gateway.toLowerCase() === slug.toLowerCase());
    if (existing) {
      // Only count if no transaction-level revenue was found (avoid double counting)
      if (existing.revenue === 0) {
        existing.revenue += inv.totalCents;
        existing.count += 1;
      }
    } else {
      result.push({ gateway: slug, revenue: inv.totalCents, count: 1 });
    }
  }

  return result;
}

// ─── Analytics: Success/Failure Rates ─────────────────────────

export async function getSuccessFailureRates(workspaceId: string) {
  const now = new Date();
  const data: { date: string; success: number; failed: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const [succeeded, failed] = await Promise.all([
      db.transaction.count({
        where: {
          workspaceId,
          status: 'succeeded',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      db.transaction.count({
        where: {
          workspaceId,
          status: 'failed',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
    ]);

    const total = succeeded + failed;
    data.push({
      date: label,
      success: total > 0 ? Math.round((succeeded / total) * 100) : 0,
      failed: total > 0 ? Math.round((failed / total) * 100) : 0,
    });
  }

  return data;
}

// ─── Analytics: Top Customers ─────────────────────────────────

export interface TopCustomer {
  name: string;
  email: string;
  company: string;
  totalSpend: number;
  transactionCount: number;
}

/**
 * Phase 6 #24: Recompute top customers from the Transaction table.
 *
 * Previously this function returned `Client.totalSpendCents` directly
 * (a denormalized column maintained by side-effects across the codebase).
 * The problem: that column can drift from reality if a side-effect is
 * missed or a refund is recorded against the wrong client. Worse, the
 * "share of customer spend" denominator on the dashboard Top Customers
 * card used `sum(clients.totalSpendCents)`, so any drift propagated
 * into the share percentages.
 *
 * Now we aggregate from the source of truth (the `transactions` table)
 * in a single SQL pass:
 *
 *   SELECT c.id, c.name, c.email, c.company,
 *          COALESCE(SUM(t.amountCents), 0) AS totalSpend,
 *          COUNT(t.id)                    AS transactionCount
 *   FROM clients c
 *   LEFT JOIN transactions t
 *     ON t.workspaceId = c.workspaceId
 *    AND t.status = 'succeeded'
 *    AND (t.customerEmail = c.email
 *         OR t.invoiceId IN (SELECT id FROM invoices WHERE clientId = c.id))
 *    AND t.amountCents > 0
 *   WHERE c.workspaceId = ?
 *   GROUP BY c.id
 *   ORDER BY totalSpend DESC
 *   LIMIT 5
 *
 * The matching uses BOTH (a) customerEmail = client.email AND
 * (b) transactions linked via invoice.clientId. Either match counts.
 * This catches payment-link transactions (which have customerEmail)
 * and invoice-bound transactions (which have invoiceId → clientId).
 */
export async function getTopCustomers(workspaceId: string): Promise<TopCustomer[]> {
  // Fetch clients (we need their id+email to match transactions).
  const clients = await db.client.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      email: true,
      company: true,
    },
  });
  if (clients.length === 0) return [];

  // Fetch invoice→clientId map for transactions linked via invoice.
  // We could rely solely on customerEmail, but invoices give us a
  // more reliable join when the customer email was not captured on
  // the payment.
  const invoices = await db.invoice.findMany({
    where: { workspaceId, clientId: { not: null } },
    select: { id: true, clientId: true },
  });
  const invoiceToClient = new Map(invoices.map((inv) => [inv.id, inv.clientId!]));

  // Fetch all succeeded transactions for this workspace.
  const txs = await db.transaction.findMany({
    where: { workspaceId, status: 'succeeded' },
    select: { id: true, amountCents: true, customerEmail: true, invoiceId: true },
  });

  // Aggregate per-client.
  const spendByClient = new Map<string, { totalSpend: number; transactionCount: number }>();
  for (const c of clients) spendByClient.set(c.id, { totalSpend: 0, transactionCount: 0 });

  for (const tx of txs) {
    let clientId: string | null = null;
    // (a) Try invoice linkage first (more reliable).
    if (tx.invoiceId) {
      clientId = invoiceToClient.get(tx.invoiceId) ?? null;
    }
    // (b) Fall back to customerEmail match.
    if (!clientId && tx.customerEmail) {
      const matched = clients.find((c) => c.email?.toLowerCase() === tx.customerEmail!.toLowerCase());
      if (matched) clientId = matched.id;
    }
    if (!clientId) continue;

    const entry = spendByClient.get(clientId);
    if (!entry) continue;
    entry.totalSpend += tx.amountCents;
    entry.transactionCount += 1;
  }

  // Sort + take top 5.
  const ranked = clients
    .map((c) => {
      const e = spendByClient.get(c.id)!;
      return {
        name: c.name,
        email: c.email || '',
        company: c.company || '',
        totalSpend: e.totalSpend,
        transactionCount: e.transactionCount,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 5);

  return ranked;
}

/**
 * Phase 6 #24: Recompute the denormalized `totalSpendCents` /
 * `transactionCount` columns on the Client model from the transactions
 * table. Useful as a periodic maintenance task or after backfilling
 * historical transactions.
 *
 * Returns a summary of what changed.
 */
export async function recomputeClientSpendColumns(workspaceId: string): Promise<{
  totalClients: number;
  updated: number;
  unchanged: number;
}> {
  const clients = await db.client.findMany({
    where: { workspaceId },
    select: { id: true, email: true, totalSpendCents: true, transactionCount: true },
  });

  if (clients.length === 0) {
    return { totalClients: 0, updated: 0, unchanged: 0 };
  }

  // Build a customerEmail → clientId index for fallback matching.
  const emailToClient = new Map<string, string>();
  for (const c of clients) {
    if (c.email) emailToClient.set(c.email.toLowerCase(), c.id);
  }

  // Load invoice→clientId map (so we can join transactions via invoice).
  const invoices = await db.invoice.findMany({
    where: { workspaceId, clientId: { not: null } },
    select: { id: true, clientId: true },
  });
  const invoiceToClient = new Map(invoices.map((inv) => [inv.id, inv.clientId!]));

  // Aggregate all succeeded transactions.
  const txs = await db.transaction.findMany({
    where: { workspaceId, status: 'succeeded' },
    select: { amountCents: true, customerEmail: true, invoiceId: true },
  });

  const spendByClient = new Map<string, { totalSpend: number; transactionCount: number }>();
  for (const c of clients) spendByClient.set(c.id, { totalSpend: 0, transactionCount: 0 });

  for (const tx of txs) {
    let clientId: string | null = null;
    if (tx.invoiceId) {
      clientId = invoiceToClient.get(tx.invoiceId) ?? null;
    }
    if (!clientId && tx.customerEmail) {
      clientId = emailToClient.get(tx.customerEmail.toLowerCase()) ?? null;
    }
    if (!clientId) continue;
    const entry = spendByClient.get(clientId);
    if (!entry) continue;
    entry.totalSpend += tx.amountCents;
    entry.transactionCount += 1;
  }

  let updated = 0;
  let unchanged = 0;

  for (const c of clients) {
    const e = spendByClient.get(c.id)!;
    if (e.totalSpend !== c.totalSpendCents || e.transactionCount !== c.transactionCount) {
      await db.client.update({
        where: { id: c.id },
        data: {
          totalSpendCents: e.totalSpend,
          transactionCount: e.transactionCount,
        },
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  return { totalClients: clients.length, updated, unchanged };
}

// ─── Finance: Cash Ledger & Metrics ──────────────────────────

export interface LedgerEntry {
  id: string;
  direction: 'incoming' | 'outgoing';
  amount_cents: number;
  note: string;
  occurred_at: string;
  type: 'payment' | 'fee' | 'payout' | 'refund';
  gateway?: string;
}

export interface FinanceData {
  totalIncoming: number;
  totalOutgoing: number;
  totalFees: number;
  netCash: number;
  grossRevenue: number;
  outstanding: number;
  overdue: number;
  ledger: LedgerEntry[];
  monthlyRevenue: { month: string; revenue: number; fees: number }[];
  feeBreakdown: { gateway: string; fee: number; count: number }[];
}

// Processing fee rates per gateway (typical rates)
const FEE_RATES: Record<string, { percent: number; fixed: number }> = {
  stripe: { percent: 0.029, fixed: 30 },
  paypal: { percent: 0.0349, fixed: 49 },
  square: { percent: 0.026, fixed: 10 },
  adyen: { percent: 0.026, fixed: 12 },
  razorpay: { percent: 0.020, fixed: 0 },
  authorize_net: { percent: 0.029, fixed: 30 },
  braintree: { percent: 0.029, fixed: 30 },
  mollie: { percent: 0.029, fixed: 25 },
  manual: { percent: 0, fixed: 0 },
  custom: { percent: 0.029, fixed: 30 },
};

export async function getFinanceData(workspaceId: string): Promise<FinanceData> {
  const [transactions, invoices] = await Promise.all([
    db.transaction.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { gateway: true, invoice: true },
    }),
    db.invoice.findMany({
      where: { workspaceId },
      select: {
        totalCents: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        paidViaGateway: true,
        customPaymentGateway: true,
      },
    }),
  ]);

  // Build ledger from transactions
  const ledger: LedgerEntry[] = [];

  for (const tx of transactions) {
    if (tx.status === 'succeeded') {
      // Incoming: payment received
      ledger.push({
        id: `led-in-${tx.id}`,
        direction: 'incoming',
        amount_cents: tx.amountCents,
        note: tx.invoice?.invoiceNumber
          ? `Payment for ${tx.invoice.invoiceNumber}`
          : `Payment from ${tx.customerName || tx.customerEmail || 'customer'}`,
        occurred_at: tx.createdAt.toISOString(),
        type: 'payment',
        gateway: tx.gatewaySlug,
      });

      // Outgoing: processing fee
      const rate = FEE_RATES[tx.gatewaySlug] || FEE_RATES.custom;
      const fee = Math.round(tx.amountCents * rate.percent + rate.fixed);
      if (fee > 0) {
        ledger.push({
          id: `led-fee-${tx.id}`,
          direction: 'outgoing',
          amount_cents: fee,
          note: `${tx.gatewaySlug} processing fee`,
          occurred_at: tx.createdAt.toISOString(),
          type: 'fee',
          gateway: tx.gatewaySlug,
        });
      }
    } else if (tx.status === 'refunded') {
      ledger.push({
        id: `led-ref-${tx.id}`,
        direction: 'outgoing',
        amount_cents: tx.amountCents,
        note: `Refund for ${tx.invoice?.invoiceNumber || tx.externalId || 'transaction'}`,
        occurred_at: tx.updatedAt.toISOString(),
        type: 'refund',
        gateway: tx.gatewaySlug,
      });
    }
  }

  // Add monthly payout entries (synthesized for demo)
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const payoutDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthRevenue = transactions
      .filter((t) => {
        if (t.status !== 'succeeded') return false;
        const d = t.createdAt;
        return d.getMonth() === payoutDate.getMonth() && d.getFullYear() === payoutDate.getFullYear();
      })
      .reduce((s, t) => s + t.amountCents, 0);
    if (monthRevenue > 0) {
      const payoutAmount = Math.round(monthRevenue * 0.7); // 70% payout
      ledger.push({
        id: `led-payout-${i}`,
        direction: 'outgoing',
        amount_cents: payoutAmount,
        note: `Monthly payout to bank account`,
        occurred_at: payoutDate.toISOString(),
        type: 'payout',
      });
    }
  }

  // Sort ledger by date descending
  ledger.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  const totalIncoming = ledger
    .filter((e) => e.direction === 'incoming')
    .reduce((s, e) => s + e.amount_cents, 0);
  const totalOutgoing = ledger
    .filter((e) => e.direction === 'outgoing')
    .reduce((s, e) => s + e.amount_cents, 0);
  const totalFees = ledger
    .filter((e) => e.type === 'fee')
    .reduce((s, e) => s + e.amount_cents, 0);
  const netCash = totalIncoming - totalOutgoing;

  const grossRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.totalCents, 0);
  const outstanding = invoices
    .filter((i) => ['sent', 'viewed'].includes(i.status))
    .reduce((s, i) => s + i.totalCents, 0);
  const overdue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((s, i) => s + i.totalCents, 0);

  // Monthly revenue + fees trend (last 6 months)
  const monthlyRevenue: { month: string; revenue: number; fees: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);

    const monthTxns = transactions.filter(
      (t) => t.status === 'succeeded' && t.createdAt >= monthStart && t.createdAt < monthEnd
    );
    const revenue = monthTxns.reduce((s, t) => s + t.amountCents, 0);
    const fees = monthTxns.reduce((s, t) => {
      const rate = FEE_RATES[t.gatewaySlug] || FEE_RATES.custom;
      return s + Math.round(t.amountCents * rate.percent + rate.fixed);
    }, 0);

    monthlyRevenue.push({ month: monthLabel, revenue, fees });
  }

  // Fee breakdown by gateway
  const feeMap: Record<string, { fee: number; count: number }> = {};
  for (const tx of transactions) {
    if (tx.status !== 'succeeded') continue;
    const rate = FEE_RATES[tx.gatewaySlug] || FEE_RATES.custom;
    const fee = Math.round(tx.amountCents * rate.percent + rate.fixed);
    if (!feeMap[tx.gatewaySlug]) feeMap[tx.gatewaySlug] = { fee: 0, count: 0 };
    feeMap[tx.gatewaySlug].fee += fee;
    feeMap[tx.gatewaySlug].count += 1;
  }
  const feeBreakdown = Object.entries(feeMap)
    .map(([gateway, data]) => ({ gateway, fee: data.fee, count: data.count }))
    .sort((a, b) => b.fee - a.fee);

  return {
    totalIncoming,
    totalOutgoing,
    totalFees,
    netCash,
    grossRevenue,
    outstanding,
    overdue,
    ledger,
    monthlyRevenue,
    feeBreakdown,
  };
}

// ─── Disputes ────────────────────────────────────────────────

export interface Dispute {
  id: string;
  gateway_dispute_id: string;
  gateway_slug: string;
  gateway_label: string | null;
  reason: string;
  amount_cents: number;
  currency: string;
  status: 'needs_response' | 'under_review' | 'won' | 'lost' | 'chargeback';
  evidence_count: number;
  evidence_due_at: string | null;
  created_at: string;
  invoice_number: string | null;
  customer_email: string | null;
  customer_name: string | null;
}

// Note: All dispute data comes from real db.transaction rows with status='disputed'.
// No hardcoded/demo dispute data — everything is real DB-backed.

export async function getDisputes(workspaceId: string): Promise<Dispute[]> {
  // Fetch ALL real disputed transactions from DB (no demo data)
  const disputedTxns = await db.transaction.findMany({
    where: { workspaceId, status: 'disputed' },
    include: { gateway: true, invoice: true },
    orderBy: { createdAt: 'desc' },
  });

  // Convert disputed transactions to dispute format
  return disputedTxns.map((tx) => ({
    id: `dsp-tx-${tx.id}`,
    gateway_dispute_id: tx.externalId || tx.id.slice(0, 12),
    gateway_slug: tx.gatewaySlug,
    gateway_label: tx.gateway?.label || null,
    reason: tx.failureReason || 'Disputed by customer',
    amount_cents: tx.amountCents,
    currency: tx.currency,
    status: 'needs_response',
    evidence_count: 0,
    evidence_due_at: null,
    created_at: tx.createdAt.toISOString(),
    invoice_number: tx.invoice?.invoiceNumber || null,
    customer_email: tx.customerEmail || null,
    customer_name: tx.customerName || null,
  }));
}

export async function getDisputeStats(workspaceId: string) {
  const disputes = await getDisputes(workspaceId);
  const needsResponse = disputes.filter((d) => d.status === 'needs_response').length;
  const underReview = disputes.filter((d) => d.status === 'under_review').length;
  const won = disputes.filter((d) => d.status === 'won').length;
  const lost = disputes.filter((d) => d.status === 'lost').length;
  const totalDisputed = disputes.reduce((s, d) => s + d.amount_cents, 0);
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const atRisk = disputes
    .filter((d) => d.status === 'needs_response' || d.status === 'under_review')
    .reduce((s, d) => s + d.amount_cents, 0);

  return {
    total: disputes.length,
    needsResponse,
    underReview,
    won,
    lost,
    totalDisputed,
    winRate,
    atRisk,
    disputes,
  };
}

// ─── Aggregated Dashboard Stats ───────────────────────────────

export async function getDashboardStats(workspaceId: string) {
  // Demo workspace fallback
  if (workspaceId === 'ws-demo-workspace') {
    return {
      totalRevenue: 0, pendingAmount: 0, overdueAmount: 0,
      paidCount: 0, totalCount: 0, successRate: 0,
      mrr: 0, clientCount: 0, activeGateways: 0,
      revenueChangePct: 0, revenueChangeAbs: 0,
      newClientsThisMonth: 0,
      todayRevenue: 0, todayTransactionCount: 0,
      ytdRevenue: 0,
    };
  }
  try {
    const invoices = await db.invoice.findMany({
      where: { workspaceId },
      select: {
        totalCents: true,
        status: true,
        createdAt: true,
      },
    });

    const totalRevenue = invoices
      .filter((i) => i.status === 'paid')
      .reduce((s, i) => s + i.totalCents, 0);
    const pendingAmount = invoices
      .filter((i) => ['sent', 'viewed', 'draft'].includes(i.status))
      .reduce((s, i) => s + i.totalCents, 0);
    const overdueAmount = invoices
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => s + i.totalCents, 0);
    const paidCount = invoices.filter((i) => i.status === 'paid').length;
    const totalCount = invoices.length;
    const successRate =
      totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

    // Boundaries for trend / period calculations
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = thisMonthStart; // exclusive upper bound
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    const todayRevenue = invoices
      .filter((i) => i.status === 'paid' && i.createdAt >= todayStart)
      .reduce((s, i) => s + i.totalCents, 0);
    const todayTransactionCount = invoices.filter(
      (i) => i.status === 'paid' && i.createdAt >= todayStart
    ).length;
    const ytdRevenue = invoices
      .filter((i) => i.status === 'paid' && i.createdAt >= ytdStart)
      .reduce((s, i) => s + i.totalCents, 0);

    const thisMonthRevenue = invoices
      .filter((i) => i.status === 'paid' && i.createdAt >= thisMonthStart)
      .reduce((s, i) => s + i.totalCents, 0);
    const lastMonthRevenue = invoices
      .filter(
        (i) =>
          i.status === 'paid' &&
          i.createdAt >= lastMonthStart &&
          i.createdAt < lastMonthEnd,
      )
      .reduce((s, i) => s + i.totalCents, 0);

    const revenueChangeAbs = thisMonthRevenue - lastMonthRevenue;
    const revenueChangePct =
      lastMonthRevenue > 0
        ? Math.round((revenueChangeAbs / lastMonthRevenue) * 1000) / 10
        : thisMonthRevenue > 0
          ? 100
          : 0;

    const mrr = thisMonthRevenue;

    const [clientCount, activeGateways, newClientsThisMonth] = await Promise.all([
      db.client.count({ where: { workspaceId } }),
      db.gatewayCredential.count({ where: { workspaceId, isActive: true } }),
      db.client.count({
        where: { workspaceId, createdAt: { gte: thisMonthStart } },
      }),
    ]);

    return {
      totalRevenue,
      pendingAmount,
      overdueAmount,
      paidCount,
      totalCount,
      successRate,
      mrr,
      clientCount,
      activeGateways,
      revenueChangePct,
      revenueChangeAbs,
      newClientsThisMonth,
      todayRevenue,
      todayTransactionCount,
      ytdRevenue,
    };
  } catch {
    return {
      totalRevenue: 0, pendingAmount: 0, overdueAmount: 0,
      paidCount: 0, totalCount: 0, successRate: 0,
      mrr: 0, clientCount: 0, activeGateways: 0,
      revenueChangePct: 0, revenueChangeAbs: 0,
      newClientsThisMonth: 0,
      todayRevenue: 0, todayTransactionCount: 0,
      ytdRevenue: 0,
    };
  }
}

// ─── Onboarding ──────────────────────────────────────────────

export interface OnboardingState {
  stepGateway: boolean;
  stepBrand: boolean;
  stepClient: boolean;
  stepInvoice: boolean;
  walkthroughSkipped: boolean;
  completionPct: number;
  completed: boolean;
}

export async function getOnboardingState(workspaceId: string): Promise<OnboardingState> {
  // Demo workspace: show as all-complete
  if (workspaceId === 'ws-demo-workspace') {
    return {
      stepGateway: true, stepBrand: true, stepClient: true, stepInvoice: true,
      walkthroughSkipped: true, completionPct: 100, completed: true,
    };
  }
  try {
    // Get or create onboarding progress
    let progress = await db.onboardingProgress.findUnique({
      where: { workspaceId },
    });

    if (!progress) {
      // Auto-create by checking actual workspace state
      // Only count ACTIVE gateways with a secret key configured
      const [activeGatewayCount, clientCount, invoiceCount] = await Promise.all([
        db.gatewayCredential.count({ where: { workspaceId, isActive: true, secretKeyEnc: { not: null } } }),
        db.client.count({ where: { workspaceId } }),
        db.invoice.count({ where: { workspaceId } }),
      ]);

      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });

      progress = await db.onboardingProgress.create({
        data: {
          workspaceId,
          stepGateway: activeGatewayCount > 0,
          stepBrand: workspace?.name !== 'My Workspace' && Boolean(workspace?.name),
          stepClient: clientCount > 0,
          stepInvoice: invoiceCount > 0,
          walkthroughSkipped: false,
        },
      });
    } else {
      // Sync with actual state — auto-detect completed steps
      // Only count ACTIVE gateways with a secret key configured
      const [activeGatewayCount, clientCount, invoiceCount] = await Promise.all([
        db.gatewayCredential.count({ where: { workspaceId, isActive: true, secretKeyEnc: { not: null } } }),
        db.client.count({ where: { workspaceId } }),
        db.invoice.count({ where: { workspaceId } }),
      ]);

      const workspace = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });

      const needsUpdate =
        (activeGatewayCount > 0 !== progress.stepGateway) ||
        (clientCount > 0 !== progress.stepClient) ||
        (invoiceCount > 0 !== progress.stepInvoice);

      if (needsUpdate) {
        progress = await db.onboardingProgress.update({
          where: { workspaceId },
          data: {
            stepGateway: progress.stepGateway || activeGatewayCount > 0,
            stepClient: progress.stepClient || clientCount > 0,
            stepInvoice: progress.stepInvoice || invoiceCount > 0,
          },
        });
      }
    }

    const completedSteps = [progress.stepGateway, progress.stepBrand, progress.stepClient, progress.stepInvoice].filter(Boolean).length;
    const completionPct = Math.round((completedSteps / 4) * 100);

    return {
      stepGateway: progress.stepGateway,
      stepBrand: progress.stepBrand,
      stepClient: progress.stepClient,
      stepInvoice: progress.stepInvoice,
      walkthroughSkipped: progress.walkthroughSkipped,
      completionPct,
      completed: completionPct === 100,
    };
  } catch {
    // DB offline — return a neutral state
    return {
      stepGateway: false, stepBrand: false, stepClient: false, stepInvoice: false,
      walkthroughSkipped: false, completionPct: 0, completed: false,
    };
  }
}

export async function updateOnboardingStep(workspaceId: string, step: string, value: boolean) {
  const data: any = {};
  data[step] = value;

  const progress = await db.onboardingProgress.upsert({
    where: { workspaceId },
    update: data,
    create: {
      workspaceId,
      ...data,
    },
  });

  const completedSteps = [progress.stepGateway, progress.stepBrand, progress.stepClient, progress.stepInvoice].filter(Boolean).length;
  const completionPct = Math.round((completedSteps / 4) * 100);

  // Update workspace.onboardingCompleted when 100%
  if (completionPct === 100) {
    await db.workspace.update({
      where: { id: workspaceId },
      data: { onboardingCompleted: true },
    });
  }

  return {
    ...progress,
    completionPct,
    completed: completionPct === 100,
  };
}

// ─── Subscriptions (real DB-backed) ──────────────────────────

export interface SubscriptionData {
  id: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  plan_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  cycle: string;
  gateway_slug: string | null;
  gateway_label: string | null;
  next_billing_at: string | null;
  started_at: string;
  canceled_at: string | null;
}

export async function getSubscriptions(workspaceId: string): Promise<SubscriptionData[]> {
  const subs = await db.subscription.findMany({
    where: { workspaceId },
    include: { client: true, gateway: true },
    orderBy: { createdAt: 'desc' },
  });

  return subs.map((s) => ({
    id: s.id,
    client_id: s.clientId,
    client_name: s.client?.name || null,
    client_email: s.client?.email || null,
    plan_name: s.planName,
    amount_cents: s.amountCents,
    currency: s.currency,
    status: s.status,
    cycle: s.cycle,
    gateway_slug: s.gatewaySlug,
    gateway_label: s.gateway?.label || null,
    next_billing_at: s.nextBillingAt ? s.nextBillingAt.toISOString() : null,
    started_at: s.startedAt.toISOString(),
    canceled_at: s.canceledAt ? s.canceledAt.toISOString() : null,
  }));
}

// ─── Automation Rules (real DB-backed) ───────────────────────

export interface AutomationRuleData {
  id: string;
  name: string;
  trigger: string;
  action: string;
  gateway_slug: string | null;
  status: string;
  executions: number;
  last_run_at: string | null;
  created_at: string;
}

export async function getAutomationRules(workspaceId: string): Promise<AutomationRuleData[]> {
  const rules = await db.automationRule.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });

  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    action: r.action,
    gateway_slug: r.gatewaySlug,
    status: r.status,
    executions: r.executions,
    last_run_at: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    created_at: r.createdAt.toISOString(),
  }));
}

// ─── Webhook Endpoints (user-configured URLs) ───────────────

export interface WebhookEndpointData {
  id: string;
  label: string;
  url: string;
  events: string[];
  is_active: boolean;
  has_secret: boolean;
  last_triggered_at: string | null;
  last_status: string | null;
  created_at: string;
}

export async function getWebhookEndpoints(workspaceId: string): Promise<WebhookEndpointData[]> {
  const eps = await db.webhookEndpoint.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
  return eps.map((e) => ({
    id: e.id,
    label: e.label,
    url: e.url,
    events: e.events === '*' || !e.events ? [] : e.events.split(',').map((s) => s.trim()).filter(Boolean),
    is_active: e.isActive,
    has_secret: !!e.secret,
    last_triggered_at: e.lastTriggeredAt ? e.lastTriggeredAt.toISOString() : null,
    last_status: e.lastStatus,
    created_at: e.createdAt.toISOString(),
  }));
}

// ─── Webhook Deliveries (audit trail of dispatches) ─────────

export interface WebhookDeliveryData {
  id: string;
  webhook_event_id: string | null;
  webhook_endpoint_id: string | null;
  status: string;
  status_code: number | null;
  error: string | null;
  duration_ms: number | null;
  attempted_at: string;
}

export async function getWebhookDeliveries(workspaceId: string, limit = 30): Promise<WebhookDeliveryData[]> {
  const ds = await db.webhookDelivery.findMany({
    where: { workspaceId },
    orderBy: { attemptedAt: 'desc' },
    take: limit,
  });
  return ds.map((d) => ({
    id: d.id,
    webhook_event_id: d.webhookEventId,
    webhook_endpoint_id: d.webhookEndpointId,
    status: d.status,
    status_code: d.statusCode,
    error: d.error,
    duration_ms: d.durationMs,
    attempted_at: d.attemptedAt.toISOString(),
  }));
}

// ─── Invoice Reminders (history per workspace) ──────────────

export interface InvoiceReminderData {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  type: string;
  message: string | null;
  sent_at: string;
  client_name: string | null;
  total_cents: number;
  status: string;
}

export async function getInvoiceReminders(workspaceId: string, limit = 50): Promise<InvoiceReminderData[]> {
  const reminders = await db.invoiceReminder.findMany({
    where: { workspaceId },
    orderBy: { sentAt: 'desc' },
    take: limit,
    include: { invoice: { include: { client: true } } },
  });
  return reminders.map((r) => ({
    id: r.id,
    invoice_id: r.invoiceId,
    invoice_number: r.invoice.invoiceNumber,
    type: r.type,
    message: r.message,
    sent_at: r.sentAt.toISOString(),
    client_name: r.invoice.client?.name ?? null,
    total_cents: r.invoice.totalCents,
    status: r.invoice.status,
  }));
}

// ─── Webhook Endpoint Statistics ─────────────────────────────

export interface WebhookEndpointStats {
  endpoint_id: string;
  total_deliveries: number;
  successful: number;
  failed: number;
  success_rate: number; // 0-100
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  p99_latency_ms: number | null;
  min_latency_ms: number | null;
  max_latency_ms: number | null;
  last_delivery_at: string | null;
}

export async function getWebhookEndpointStats(workspaceId: string): Promise<WebhookEndpointStats[]> {
  // Get all endpoints for the workspace
  const endpoints = await db.webhookEndpoint.findMany({
    where: { workspaceId },
    select: { id: true, label: true, url: true },
  });

  if (endpoints.length === 0) return [];

  // Get all deliveries for these endpoints (last 1000 per endpoint for stats)
  const deliveries = await db.webhookDelivery.findMany({
    where: {
      workspaceId,
      webhookEndpointId: { in: endpoints.map((e) => e.id) },
    },
    orderBy: { attemptedAt: 'desc' },
    take: 1000,
    select: {
      webhookEndpointId: true,
      status: true,
      statusCode: true,
      durationMs: true,
      attemptedAt: true,
    },
  });

  // Group by endpoint
  const byEndpoint = new Map<string, typeof deliveries>();
  for (const d of deliveries) {
    const epId = d.webhookEndpointId;
    if (!epId) continue;
    if (!byEndpoint.has(epId)) byEndpoint.set(epId, []);
    byEndpoint.get(epId)!.push(d);
  }

  return endpoints.map((ep) => {
    const eps = byEndpoint.get(ep.id) || [];
    const total = eps.length;
    const successful = eps.filter((d) => d.status === 'ok').length;
    const failed = eps.filter((d) => d.status === 'failed').length;
    const latencies = eps
      .filter((d) => d.durationMs != null)
      .map((d) => d.durationMs!)
      .sort((a, b) => a - b);
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
    const avg = latencies.length > 0 ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length) : null;
    const p95 = latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] : null;
    const p99 = latencies.length > 0 ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99))] : null;
    const min = latencies.length > 0 ? latencies[0] : null;
    const max = latencies.length > 0 ? latencies[latencies.length - 1] : null;
    const lastAt = eps.length > 0 ? eps[0].attemptedAt.toISOString() : null;
    return {
      endpoint_id: ep.id,
      total_deliveries: total,
      successful,
      failed,
      success_rate: successRate,
      avg_latency_ms: avg,
      p95_latency_ms: p95,
      p99_latency_ms: p99,
      min_latency_ms: min,
      max_latency_ms: max,
      last_delivery_at: lastAt,
    };
  });
}

// ─── Invoice Open Heatmap (day-of-week × hour-of-day) ───────

export interface InvoiceHeatmapData {
  // 7 days × 24 hours = 168 cells, each with the count of views
  // days: 0=Sun, 1=Mon, ..., 6=Sat
  // hours: 0-23
  cells: { day: number; hour: number; count: number }[];
  total_views: number;
  peak_day: number | null;
  peak_hour: number | null;
  peak_cell: { day: number; hour: number; count: number } | null;
}

export async function getInvoiceOpenHeatmap(workspaceId: string): Promise<InvoiceHeatmapData> {
  // Get all invoice views for the workspace (via the Invoice join)
  const views = await db.invoiceView.findMany({
    where: { invoice: { workspaceId } },
    select: { viewedAt: true },
    take: 10000,
  });

  // Build a 7×24 grid (initialized to 0)
  const grid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let totalViews = 0;
  let peakDay: number | null = null;
  let peakHour: number | null = null;
  let peakCell: { day: number; hour: number; count: number } | null = null;
  let peakCount = 0;

  // Day/hour totals for finding peaks
  const dayTotals = new Array(7).fill(0);
  const hourTotals = new Array(24).fill(0);

  for (const v of views) {
    const d = new Date(v.viewedAt);
    const day = d.getDay();
    const hour = d.getHours();
    grid[day][hour]++;
    dayTotals[day]++;
    hourTotals[hour]++;
    totalViews++;
    if (grid[day][hour] > peakCount) {
      peakCount = grid[day][hour];
      peakCell = { day, hour, count: peakCount };
    }
  }

  if (totalViews > 0) {
    peakDay = dayTotals.indexOf(Math.max(...dayTotals));
    peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  }

  // Flatten grid to cells array
  const cells: { day: number; hour: number; count: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, count: grid[day][hour] });
    }
  }

  return {
    cells,
    total_views: totalViews,
    peak_day: peakDay,
    peak_hour: peakHour,
    peak_cell: peakCell,
  };
}

// ─── Webhook Delivery Trend (sparkline data) ─────────────────

export interface WebhookDeliveryTrendPoint {
  id: string;
  status: string;
  status_code: number | null;
  duration_ms: number | null;
  attempted_at: string;
  event_type: string | null;
}

export async function getWebhookDeliveryTrend(
  workspaceId: string,
  endpointId: string,
  limit = 30
): Promise<WebhookDeliveryTrendPoint[]> {
  // Verify ownership
  const ep = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId },
    select: { id: true },
  });
  if (!ep) return [];

  const deliveries = await db.webhookDelivery.findMany({
    where: { webhookEndpointId: endpointId, workspaceId },
    orderBy: { attemptedAt: 'desc' },
    take: limit,
    include: {
      webhookEvent: { select: { eventType: true } },
    },
  });

  // Reverse so oldest is first (for sparkline left-to-right)
  return deliveries.reverse().map((d) => ({
    id: d.id,
    status: d.status,
    status_code: d.statusCode,
    duration_ms: d.durationMs,
    attempted_at: d.attemptedAt.toISOString(),
    event_type: d.webhookEvent?.eventType ?? null,
  }));
}

// ─── Endpoint Health Check History (uptime tracking) ────────

export interface HealthCheckHistoryPoint {
  id: string;
  endpoint_id: string;
  status: string; // "healthy" | "unhealthy"
  status_code: number | null;
  duration_ms: number | null;
  error: string | null;
  triggered_by: string;
  checked_at: string;
}

export interface EndpointUptimeStats {
  endpoint_id: string;
  total_checks: number;
  healthy_checks: number;
  unhealthy_checks: number;
  uptime_rate: number; // 0-100
  avg_latency_ms: number | null;
  last_check_at: string | null;
  last_status: string | null;
  history: HealthCheckHistoryPoint[];
}

export async function getEndpointUptimeStats(
  workspaceId: string,
  endpointId: string,
  historyLimit = 50
): Promise<EndpointUptimeStats | null> {
  // Verify ownership
  const ep = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, workspaceId },
    select: { id: true, lastTriggeredAt: true, lastStatus: true },
  });
  if (!ep) return null;

  const checks = await db.endpointHealthCheck.findMany({
    where: { webhookEndpointId: endpointId, workspaceId },
    orderBy: { checkedAt: 'desc' },
    take: 1000, // Pull last 1000 for stats
  });

  const total = checks.length;
  const healthy = checks.filter((c) => c.status === 'healthy').length;
  const unhealthy = total - healthy;
  const uptimeRate = total > 0 ? Math.round((healthy / total) * 100) : 0;
  const latencies = checks
    .filter((c) => c.durationMs != null)
    .map((c) => c.durationMs!);
  const avgLatency =
    latencies.length > 0 ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length) : null;

  // Take the most recent N for the history chart
  const history = checks.slice(0, historyLimit).reverse().map((c) => ({
    id: c.id,
    endpoint_id: c.webhookEndpointId,
    status: c.status,
    status_code: c.statusCode,
    duration_ms: c.durationMs,
    error: c.error,
    triggered_by: c.triggeredBy,
    checked_at: c.checkedAt.toISOString(),
  }));

  return {
    endpoint_id: endpointId,
    total_checks: total,
    healthy_checks: healthy,
    unhealthy_checks: unhealthy,
    uptime_rate: uptimeRate,
    avg_latency_ms: avgLatency,
    last_check_at: ep.lastTriggeredAt?.toISOString() ?? null,
    last_status: ep.lastStatus,
    history,
  };
}

export async function getAllEndpointUptimeStats(
  workspaceId: string,
  historyLimit = 50
): Promise<EndpointUptimeStats[]> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { workspaceId },
    select: { id: true },
  });

  const stats: EndpointUptimeStats[] = [];
  for (const ep of endpoints) {
    const s = await getEndpointUptimeStats(workspaceId, ep.id, historyLimit);
    if (s) stats.push(s);
  }
  return stats;
}

// ─── SLA Status per endpoint ─────────────────────────────────

export interface EndpointSlaStatus {
  endpoint_id: string;
  endpoint_label: string;
  endpoint_url: string;
  is_active: boolean;
  uptime_rate: number; // 0-100 over last 10 checks
  healthy_checks: number;
  total_checks: number;
  breached: boolean; // uptime_rate < threshold
  threshold: number; // effective threshold (override ?? workspace)
  has_threshold_override: boolean; // true if endpoint has its own threshold
  last_check_at: string | null;
  last_status: string | null;
}

const SLA_WINDOW = 10;
const DEFAULT_SLA_THRESHOLD = 90;

export async function getEndpointSlaStatuses(workspaceId: string): Promise<EndpointSlaStatus[]> {
  // Fetch the workspace's configured SLA threshold
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { slaThreshold: true },
  });
  const workspaceThreshold = ws?.slaThreshold ?? DEFAULT_SLA_THRESHOLD;

  const endpoints = await db.webhookEndpoint.findMany({
    where: { workspaceId },
    select: {
      id: true,
      label: true,
      url: true,
      isActive: true,
      lastTriggeredAt: true,
      lastStatus: true,
      slaThresholdOverride: true,
    },
  });

  const results: EndpointSlaStatus[] = [];
  for (const ep of endpoints) {
    // Per-endpoint override ?? workspace default
    const threshold = ep.slaThresholdOverride ?? workspaceThreshold;
    const hasOverride = ep.slaThresholdOverride != null;

    const checks = await db.endpointHealthCheck.findMany({
      where: { webhookEndpointId: ep.id },
      orderBy: { checkedAt: 'desc' },
      take: SLA_WINDOW,
      select: { status: true },
    });

    const total = checks.length;
    const healthy = checks.filter((c) => c.status === 'healthy').length;
    const uptimeRate = total > 0 ? Math.round((healthy / total) * 100) : 100;
    // Only flag as breached if we have at least 3 checks (need enough data)
    const breached = total >= 3 && uptimeRate < threshold;

    results.push({
      endpoint_id: ep.id,
      endpoint_label: ep.label,
      endpoint_url: ep.url,
      is_active: ep.isActive,
      uptime_rate: uptimeRate,
      healthy_checks: healthy,
      total_checks: total,
      breached,
      threshold,
      has_threshold_override: hasOverride,
      last_check_at: ep.lastTriggeredAt?.toISOString() ?? null,
      last_status: ep.lastStatus,
    });
  }
  return results;
}
