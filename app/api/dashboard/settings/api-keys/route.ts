import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/dashboard/settings/api-keys
 * Fetch all API keys for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { data: keys, error } = await admin
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({ api_keys: keys || [] });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/settings/api-keys
 * Generate a new API key
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, name, permissions = ['read', 'write'] } = body;

    if (!workspace_id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate random API key
    const apiKey = crypto.randomBytes(32).toString('hex');

    const { data: key, error } = await admin
      .from('api_keys')
      .insert({
        workspace_id,
        name,
        key_value: apiKey,
        permissions,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to generate API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({ api_key: key });
  } catch (error) {
    console.error('Error generating API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}
