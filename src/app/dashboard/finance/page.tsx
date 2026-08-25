import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import FinanceClient from './FinanceClient';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  return <FinanceClient workspaceId={workspaceId} />;
}
