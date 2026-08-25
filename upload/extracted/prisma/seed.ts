// ThubPay Database Seed
// Run with: npx prisma db seed  (or: bun run db:seed)
// Creates demo users + a fully-populated demo workspace.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ThubPay database...');

  // ─── 1. Create the demo admin user ─────────────────────────
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await db.appUser.upsert({
    where: { email: 'admin@thubpay.com' },
    update: { passwordHash },
    create: {
      email: 'admin@thubpay.com',
      name: 'ThubPay Admin',
      passwordHash,
      role: 'owner',
    },
  });
  console.log(`  ✓ Admin user: ${admin.email}`);

  // ─── 2. Create a demo viewer user ──────────────────────────
  const demoPasswordHash = await bcrypt.hash('demo123', 10);
  const demoUser = await db.appUser.upsert({
    where: { email: 'demo@thubpay.com' },
    update: { passwordHash: demoPasswordHash },
    create: {
      email: 'demo@thubpay.com',
      name: 'Demo User',
      passwordHash: demoPasswordHash,
      role: 'member',
    },
  });
  console.log(`  ✓ Demo user: ${demoUser.email}`);

  // ─── 3. Create the demo workspace ──────────────────────────
  const workspace = await db.workspace.upsert({
    where: { slug: 'thubpay-demo' },
    update: { ownerUserId: admin.id },
    create: {
      name: 'ThubPay Demo Workspace',
      slug: 'thubpay-demo',
      ownerUserId: admin.id,
      plan: 'pro',
      baseCurrency: 'USD',
      monthlyTargetCents: 500000,
      onboardingCompleted: true,
    },
  });
  console.log(`  ✓ Workspace: ${workspace.name}`);

  // ─── 4. Link admin to workspace as owner ───────────────────
  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: admin.id },
    },
    update: { role: 'owner' },
    create: { workspaceId: workspace.id, userId: admin.id, role: 'owner' },
  });
  console.log(`  ✓ Membership: admin → workspace`);

  // ─── 5. Link demo user to same workspace ───────────────────
  await db.workspaceMember.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: demoUser.id },
    },
    update: { role: 'member' },
    create: { workspaceId: workspace.id, userId: demoUser.id, role: 'member' },
  });
  console.log(`  ✓ Membership: demo → workspace`);

  // ─── 4. Gateway credentials ────────────────────────────────
  const stripeGateway = await db.gatewayCredential.upsert({
    where: { id: 'gw-stripe-demo' },
    update: {},
    create: {
      id: 'gw-stripe-demo',
      workspaceId: workspace.id,
      gatewaySlug: 'stripe',
      label: 'Stripe (Live)',
      publishableKey: 'pk_live_***demo***',
      mode: 'test',
      isActive: true,
      isDefault: true,
    },
  });

  const paypalGateway = await db.gatewayCredential.upsert({
    where: { id: 'gw-paypal-demo' },
    update: {},
    create: {
      id: 'gw-paypal-demo',
      workspaceId: workspace.id,
      gatewaySlug: 'paypal',
      label: 'PayPal Business',
      publishableKey: 'AX_demo_client_id',
      mode: 'test',
      isActive: true,
      isDefault: false,
    },
  });

  const squareGateway = await db.gatewayCredential.upsert({
    where: { id: 'gw-square-demo' },
    update: {},
    create: {
      id: 'gw-square-demo',
      workspaceId: workspace.id,
      gatewaySlug: 'square',
      label: 'Square Sandbox',
      publishableKey: 'sq0_sandbox_***',
      mode: 'test',
      isActive: false,
      isDefault: false,
    },
  });

  const razorpayGateway = await db.gatewayCredential.upsert({
    where: { id: 'gw-razorpay-demo' },
    update: {},
    create: {
      id: 'gw-razorpay-demo',
      workspaceId: workspace.id,
      gatewaySlug: 'razorpay',
      label: 'Razorpay (Test)',
      publishableKey: 'rzp_test_***demo***',
      mode: 'test',
      isActive: true,
      isDefault: false,
    },
  });

  console.log(`  ✓ Gateways: ${[stripeGateway.label, paypalGateway.label, squareGateway.label, razorpayGateway.label].join(', ')}`);

  // ─── 5. Clients ────────────────────────────────────────────
  const clientSeed = [
    { id: 'cli-001', name: 'Sarah Mitchell', email: 'sarah@designco.com', phone: '+1-555-0101', company: 'Design Co', totalSpendCents: 245000, transactionCount: 8 },
    { id: 'cli-002', name: 'James Rodriguez', email: 'james@techflow.io', phone: '+1-555-0102', company: 'TechFlow', totalSpendCents: 89000, transactionCount: 3 },
    { id: 'cli-003', name: 'Emily Chen', email: 'emily@brightmedia.com', phone: null, company: 'Bright Media', totalSpendCents: 567000, transactionCount: 15 },
    { id: 'cli-004', name: 'Michael Thompson', email: 'michael@legalwise.com', phone: '+1-555-0104', company: 'LegalWise', totalSpendCents: 123400, transactionCount: 5 },
    { id: 'cli-005', name: 'Lisa Park', email: 'lisa@cloudnine.dev', phone: '+1-555-0105', company: 'CloudNine Dev', totalSpendCents: 345000, transactionCount: 11 },
    { id: 'cli-006', name: 'David Kim', email: 'david@nexgen.ai', phone: null, company: 'NexGen AI', totalSpendCents: 678000, transactionCount: 22 },
    { id: 'cli-007', name: 'Rachel Green', email: 'rachel@freshstart.co', phone: '+1-555-0107', company: 'FreshStart', totalSpendCents: 45000, transactionCount: 1 },
    { id: 'cli-008', name: 'Alex Turner', email: 'alex@datastream.io', phone: '+1-555-0108', company: 'DataStream', totalSpendCents: 432000, transactionCount: 14 },
  ];

  for (const c of clientSeed) {
    await db.client.upsert({
      where: { id: c.id },
      update: { workspaceId: workspace.id, ...c, email: c.email!, phone: c.phone },
      create: { workspaceId: workspace.id, ...c, email: c.email!, phone: c.phone },
    });
  }
  console.log(`  ✓ Clients: ${clientSeed.length}`);

  // ─── 6. Invoices ───────────────────────────────────────────
  const invoiceSeed = [
    { id: 'inv-001', invoiceNumber: 'INV-2025-001', clientId: 'cli-001', totalCents: 50000, status: 'paid', dueDate: '2025-02-15', paidViaGateway: 'stripe', customPaymentGateway: 'Stripe', createdAt: '2025-01-15T10:00:00Z', updatedAt: '2025-01-20T14:30:00Z' },
    { id: 'inv-002', invoiceNumber: 'INV-2025-002', clientId: 'cli-002', totalCents: 29000, status: 'paid', dueDate: '2025-03-01', paidViaGateway: 'paypal', customPaymentGateway: 'PayPal', createdAt: '2025-02-01T09:00:00Z', updatedAt: '2025-02-18T11:00:00Z' },
    { id: 'inv-003', invoiceNumber: 'INV-2025-003', clientId: 'cli-003', totalCents: 120000, status: 'paid', dueDate: '2025-03-15', paidViaGateway: 'stripe', customPaymentGateway: 'Stripe', createdAt: '2025-02-10T08:00:00Z', updatedAt: '2025-03-10T16:00:00Z' },
    { id: 'inv-004', invoiceNumber: 'INV-2025-004', clientId: 'cli-004', totalCents: 75000, status: 'sent', dueDate: '2025-04-01', paidViaGateway: null, customPaymentGateway: null, createdAt: '2025-03-01T12:00:00Z', updatedAt: '2025-03-01T12:00:00Z' },
    { id: 'inv-005', invoiceNumber: 'INV-2025-005', clientId: 'cli-005', totalCents: 45000, status: 'viewed', dueDate: '2025-04-10', paidViaGateway: null, customPaymentGateway: null, createdAt: '2025-03-05T10:00:00Z', updatedAt: '2025-03-08T14:00:00Z' },
    { id: 'inv-006', invoiceNumber: 'INV-2025-006', clientId: 'cli-006', totalCents: 200000, status: 'paid', dueDate: '2025-02-28', paidViaGateway: 'stripe', customPaymentGateway: 'Stripe', createdAt: '2025-01-25T09:30:00Z', updatedAt: '2025-02-25T17:00:00Z' },
    { id: 'inv-007', invoiceNumber: 'INV-2025-007', clientId: 'cli-003', totalCents: 85000, status: 'overdue', dueDate: '2025-01-31', paidViaGateway: null, customPaymentGateway: null, createdAt: '2025-01-05T11:00:00Z', updatedAt: '2025-01-05T11:00:00Z' },
    { id: 'inv-008', invoiceNumber: 'INV-2025-008', clientId: 'cli-007', totalCents: 15000, status: 'draft', dueDate: '2025-05-01', paidViaGateway: null, customPaymentGateway: null, createdAt: '2025-03-20T15:00:00Z', updatedAt: '2025-03-20T15:00:00Z' },
    { id: 'inv-009', invoiceNumber: 'INV-2025-009', clientId: 'cli-008', totalCents: 175000, status: 'paid', dueDate: '2025-03-20', paidViaGateway: 'paypal', customPaymentGateway: 'PayPal', createdAt: '2025-02-15T10:00:00Z', updatedAt: '2025-03-15T09:00:00Z' },
    { id: 'inv-010', invoiceNumber: 'INV-2025-010', clientId: 'cli-001', totalCents: 35000, status: 'sent', dueDate: '2025-04-15', paidViaGateway: null, customPaymentGateway: null, createdAt: '2025-03-18T08:00:00Z', updatedAt: '2025-03-18T08:00:00Z' },
    { id: 'inv-011', invoiceNumber: 'INV-2025-011', clientId: 'cli-005', totalCents: 95000, status: 'paid', dueDate: '2025-01-15', paidViaGateway: 'stripe', customPaymentGateway: 'Stripe', createdAt: '2024-12-20T14:00:00Z', updatedAt: '2025-01-10T10:00:00Z' },
    { id: 'inv-012', invoiceNumber: 'INV-2025-012', clientId: 'cli-006', totalCents: 310000, status: 'paid', dueDate: '2024-12-31', paidViaGateway: 'stripe', customPaymentGateway: 'Stripe', createdAt: '2024-12-01T09:00:00Z', updatedAt: '2024-12-28T16:30:00Z' },
  ];

  for (const inv of invoiceSeed) {
    await db.invoice.upsert({
      where: { id: inv.id },
      update: {},
      create: {
        id: inv.id,
        workspaceId: workspace.id,
        clientId: inv.clientId,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        totalCents: inv.totalCents,
        currency: 'USD',
        dueDate: new Date(inv.dueDate),
        paidViaGateway: inv.paidViaGateway,
        customPaymentGateway: inv.customPaymentGateway,
        createdAt: new Date(inv.createdAt),
        updatedAt: new Date(inv.updatedAt),
      },
    });
  }
  console.log(`  ✓ Invoices: ${invoiceSeed.length}`);

  // ─── 7. Transactions (mirror paid invoices) ────────────────
  const txSeed = [
    { id: 'txn-001', invoiceId: 'inv-001', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'pi_demo_001', amountCents: 50000, status: 'succeeded', customerEmail: 'sarah@designco.com', customerName: 'Sarah Mitchell', createdAt: '2025-01-20T14:30:00Z' },
    { id: 'txn-002', invoiceId: 'inv-002', gatewayId: paypalGateway.id, gatewaySlug: 'paypal', externalId: 'PAYID_demo_002', amountCents: 29000, status: 'succeeded', customerEmail: 'james@techflow.io', customerName: 'James Rodriguez', createdAt: '2025-02-18T11:00:00Z' },
    { id: 'txn-003', invoiceId: 'inv-003', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'pi_demo_003', amountCents: 120000, status: 'succeeded', customerEmail: 'emily@brightmedia.com', customerName: 'Emily Chen', createdAt: '2025-03-10T16:00:00Z' },
    { id: 'txn-004', invoiceId: 'inv-006', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'pi_demo_006', amountCents: 200000, status: 'succeeded', customerEmail: 'david@nexgen.ai', customerName: 'David Kim', createdAt: '2025-02-25T17:00:00Z' },
    { id: 'txn-005', invoiceId: 'inv-009', gatewayId: paypalGateway.id, gatewaySlug: 'paypal', externalId: 'PAYID_demo_009', amountCents: 175000, status: 'succeeded', customerEmail: 'alex@datastream.io', customerName: 'Alex Turner', createdAt: '2025-03-15T09:00:00Z' },
    { id: 'txn-006', invoiceId: 'inv-011', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'pi_demo_011', amountCents: 95000, status: 'succeeded', customerEmail: 'lisa@cloudnine.dev', customerName: 'Lisa Park', createdAt: '2025-01-10T10:00:00Z' },
    { id: 'txn-007', invoiceId: 'inv-012', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'pi_demo_012', amountCents: 310000, status: 'succeeded', customerEmail: 'david@nexgen.ai', customerName: 'David Kim', createdAt: '2024-12-28T16:30:00Z' },
    { id: 'txn-008', invoiceId: null, gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'pi_demo_fail_001', amountCents: 75000, status: 'failed', failureReason: 'card_declined', customerEmail: 'michael@legalwise.com', customerName: 'Michael Thompson', createdAt: '2025-03-14T11:00:00Z' },
    { id: 'txn-009', invoiceId: 'inv-004', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'dp_demo_001', amountCents: 75000, status: 'disputed', failureReason: 'Product not received', customerEmail: 'michael@legalwise.com', customerName: 'Michael Thompson', createdAt: '2025-03-20T10:00:00Z' },
    { id: 'txn-010', invoiceId: 'inv-007', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', externalId: 'dp_demo_002', amountCents: 85000, status: 'disputed', failureReason: 'Service not as described', customerEmail: 'emily@brightmedia.com', customerName: 'Emily Chen', createdAt: '2025-03-15T14:00:00Z' },
  ];

  for (const tx of txSeed) {
    await db.transaction.upsert({
      where: { id: tx.id },
      update: {},
      create: {
        id: tx.id,
        workspaceId: workspace.id,
        invoiceId: tx.invoiceId,
        gatewayId: tx.gatewayId,
        gatewaySlug: tx.gatewaySlug,
        externalId: tx.externalId,
        amountCents: tx.amountCents,
        currency: 'USD',
        status: tx.status,
        failureReason: (tx as any).failureReason || null,
        customerEmail: tx.customerEmail,
        customerName: tx.customerName,
        createdAt: new Date(tx.createdAt),
      },
    });
  }
  console.log(`  ✓ Transactions: ${txSeed.length}`);

  // ─── 8. API Keys ───────────────────────────────────────────
  const apiKeys = [
    { id: 'ak-001', name: 'Production API Key', keyPrefix: 'tpk_live_', keyHash: 'hash_demo_live_001', keyMasked: 'tpk_live_4f82...a9c1' },
    { id: 'ak-002', name: 'Test API Key', keyPrefix: 'tpk_test_', keyHash: 'hash_demo_test_002', keyMasked: 'tpk_test_7b31...d2e4' },
  ];
  for (const ak of apiKeys) {
    await db.apiKey.upsert({
      where: { id: ak.id },
      update: {},
      create: {
        id: ak.id,
        tenantId: workspace.id,
        name: ak.name,
        keyPrefix: ak.keyPrefix,
        keyHash: ak.keyHash,
        keyMasked: ak.keyMasked,
        isActive: true,
        lastUsedAt: ak.id === 'ak-001' ? new Date('2025-03-20T15:30:00Z') : new Date('2025-03-19T10:00:00Z'),
      },
    });
  }
  console.log(`  ✓ API Keys: ${apiKeys.length}`);

  // ─── 9. Webhook Events ─────────────────────────────────────
  const webhookSeed = [
    { id: 'we-001', eventType: 'payment_intent.succeeded', gateway: 'stripe', status: 'success', payload: { amount: 50000, currency: 'usd' }, createdAt: '2025-03-20T15:30:00Z' },
    { id: 'we-002', eventType: 'invoice.paid', gateway: 'paypal', status: 'success', payload: { invoice_id: 'INV-2025-009', amount: 175000 }, createdAt: '2025-03-15T09:00:00Z' },
    { id: 'we-003', eventType: 'payment_intent.failed', gateway: 'stripe', status: 'failed', payload: { amount: 75000, error: 'card_declined' }, createdAt: '2025-03-14T11:00:00Z' },
    { id: 'we-004', eventType: 'payment_intent.succeeded', gateway: 'stripe', status: 'success', payload: { amount: 200000, currency: 'usd' }, createdAt: '2025-02-25T17:00:00Z' },
    { id: 'we-005', eventType: 'webhook.verify_failed', gateway: 'paypal', status: 'failed', payload: { reason: 'signature_mismatch' }, createdAt: '2025-02-20T08:00:00Z' },
  ];
  for (const we of webhookSeed) {
    await db.webhookEvent.upsert({
      where: { id: we.id },
      update: {},
      create: {
        id: we.id,
        workspaceId: workspace.id,
        eventType: we.eventType,
        gateway: we.gateway,
        status: we.status,
        payload: JSON.stringify(we.payload),
        createdAt: new Date(we.createdAt),
      },
    });
  }
  console.log(`  ✓ Webhook Events: ${webhookSeed.length}`);

  // ─── 10. Notifications ─────────────────────────────────────
  const notifSeed = [
    { id: 'ntf-001', title: 'Payment received', body: 'Sarah Mitchell paid INV-2025-001 ($500.00)', type: 'payment', createdAt: '2025-01-20T14:30:00Z' },
    { id: 'ntf-002', title: 'Invoice overdue', body: 'INV-2025-007 is now overdue', type: 'warning', createdAt: '2025-02-01T00:00:00Z' },
    { id: 'ntf-003', title: 'New gateway connected', body: 'Razorpay (Test) is now active', type: 'info', createdAt: '2025-03-01T10:00:00Z' },
    { id: 'ntf-004', title: 'Webhook failed', body: 'PayPal webhook signature verification failed', type: 'error', createdAt: '2025-02-20T08:00:00Z' },
  ];
  for (const n of notifSeed) {
    await db.notification.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        workspaceId: workspace.id,
        title: n.title,
        body: n.body,
        type: n.type,
        isRead: false,
        createdAt: new Date(n.createdAt),
      },
    });
  }
  console.log(`  ✓ Notifications: ${notifSeed.length}`);

  // ─── 11. Subscriptions ─────────────────────────────────────
  const subSeed = [
    { id: 'sub-001', clientId: 'cli-003', planName: 'Enterprise Pro', amountCents: 120000, status: 'active', cycle: 'monthly', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', nextBilling: '2025-04-15' },
    { id: 'sub-002', clientId: 'cli-006', planName: 'Growth Plan', amountCents: 75000, status: 'active', cycle: 'monthly', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', nextBilling: '2025-04-01' },
    { id: 'sub-003', clientId: 'cli-005', planName: 'Starter', amountCents: 29000, status: 'active', cycle: 'monthly', gatewayId: paypalGateway.id, gatewaySlug: 'paypal', nextBilling: '2025-04-10' },
    { id: 'sub-004', clientId: 'cli-008', planName: 'Enterprise Pro', amountCents: 120000, status: 'past_due', cycle: 'monthly', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', nextBilling: '2025-03-20' },
    { id: 'sub-005', clientId: 'cli-001', planName: 'Growth Plan', amountCents: 75000, status: 'canceled', cycle: 'quarterly', gatewayId: paypalGateway.id, gatewaySlug: 'paypal', nextBilling: null },
    { id: 'sub-006', clientId: 'cli-004', planName: 'Starter', amountCents: 29000, status: 'active', cycle: 'monthly', gatewayId: stripeGateway.id, gatewaySlug: 'stripe', nextBilling: '2025-04-05' },
  ];
  for (const s of subSeed) {
    await db.subscription.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        workspaceId: workspace.id,
        clientId: s.clientId,
        planName: s.planName,
        amountCents: s.amountCents,
        status: s.status,
        cycle: s.cycle,
        gatewayId: s.gatewayId,
        gatewaySlug: s.gatewaySlug,
        nextBillingAt: s.nextBilling ? new Date(s.nextBilling) : null,
        canceledAt: s.status === 'canceled' ? new Date('2025-02-15') : null,
      },
    });
  }
  console.log(`  ✓ Subscriptions: ${subSeed.length}`);

  // ─── 12. Automation Rules ──────────────────────────────────
  const ruleSeed = [
    { id: 'rule-001', name: 'Failed Payment Retry', trigger: 'payment_intent.failed', action: 'Retry payment after 24 hours', gatewaySlug: 'stripe', status: 'active', executions: 12, lastRun: '2025-03-20T15:30:00Z' },
    { id: 'rule-002', name: 'Overdue Invoice Reminder', trigger: 'invoice.overdue', action: 'Send reminder email to client', gatewaySlug: null, status: 'active', executions: 8, lastRun: '2025-03-19T10:00:00Z' },
    { id: 'rule-003', name: 'Smart Gateway Fallback', trigger: 'payment_declined', action: 'Route to secondary gateway (PayPal)', gatewaySlug: 'stripe', status: 'active', executions: 5, lastRun: '2025-03-14T11:00:00Z' },
    { id: 'rule-004', name: 'Welcome New Clients', trigger: 'client.created', action: 'Send onboarding email', gatewaySlug: null, status: 'active', executions: 8, lastRun: '2025-03-20T08:00:00Z' },
    { id: 'rule-005', name: 'Monthly Revenue Report', trigger: 'schedule.monthly', action: 'Generate and email revenue summary', gatewaySlug: null, status: 'paused', executions: 3, lastRun: '2025-03-01T08:00:00Z' },
  ];
  for (const r of ruleSeed) {
    await db.automationRule.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id,
        workspaceId: workspace.id,
        name: r.name,
        trigger: r.trigger,
        action: r.action,
        gatewaySlug: r.gatewaySlug,
        status: r.status,
        executions: r.executions,
        lastRunAt: r.lastRun ? new Date(r.lastRun) : null,
      },
    });
  }
  console.log(`  ✓ Automation Rules: ${ruleSeed.length}`);

  // ─── 13. Onboarding Progress (completed for demo) ─────────
  await db.onboardingProgress.upsert({
    where: { workspaceId: workspace.id },
    update: {},
    create: {
      workspaceId: workspace.id,
      stepGateway: true,
      stepBrand: true,
      stepClient: true,
      stepInvoice: true,
      walkthroughSkipped: false,
    },
  });
  console.log(`  ✓ Onboarding: completed (demo workspace)`);

  console.log('\n✅ Seed complete!');
  console.log('   Login: admin@thubpay.com / admin123');
  console.log(`   Workspace: ${workspace.id}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
