import { createClient as createAdminClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Stripe Connect Platform Setup
 *
 * This module handles the platform account setup and connected accounts
 * for marketplace-style payments where sub-merchants are onboarded.
 */

interface PlatformConfig {
  platformAccount: string;
  platformCapabilities: {
    transfers: boolean;
    cardPayments: boolean;
    platformFunding: boolean;
  };
}

/**
 * Create a new platform account in Stripe Connect
 */
export async function createPlatformAccount(): Promise<Stripe.Account> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const platformAccount = await stripe.accounts.create({
    type: 'platform',
    country: 'US',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    business_type: 'company',
    business_profile: {
      url: process.env.NEXT_PUBLIC_APP_URL || 'https://app.thubpay.com'
    }
  });

  console.log('Platform account created:', platformAccount.id);
  return platformAccount;
}

/**
 * Create a connected account for a merchant/sub-merchant
 */
export async function createConnectedAccount(
  workspaceId: string,
  merchantEmail: string,
  businessName: string
): Promise<{
  stripeAccountId: string;
  verificationUrl: string;
}> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const connectedAccount = await stripe.accounts.create({
    type: 'express', // or 'standard' or 'custom'
    country: 'US',
    email: merchantEmail,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    business_type: 'company',
    business_profile: {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/brand/${workspaceId}`,
      mcc: '5734' // Payment processing
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '127.0.0.1' // In production, get from request
    }
  });

  // Generate account onboarding URL
  const accountLink = await stripe.accountLinks.create({
    account: connectedAccount.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/brand/${workspaceId}/connect`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/brand/${workspaceId}/connect?success=true`,
    type: 'account_onboarding'
  });

  await admin
    .from('gateway_credentials')
    .insert({
      workspace_id: workspaceId,
      gateway_slug: 'stripe',
      type: 'stripe_connect',
      key_type: 'account_id',
      key_value: connectedAccount.id,
      webhook_secret: '',
      mode: 'live',
      is_default: true
    });

  return {
    stripeAccountId: connectedAccount.id,
    verificationUrl: accountLink.url
  };
}

/**
 * Get the Onboarding URL for a connected account
 */
export async function getOnboardingUrl(
  workspaceId: string
): Promise<string | null> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const { data: credentials } = await admin
    .from('gateway_credentials')
    .select('key_value')
    .eq('workspace_id', workspaceId)
    .eq('gateway_slug', 'stripe')
    .eq('type', 'stripe_connect')
    .single();

  if (!credentials) {
    return null;
  }

  const accountLink = await stripe.accountLinks.create({
    account: credentials.key_value,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/brand/${workspaceId}/connect`,
    return_url: `${process_env.NEXT_PUBLIC_APP_URL}/dashboard/brand/${workspaceId}/connect?success=true`,
    type: 'account_onboarding'
  });

  return accountLink.url;
}

/**
 * Create a charge on behalf of a connected account
 */
export async function chargeOnBehalfOfConnectedAccount(
  stripeAccountId: string,
  amountCents: number,
  currency: string,
  capture: boolean = true
): Promise<Stripe.Charge> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const charge = await stripe.charges.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    source: 'tok_visa', // In production, use stored card token
    capture,
    destination: {
      account: stripeAccountId,
      amount: amountCents, // Can set platform fee here
      transfer_data: {
        destination: stripeAccountId
      }
    },
    metadata: {
      stripe_connect: 'true',
      platform_account: process.env.STRIPE_PLATFORM_ACCOUNT_ID
    }
  });

  return charge;
}

/**
 * Create a payment intent for a connected account
 */
export async function createPaymentIntentForConnectedAccount(
  stripeAccountId: string,
  amountCents: number,
  currency: string
): Promise<Stripe.PaymentIntent> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    payment_method_types: ['card'],
    capture_method: 'automatic',
    application_fee_amount: Math.round(amountCents * 0.025), // 2.5% platform fee
    transfer_data: {
      destination: stripeAccountId
    },
    metadata: {
      stripe_connect: 'true'
    }
  });

  return paymentIntent;
}

/**
 * Create a payout to a connected account
 */
export async function createPayoutToConnectedAccount(
  stripeAccountId: string,
  amountCents: number,
  currency: string
): Promise<Stripe.Payout> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const payout = await stripe.payouts.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    destination: stripeAccountId,
    metadata: {
      stripe_connect: 'true'
    }
  });

  return payout;
}

/**
 * Calculate and retain platform fee for a payment
 */
export function calculatePlatformFee(
  subtotal: number,
  percentage: number = 0.025
): number {
  return Math.round(subtotal * percentage);
}

/**
 * Check connected account status
 */
export async function checkConnectedAccountStatus(
  stripeAccountId: string
): Promise<{
  status: 'active' | 'pending' | 'disabled';
  requirements?: any;
}> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const account = await stripe.accounts.retrieve(stripeAccountId);

  const statusMap: Record<string, 'active' | 'pending' | 'disabled'> = {
    'active': 'active',
    'limited': 'pending',
    'requires_verification': 'pending',
    'deferred': 'pending',
    'disabled': 'disabled'
  };

  return {
    status: statusMap[account.requirements?.currently_due ? 'limited' : 'active'] || 'pending',
    requirements: account.requirements
  };
}

/**
 * Sync connected account balances
 */
export async function syncConnectedAccountBalances(
  stripeAccountId: string
): Promise<{
  available: number;
  reachable: number;
  pending: number;
}> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const balance = await stripe.balance.retrieve({
    stripeAccount: stripeAccountId
  });

  return {
    available: balance.available.reduce((sum, bal) => sum + bal.amount, 0),
    reachable: balance.reachable.reduce((sum, bal) => sum + bal.amount, 0),
    pending: balance.pending.reduce((sum, bal) => sum + bal.amount, 0)
  };
}

/**
 * List all charges for a connected account
 */
export async function listChargesForConnectedAccount(
  stripeAccountId: string,
  limit: number = 10
): Promise<Stripe.Charge[]> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const charges = await stripe.charges.list({
    limit,
    destination: stripeAccountId
  });

  return charges.data;
}

/**
 * Handle platform fee configuration
 */
export async function configurePlatformFee(
  percentage: number
): Promise<Stripe.ApplicationFee> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  // This would typically be set on the platform account
  // For now, we'll return the configuration
  return {
    amount: Math.round(100 * percentage),
    currency: 'usd',
    livemode: false,
    id: 'pf_' + Date.now(),
    object: 'application_fee'
  };
}

/**
 * Get platform financial reports
 */
export async function getPlatformFinancials(
  startDate: string,
  endDate: string
): Promise<any> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
  });

  const reports = await stripe.reports.list({
    type: 'balance_transaction',
    start_date: startDate,
    end_date: endDate
  });

  return reports.data;
}