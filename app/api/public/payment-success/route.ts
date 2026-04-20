import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16'
});

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Public API endpoint to verify a Stripe payment
 * GET /api/public/payment-success?session_id={session_id} OR ?payment_intent={payment_intent_id}
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');
    const paymentIntentId = searchParams.get('payment_intent');

    if (!sessionId && !paymentIntentId) {
      return NextResponse.json(
        { error: 'Missing session_id or payment_intent parameter' },
        { status: 400 }
      );
    }

    let paymentData: any = null;

    if (paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!intent || intent.status !== 'succeeded') {
        return NextResponse.json(
          { error: 'Payment Intent not found or not successful' },
          { status: 404 }
        );
      }

      // Mark the associated invoice as paid directly
      if (intent.metadata?.invoice_id) {
        await admin
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', intent.metadata.invoice_id);
      }

      paymentData = {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency?.toUpperCase() || '',
        status: intent.status,
        created_at: intent.created
      };

    } else if (sessionId) {
      // Legacy Checkout Session path
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (!session || session.payment_status !== 'paid') {
        return NextResponse.json(
          { error: 'Payment Session not found or not completed' },
          { status: 404 }
        );
      }

      if (session.metadata?.invoice_id) {
        await admin
          .from('invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .eq('id', session.metadata.invoice_id);
      }

      paymentData = {
        id: session.id,
        amount: session.amount_total,
        currency: session.currency?.toUpperCase() || '',
        status: session.payment_status,
        created_at: session.created
      };
    }

    // Return structured details for the UI receipt
    return NextResponse.json({
      success: true,
      payment: paymentData
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
