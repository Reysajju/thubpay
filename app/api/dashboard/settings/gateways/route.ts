import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { encryptField } from '@/lib/encryption';

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

    // Mask sensitive keys before returning to client UI to ensure upper-level security
    const safeGateways = (gateways || []).map(g => ({
      ...g,
      key_value: '••••••••••••••••••••'
    }));

    return NextResponse.json({ gateways: safeGateways });
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
    // Front-end UI passes api_key and secret_key inside the payload
    const { workspace_id, gateway_slug, api_key, secret_key, mode } = body;

    if (!workspace_id || !gateway_slug || !api_key) {
      return NextResponse.json(
        { error: 'Missing required configuration keys' },
        { status: 400 }
      );
    }

    // Serialize keys as JSON and heavily encrypt before database transit
    const keyData = JSON.stringify({ api_key, secret_key: secret_key || '' });
    const secureEncryptedPayload = await encryptField(keyData);

    const { data: gateway, error } = await admin
      .from('gateway_credentials')
      .upsert({
        workspace_id,
        gateway_slug,
        type: 'api_key',
        key_type: 'secret',
        key_value: secureEncryptedPayload,
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
