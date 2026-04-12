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
 * Public API endpoint to create a Stripe Checkout session for a payment link
 * POST /api/public/pay
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentLinkId, amount, currency, description } = body;

    if (!paymentLinkId || !amount || !currency) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch payment link from database
    const { data: paymentLink, error } = await admin
      .from('payment_links')
      .select('*')
      .eq('id', paymentLinkId)
      .single();

    if (error || !paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    // Check if payment link is valid
    if (paymentLink.status !== 'active') {
      return NextResponse.json(
        { error: 'Payment link is not active' },
        { status: 400 }
      );
    }

    if (new Date(paymentLink.expires_at!) < new Date()) {
      return NextResponse.json(
        { error: 'Payment link has expired' },
        { status: 400 }
      );
    }

    if (paymentLink.current_uses >= paymentLink.max_uses!) {
      return NextResponse.json(
        { error: 'Payment link has reached maximum uses' },
        { status: 400 }
      );
    }

    // Get workspace details for branding
    const { data: workspace } = await admin
      .from('workspaces')
      .select('id, brands(*)')
      .eq('id', paymentLink.workspace_id)
      .single();

    const workspaceBrand = workspace?.brands[0];
    const companyName = workspaceBrand?.name || 'Payment';

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description || 'Payment',
              description: companyName,
              images: workspaceBrand?.logo_url ? [workspaceBrand.logo_url] : undefined
            },
            unit_amount: amount,
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/success?session_id={CHECKOUT_SESSION_ID}&paymentLinkId=${paymentLinkId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/cancel?paymentLinkId=${paymentLinkId}`,
      metadata: {
        payment_link_id: paymentLinkId,
        workspace_id: paymentLink.workspace_id
      }
    });

    // Update payment link usage
    await admin
      .from('payment_links')
      .update({
        current_uses: admin.sql`current_uses + 1`,
        last_used_at: new Date().toISOString()
      })
      .eq('id', paymentLinkId);

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create payment session' },
      { status: 500 }
    );
  }
}