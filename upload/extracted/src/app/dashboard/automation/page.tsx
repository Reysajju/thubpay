import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import AutomationClient from './AutomationClient';

export const dynamic = 'force-dynamic';

export default async function AutomationPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  return <AutomationClient workspaceId={workspaceId} />;
}
