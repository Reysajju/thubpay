import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/dashboard/analytics/success-failure-rate
 * Get success/failure rate for analytics
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

    // Get transaction counts by status
    const { count: succeeded, error: succeededError } = await admin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())
      .eq('status', 'succeeded');

    const { count: failed, error: failedError } = await admin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())
      .eq('status', 'failed');

    const { count: total } = await admin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString());

    if (succeededError || failedError) {
      return NextResponse.json(
        { error: 'Failed to fetch success/failure rates' },
        { status: 500 }
      );
    }

    const succeededCount = succeeded || 0;
    const failedCount = failed || 0;
    const totalCount = total || 0;

    const successRate = totalCount > 0 ? (succeededCount / totalCount) * 100 : 0;
    const failureRate = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;

    return NextResponse.json({
      total: totalCount,
      succeeded: succeededCount,
      failed: failedCount,
      success_rate: successRate.toFixed(2),
      failure_rate: failureRate.toFixed(2)
    });
  } catch (error) {
    console.error('Error fetching success/failure rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch success/failure rates' },
      { status: 500 }
    );
  }
}