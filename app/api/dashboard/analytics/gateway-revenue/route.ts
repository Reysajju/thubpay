import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/dashboard/analytics/gateway-revenue
 * Get revenue data by gateway for analytics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '30d';

    const now = new Date();
    let startDate = new Date();

    // Calculate date range based on period
    switch (range) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get transactions grouped by gateway
    const { data: transactions, error } = await admin
      .from('transactions')
      .select('amount_cents, gateway_slug, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString());

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch gateway revenue data' },
        { status: 500 }
      );
    }

    // Group by gateway
    const grouped: Record<string, { amount: number; count: number }> = {};

    transactions?.forEach((t) => {
      const gateway = t.gateway_slug || 'unknown';
      if (!grouped[gateway]) {
        grouped[gateway] = { amount: 0, count: 0 };
      }
      grouped[gateway].amount += t.amount_cents;
      grouped[gateway].count += 1;
    });

    // Convert to array
    const gatewayRevenue = Object.keys(grouped).map((gateway) => ({
      gateway,
      amount: grouped[gateway].amount,
      count: grouped[gateway].count
    }));

    return NextResponse.json({ gateway_revenue: gatewayRevenue });
  } catch (error) {
    console.error('Error fetching gateway revenue data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gateway revenue data' },
      { status: 500 }
    );
  }
}
