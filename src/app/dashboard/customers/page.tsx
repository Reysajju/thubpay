import { redirect } from 'next/navigation';
import { requireWorkspace } from '@/lib/dashboard-auth';
import { getClients } from '@/lib/demo-data';
import ClientsTableClient from './ClientsTableClient';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const ctx = await requireWorkspace();
  if (!ctx.ok) {
    redirect('/signin');
    return;
  }
  const { workspaceId } = ctx.context;

  const allClients = await getClients(workspaceId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const newThisMonth = allClients.filter(c => new Date(c.created_at) >= monthStart).length;
  const totalSpend = allClients.reduce((s, c) => s + (c.total_spend_cents || 0), 0);
  const repeatClients = allClients.filter(c => (c.transaction_count || 0) > 1).length;

  return (
    <ClientsTableClient
      clients={allClients.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company: c.company,
        total_spend_cents: c.total_spend_cents,
        transaction_count: c.transaction_count,
        last_payment_at: null,
        created_at: c.created_at,
      }))}
      stats={{
        total: allClients.length,
        newThisMonth,
        repeatClients,
        totalSpend
      }}
    />
  );
}
