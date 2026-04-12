import Stripe from 'stripe';
import { stripe } from '@/utils/stripe/config';
import { createClient } from '@supabase/supabase-js';
import {
  upsertProductRecord,
  upsertPriceRecord,
  manageSubscriptionStatusChange,
  deleteProductRecord,
  deletePriceRecord
} from '@/utils/supabase/admin';
import { sendPaidReceiptEmail } from '@/utils/mailer';
import { getURL } from '@/utils/helpers';

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'product.deleted',
  'price.created',
  'price.updated',
  'price.deleted',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted'
]);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;

  try {
    if (!sig || !webhookSecret)
      return new Response('Webhook secret not found.', { status: 400 });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    console.log(`🔔  Webhook received: ${event.type}`);
  } catch (err: any) {
    console.log(`❌ Error message: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case 'product.created':
        case 'product.updated':
          await upsertProductRecord(event.data.object as Stripe.Product);
          break;
        case 'price.created':
        case 'price.updated':
          await upsertPriceRecord(event.data.object as Stripe.Price);
          break;
        case 'price.deleted':
          await deletePriceRecord(event.data.object as Stripe.Price);
          break;
        case 'product.deleted':
          await deleteProductRecord(event.data.object as Stripe.Product);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          const subscription = event.data.object as Stripe.Subscription;
          await manageSubscriptionStatusChange(
            subscription.id,
            subscription.customer as string,
            event.type === 'customer.subscription.created'
          );
          break;
        case 'checkout.session.completed':
          const checkoutSession = event.data.object as Stripe.Checkout.Session;
          if (checkoutSession.mode === 'subscription') {
            const subscriptionId = checkoutSession.subscription;
            await manageSubscriptionStatusChange(
              subscriptionId as string,
              checkoutSession.customer as string,
              true
            );
          }
          if (checkoutSession.mode === 'payment') {
            const invoiceId = checkoutSession.metadata?.invoice_id;
            const workspaceId = checkoutSession.metadata?.workspace_id;
            
            if (invoiceId && workspaceId && checkoutSession.payment_status === 'paid') {
              const admin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                process.env.SUPABASE_SERVICE_ROLE_KEY || ''
              );
              
              const { data: invoice } = await admin
                .from('invoices')
                .select('*, brands(name), clients(email)')
                .eq('id', invoiceId)
                .single();

              if (!invoice) break;

              const amountPaid = checkoutSession.amount_total ?? 0;

              // 1. Update invoice status & balance
              await admin.from('invoices').update({ 
                status: 'paid',
                paid_at: new Date().toISOString(),
                balance_due_cents: 0
              }).eq('id', invoiceId);

              // 2. Mark payment link as paid
              await admin
                .from('payment_links')
                .update({ status: 'paid' })
                .eq('invoice_id', invoiceId)
                .eq('status', 'active');

              // 3. Record receipt
              await admin.from('payment_receipts').insert({
                 invoice_id: invoiceId,
                 amount_paid_cents: amountPaid,
                 balance_remaining_cents: 0,
                 gateway: 'stripe',
                 gateway_tx_id: checkoutSession.payment_intent as string | undefined,
                 paid_at: new Date().toISOString()
              });

              // 4. Record cash ledger
              if (invoice.total_cents) {
                await admin.from('cash_ledger').insert({
                  workspace_id: workspaceId,
                  invoice_id: invoiceId,
                  direction: 'incoming',
                  amount_cents: amountPaid,
                  note: 'Stripe checkout payment settled'
                });
              }

              // 5. Send receipt email
              const clientEmail = checkoutSession.customer_details?.email || invoice.clients?.email;
              if (clientEmail) {
                 await sendPaidReceiptEmail({
                    to: clientEmail,
                    invoiceNumber: invoice.invoice_number,
                    brandName: invoice.brands?.name || 'ThubPay',
                    amountPaidCents: amountPaid,
                    paymentUrl: getURL(`/pay/${invoiceId}`)
                 });
              }
            }
          }
          break;
        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      console.log(error);
      return new Response(
        'Webhook handler failed. View your Next.js function logs.',
        {
          status: 400
        }
      );
    }
  } else {
    return new Response(`Unsupported event type: ${event.type}`, {
      status: 400
    });
  }
  return new Response(JSON.stringify({ received: true }));
}
