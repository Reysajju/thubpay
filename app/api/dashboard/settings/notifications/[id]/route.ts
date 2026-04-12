import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * PATCH /api/dashboard/settings/notifications/[id]
 * Update notification preference
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { is_enabled } = body;

    const { error } = await admin
      .from('notification_preferences')
      .update({ is_enabled })
      .eq('id', params.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update notification preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification preference:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preference' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/settings/notifications/[id]
 * Delete notification preference
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await admin
      .from('notification_preferences')
      .delete()
      .eq('id', params.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to delete notification preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification preference:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification preference' },
      { status: 500 }
    );
  }
}