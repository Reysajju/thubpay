import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/dashboard/settings/gateways
 * Fetch all gateways for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { data: gateways, error } = await admin
      .from('gateway_credentials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch gateways' },
        { status: 500 }
      );
    }

    return NextResponse.json({ gateways: gateways || [] });
  } catch (error) {
    console.error('Error fetching gateways:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gateways' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/settings/gateways
 * Add a new gateway
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, gateway_slug, key_type, key_value, mode } = body;

    if (!workspace_id || !gateway_slug || !key_type || !key_value || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: gateway, error } = await admin
      .from('gateway_credentials')
      .insert({
        workspace_id,
        gateway_slug,
        type: 'api_key',
        key_type,
        key_value,
        mode,
        is_default: false
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to add gateway' },
        { status: 500 }
      );
    }

    return NextResponse.json({ gateway });
  } catch (error) {
    console.error('Error adding gateway:', error);
    return NextResponse.json(
      { error: 'Failed to add gateway' },
      { status: 500 }
    );
  }
}