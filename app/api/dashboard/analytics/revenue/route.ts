import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/dashboard/analytics/revenue
 * Get revenue data for analytics
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

    // Get revenue data grouped by day
    const { data: transactions, error } = await admin
      .from('transactions')
      .select('amount_cents, created_at, status, currency')
      .eq('status', 'succeeded')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString());

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch revenue data' },
        { status: 500 }
      );
    }

    // Group by date
    const grouped: Record<string, number> = {};
    transactions?.forEach((t) => {
      const date = new Date(t.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      grouped[date] = (grouped[date] || 0) + t.amount_cents;
    });

    // Convert to array and sort
    const revenueData = Object.keys(grouped)
      .sort()
      .map((date) => ({
        date,
        amount: grouped[date]
      }));

    return NextResponse.json({ revenue: revenueData });
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue data' },
      { status: 500 }
    );
  }
}
