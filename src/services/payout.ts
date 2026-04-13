import { createClient as createAdminClient } from '@supabase/supabase-js';


const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PayoutData {
  id: string;
  workspace_id: string;
  gateway_slug: string;
  amount_cents: number;
  currency: string;
  status: string;
  scheduled_at: string;
  processed_at?: string;
  gateway_payout_id?: string;
}

interface PayoutSettingsData {
  id: string;
  workspace_id: string;
  bank_account_encrypted: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  minimum_amount_cents: number;
  is_active: boolean;
}

/**
 * Calculate available balance for payout
 */
export async function calculatePayoutBalance(
  workspaceId: string,
  gatewaySlug: string
): Promise<number> {
  const { data: transactions } = await admin
    .from('transactions')
    .select('amount_cents, status')
    .eq('workspace_id', workspaceId)
    .eq('gateway_slug', gatewaySlug)
    .eq('status', 'succeeded')
    .gte('payout_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const total = transactions?.reduce((sum, t) => sum + t.amount_cents, 0) || 0;

  return total;
}

/**
 * Check if workspace has minimum threshold
 */
export async function canProcessPayout(
  workspaceId: string,
  minimumAmount: number
): Promise<boolean> {
  const balance = await calculatePayoutBalance(workspaceId, 'stripe');
  return balance >= minimumAmount;
}

/**
 * Create a payout
 */
export async function createPayout(data: {
  workspaceId: string;
  amountCents: number;
  gatewaySlug: string;
  currency?: string;
}): Promise<PayoutData> {
  const { data: payout, error } = await admin
    .from('payouts')
    .insert({
      workspace_id: data.workspaceId,
      gateway_slug: data.gatewaySlug,
      amount_cents: data.amountCents,
      currency: data.currency || 'usd',
      status: 'pending',
      scheduled_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create payout: ${error.message}`);
  }

  return payout as PayoutData;
}

/**
 * Process pending payouts (manual initiation)
 */
export async function processPayout(payoutId: string): Promise<void> {
  const { data: payout } = await admin
    .from('payouts')
    .select('*')
    .eq('id', payoutId)
    .single();

  if (!payout) {
    throw new Error('Payout not found');
  }

  // Update status to in_transit
  await admin
    .from('payouts')
    .update({ status: 'in_transit' })
    .eq('id', payoutId);

  // Initiate payout through gateway
  if (payout.gateway_slug === 'stripe') {
    await initiateStripePayout(payout);
  } else if (payout.gateway_slug === 'paypal') {
    await initiatePayPalPayout(payout);
  } else {
    throw new Error(`Unsupported gateway for payouts: ${payout.gateway_slug}`);
  }
}

/**
 * Process Stripe payout
 */
async function initiateStripePayout(payout: PayoutData): Promise<void> {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const { data: account } = await admin
    .from('gateway_credentials')
    .select('key_value')
    .eq('workspace_id', payout.workspace_id)
    .eq('gateway_slug', 'stripe')
    .eq('type', 'account_id')
    .single();

  if (!account) {
    throw new Error('No Stripe account found');
  }

  const stripePayout = await stripe.payouts.create(
    {
      amount: payout.amount_cents,
      currency: payout.currency,
      destination: account.key_value
    },
    {
      stripeAccount: account.key_value
    }
  );

  // Update payout status
  await admin
    .from('payouts')
    .update({
      status: 'in_transit',
      gateway_payout_id: stripePayout.id,
      processed_at: new Date().toISOString()
    })
    .eq('id', payout.id);

  console.log(`Stripe payout initiated: ${stripePayout.id}`);
}

/**
 * Process PayPal payout
 */
async function initiatePayPalPayout(payout: PayoutData): Promise<void> {
  // PayPal API integration for payouts
  const token = await getPayPalAccessToken();
  const payoutId = `thubpay_payout_${payout.id}`;

  const response = await fetch(
    `https://api-m.sandbox.paypal.com/v2/payments/payouts`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: payoutId,
          email_subject: 'Payout from ThubPay'
        },
        items: [
          {
            amount: {
              currency: payout.currency,
              value: (payout.amount_cents / 100).toFixed(2)
            },
            note: payout.id,
            receiver: 'merchant@example.com' // Replace with actual recipient
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal payout failed: ${error}`);
  }

  // Update payout status
  await admin
    .from('payouts')
    .update({
      status: 'in_transit',
      gateway_payout_id: payoutId,
      processed_at: new Date().toISOString()
    })
    .eq('id', payout.id);

  console.log(`PayPal payout initiated: ${payoutId}`);
}

/**
 * Get payout settings
 */
export async function getPayoutSettings(workspaceId: string): Promise<PayoutSettingsData> {
  const { data: settings } = await admin
    .from('payout_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (!settings) {
    throw new Error('Payout settings not found');
  }

  return settings as PayoutSettingsData;
}

/**
 * Update payout settings
 */
export async function updatePayoutSettings(data: {
  workspaceId: string;
  bankAccountEncrypted: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  minimumAmountCents: number;
  isActive: boolean;
}): Promise<void> {
  const { data: updatedSettings, error } = await admin
    .from('payout_settings')
    .upsert({
      workspace_id: data.workspaceId,
      bank_account_encrypted: data.bankAccountEncrypted,
      schedule: data.schedule,
      minimum_amount_cents: data.minimumAmountCents,
      is_active: data.isActive
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update payout settings: ${error.message}`);
  }
}

/**
 * Get payout history
 */
export async function getPayoutHistory(workspaceId: string, limit: number = 50) {
  const { data: payouts } = await admin
    .from('payouts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return payouts || [];
}

/**
 * Get summary statistics for payouts
 */
export async function getPayoutSummary(workspaceId: string) {
  const { data: payouts } = await admin
    .from('payouts')
    .select('amount_cents, status')
    .eq('workspace_id', workspaceId);

  const totalPaid = payouts
    ?.filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount_cents, 0) || 0;

  const pending = payouts
    ?.filter((p) => p.status === 'pending' || p.status === 'in_transit')
    .reduce((sum, p) => sum + p.amount_cents, 0) || 0;

  const failed = payouts
    ?.filter((p) => p.status === 'failed')
    .reduce((sum, p) => sum + p.amount_cents, 0) || 0;

  return {
    totalPaid,
    pending,
    failed,
    count: payouts?.length || 0
  };
}

/**
 * Get PayPal access token
 */
async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

/**
 * Schedule automatic payouts
 */
export async function scheduleAutomaticPayouts(): Promise<void> {
  const { data: settingsList } = await admin
    .from('payout_settings')
    .select('*')
    .eq('is_active', true);

  if (!settingsList) return;

  for (const settings of settingsList) {
    const balance = await calculatePayoutBalance(settings.workspace_id, 'stripe');

    if (balance >= settings.minimum_amount_cents) {
      // Check if payout already exists for today
      const existingPayout = await admin
        .from('payouts')
        .select('*')
        .eq('workspace_id', settings.workspace_id)
        .eq('status', 'pending')
        .gte('scheduled_at', new Date().toISOString().split('T')[0])
        .single();

      if (!existingPayout) {
        await createPayout({
          workspaceId: settings.workspace_id,
          amountCents: balance,
          gatewaySlug: 'stripe'
        });
      }
    }
  }
}

/**
 * Handle payout success webhook
 */
export async function handlePayoutSuccess(payoutId: string, gatewayPayoutId: string): Promise<void> {
  const { data: payout } = await admin
    .from('payouts')
    .update({
      status: 'paid',
      gateway_payout_id: gatewayPayoutId,
      processed_at: new Date().toISOString()
    })
    .eq('id', payoutId)
    .select('amount_cents, workspace_id')
    .single();

  if (!payout) return;

  // Notify workspace owner
  await admin
    .from('notifications')
    .insert({
      type: 'payout_completed',
      title: 'Payout Completed',
      message: `Your payout of ${(payout.amount_cents || 0) / 100} has been processed successfully.`,
      channel: 'in_app',
      workspace_id: payout.workspace_id,
      metadata: { payout_id: payoutId }
    });
}

/**
 * Handle payout failure webhook
 */
export async function handlePayoutFailure(payoutId: string, error: string): Promise<void> {
  await admin
    .from('payouts')
    .update({
      status: 'failed',
      error_message: error
    })
    .eq('id', payoutId);
}

/**
 * Export payouts to CSV
 */
export async function exportPayoutsToCSV(workspaceId: string): Promise<string> {
  const payouts = await getPayoutHistory(workspaceId, 1000);

  const headers = ['Payout ID', 'Amount', 'Currency', 'Status', 'Date Created', 'Date Processed'];
  const rows = payouts.map((p) => [
    p.id,
    (p.amount_cents / 100).toFixed(2),
    p.currency,
    p.status,
    new Date(p.created_at).toLocaleDateString(),
    p.processed_at ? new Date(p.processed_at).toLocaleDateString() : ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.join(','))
  ].join('\n');

  return csv;
}
