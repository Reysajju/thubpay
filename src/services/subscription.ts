import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface SubscriptionPlan {
  id: string;
  workspace_id: string;
  name: string;
  amount_cents: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  trial_days: number;
  is_active: boolean;
}

interface SubscriptionData {
  id: string;
  workspace_id: string;
  plan_id?: string;
  client_id?: string;
  gateway_slug?: string;
  gateway_subscription_id?: string;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
}

interface CreateSubscriptionInput {
  workspaceId: string;
  planId: string;
  clientId: string;
  gatewaySlug: string;
}

/**
 * Create a subscription plan
 */
export async function createSubscriptionPlan(data: {
  workspaceId: string;
  name: string;
  amountCents: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  trialDays: number;
}): Promise<SubscriptionPlan> {
  const { data: plan, error } = await admin
    .from('subscription_plans')
    .insert({
      workspace_id: data.workspaceId,
      name: data.name,
      amount_cents: data.amountCents,
      currency: data.currency,
      interval: data.interval,
      trial_days: data.trialDays,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create subscription plan: ${error.message}`);
  }

  return plan as SubscriptionPlan;
}

/**
 * Get subscription plans for workspace
 */
export async function getSubscriptionPlans(workspaceId: string): Promise<SubscriptionPlan[]> {
  const { data: plans } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('amount_cents', { ascending: true });

  return plans || [];
}

/**
 * Create a subscription for a client
 */
export async function createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionData> {
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('id', input.planId)
    .single();

  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const { data: subscription, error } = await admin
    .from('subscriptions')
    .insert({
      workspace_id: input.workspaceId,
      plan_id: input.planId,
      client_id: input.clientId,
      gateway_slug: input.gatewaySlug,
      status: 'trialing',
      current_period_start: new Date().toISOString(),
      cancel_at_period_end: false
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return subscription as SubscriptionData;
}

/**
 * Get client subscription
 */
export async function getClientSubscription(clientId: string): Promise<SubscriptionData | null> {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*')
    .eq('client_id', clientId)
    .in('status', ['active', 'trialing', 'past_due'])
    .single();

  return subscription || null;
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(clientId: string): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .update({
      cancel_at_period_end: true
    })
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
}

/**
 * Reactivate subscription
 */
export async function reactivateSubscription(clientId: string): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .update({
      cancel_at_period_end: false,
      status: 'active'
    })
    .eq('client_id', clientId);

  if (error) {
    throw new Error(`Failed to reactivate subscription: ${error.message}`);
  }
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  clientId: string,
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .update({ status })
    .eq('client_id', clientId)
    .eq('cancel_at_period_end', false);

  if (error) {
    throw new Error(`Failed to update subscription status: ${error.message}`);
  }
}

/**
 * Get upcoming renewal date
 */
export function getUpcomingRenewalDate(subscription: SubscriptionData): Date | null {
  if (!subscription.current_period_end) {
    return null;
  }

  const renewalDate = new Date(subscription.current_period_end);

  // If canceled, check when period ends
  if (subscription.cancel_at_period_end) {
    return renewalDate;
  }

  return renewalDate;
}

/**
 * Check if subscription is eligible for dunning retry
 */
export function isEligibleForDunningRetry(subscription: SubscriptionData): boolean {
  return subscription.status === 'past_due' || subscription.status === 'unpaid';
}

/**
 * Handle failed payment for subscription
 */
export async function handleFailedSubscriptionPayment(subscriptionId: string): Promise<void> {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  // Update status
  await admin
    .from('subscriptions')
    .update({
      status: 'past_due'
    })
    .eq('id', subscriptionId);

  // Trigger dunning email sequence
  await sendDunningEmail(subscription.client_id!, subscriptionId);
}

/**
 * Handle successful payment for subscription
 */
export async function handleSuccessfulSubscriptionPayment(subscriptionId: string): Promise<void> {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('interval')
    .eq('id', subscription.plan_id!)
    .single();

  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  // Update period dates based on interval
  const now = new Date();
  let nextPeriodStart = new Date();

  switch (plan.interval) {
    case 'day':
      nextPeriodStart.setDate(now.getDate() + 1);
      break;
    case 'week':
      nextPeriodStart.setDate(now.getDate() + 7);
      break;
    case 'month':
      nextPeriodStart.setMonth(now.getMonth() + 1);
      break;
    case 'year':
      nextPeriodStart.setFullYear(now.getFullYear() + 1);
      break;
  }

  const nextPeriodEnd = new Date(nextPeriodStart);
  switch (plan.interval) {
    case 'day':
      nextPeriodEnd.setDate(now.getDate() + 1);
      break;
    case 'week':
      nextPeriodEnd.setDate(now.getDate() + 7);
      break;
    case 'month':
      nextPeriodEnd.setMonth(now.getMonth() + 1);
      break;
    case 'year':
      nextPeriodEnd.setFullYear(now.getFullYear() + 1);
      break;
  }

  // Update subscription
  await admin
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: nextPeriodStart.toISOString(),
      current_period_end: nextPeriodEnd.toISOString()
    })
    .eq('id', subscriptionId);

  // Send renewal notification
  await sendRenewalEmail(subscription.client_id!, subscriptionId);
}

/**
 * Send dunning email sequence
 */
async function sendDunningEmail(clientId: string, subscriptionId: string): Promise<void> {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('client_id, plan_id, metadata')
    .eq('id', subscriptionId)
    .single();

  if (!subscription) return;

  const dunningAttempts = ((subscription.metadata as any)?.dunning_attempts as number) || 0;

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('amount_cents, currency')
    .eq('id', subscription.plan_id)
    .single();

  if (!plan) return;

  if (dunningAttempts >= 3) {
    // Final dunning email - cancel subscription
    await cancelSubscription(clientId);
    await updateSubscriptionStatus(clientId, 'unpaid');
    return;
  }

  // Send dunning email
  await admin
    .from('notifications')
    .insert({
      type: 'subscription_payment_failed',
      title: 'Payment Failed',
      message: `Your subscription payment of ${plan.amount_cents / 100} ${plan.currency} failed.`,
      channel: 'email',
      user_id: clientId,
      workspace_id: '', // Get from context
      metadata: {
        subscription_id: subscriptionId,
        dunning_attempts: dunningAttempts + 1,
        retry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
}

/**
 * Send renewal notification
 */
async function sendRenewalEmail(clientId: string, subscriptionId: string): Promise<void> {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('plan_id')
    .eq('id', subscriptionId)
    .single();

  if (!subscription) return;

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('name, amount_cents, currency')
    .eq('id', subscription.plan_id)
    .single();

  if (!plan) return;

  await admin
    .from('notifications')
    .insert({
      type: 'subscription_renewed',
      title: 'Subscription Renewed',
      message: `Your subscription to ${plan.name} has been renewed for ${plan.amount_cents / 100} ${plan.currency}.`,
      channel: 'email',
      user_id: clientId,
      workspace_id: '',
      metadata: { subscription_id: subscriptionId }
    });
}

/**
 * Get subscription statistics
 */
export async function getSubscriptionStatistics(workspaceId: string): Promise<{
  total_subscribers: number;
  active: number;
  past_due: number;
  canceled: number;
  total_revenue: number;
}> {
  const { data: subscriptions } = await admin
    .from('subscriptions')
    .select('status')
    .eq('workspace_id', workspaceId);

  const active = subscriptions?.filter((s) => s.status === 'active').length || 0;
  const past_due = subscriptions?.filter((s) => s.status === 'past_due').length || 0;
  const canceled = subscriptions?.filter((s) => s.status === 'canceled').length || 0;
  const total_subscribers = subscriptions?.length || 0;

  // Calculate revenue
  const { data: planIds } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('workspace_id', workspaceId);

  const planIdsArray = planIds?.map((p) => p.id) || [];
  const { data: plans } = await admin
    .from('subscription_plans')
    .select('amount_cents')
    .in('id', planIdsArray);

  const total_revenue = plans?.reduce((sum, p) => sum + p.amount_cents, 0) || 0;

  return {
    total_subscribers,
    active,
    past_due,
    canceled,
    total_revenue
  };
}

/**
 * Check if a payment retry is due
 */
export async function checkDunningRetry(
  subscriptionId: string,
  retryDay: number
): Promise<boolean> {
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('current_period_end, status, metadata')
    .eq('id', subscriptionId)
    .single();

  if (!subscription || subscription.status !== 'past_due') {
    return false;
  }

  if (!subscription.current_period_end) {
    return false;
  }

  const periodEnd = new Date(subscription.current_period_end);
  const daysUntilEnd = Math.floor(
    (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return daysUntilEnd === retryDay;
}

/**
 * Mark subscription for cancellation at period end
 */
export async function scheduleCancellation(clientId: string): Promise<void> {
  const { error } = await admin
    .from('subscriptions')
    .update({
      cancel_at_period_end: true
    })
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to schedule cancellation: ${error.message}`);
  }
}

/**
 * Get auto-cancelled subscriptions
 */
export async function getAutoCancelledSubscriptions(): Promise<SubscriptionData[]> {
  const { data: subscriptions } = await admin
    .from('subscriptions')
    .select('*')
    .eq('cancel_at_period_end', true)
    .in('status', ['active', 'trialing']);

  return subscriptions || [];
}
