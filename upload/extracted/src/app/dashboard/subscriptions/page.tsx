import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import SubscriptionsClient from './SubscriptionsClient';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  return <SubscriptionsClient workspaceId={workspaceId} />;
}
