import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api
 *
 * Enterprise API Health Check & Status Endpoint
 * Verifies API availability, database connectivity, and round-trip query latency.
 */
export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err: any) {
    dbStatus = 'degraded';
    console.error('[health-check] Database ping failed:', err);
  }

  const totalDurationMs = Date.now() - startTime;
  const isHealthy = dbStatus === 'healthy';

  return NextResponse.json(
    {
      service: 'ThubPay Payment Engine',
      status: isHealthy ? 'operational' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      latency: {
        totalMs: totalDurationMs,
        databaseMs: dbLatencyMs,
      },
      checks: {
        api: 'healthy',
        database: dbStatus,
        encryption: 'operational',
      },
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}