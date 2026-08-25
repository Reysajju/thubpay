import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import DisputesClient from './DisputesClient';

export const dynamic = 'force-dynamic';

export default async function DisputesPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  return <DisputesClient workspaceId={workspaceId} />;
}
