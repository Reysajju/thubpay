import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/dashboard/settings/notifications
 * Fetch notification preferences for a workspace
 */
export async function GET(request: NextRequest) {
  try {
    const { data: preferences, error } = await admin
      .from('notification_preferences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch notification preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ notification_preferences: preferences || [] });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dashboard/settings/notifications
 * Create notification preference
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace_id, user_id, channel, event_type, is_enabled = true } = body;

    if (!workspace_id || !user_id || !channel || !event_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data: preference, error } = await admin
      .from('notification_preferences')
      .insert({
        workspace_id,
        user_id,
        channel,
        event_type,
        is_enabled
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create notification preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ notification_preference: preference });
  } catch (error) {
    console.error('Error creating notification preference:', error);
    return NextResponse.json(
      { error: 'Failed to create notification preference' },
      { status: 500 }
    );
  }
}
