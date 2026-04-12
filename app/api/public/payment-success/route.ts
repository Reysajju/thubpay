import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20'
});

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Public API endpoint to verify a Stripe payment
 * GET /api/public/payment-success?session_id={session_id}
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not found or not completed' },
        { status: 404 }
      );
    }

    // Update payment link if payment completed
    if (session.metadata?.payment_link_id) {
      await admin
        .from('payment_links')
        .update({
          status: 'paid',
          last_used_at: new Date().toISOString()
        })
        .eq('id', session.metadata.payment_link_id);
    }

    // Return payment details
    return NextResponse.json({
      success: true,
      payment: {
        id: session.id,
        amount: session.amount_total,
        currency: session.currency.toUpperCase(),
        status: session.payment_status,
        created_at: session.created,
        completed_at: session.payment_intent_created
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}