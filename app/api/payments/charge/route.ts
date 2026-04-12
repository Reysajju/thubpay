import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { routeCharge } from '@/src/services/payment-router';
import { canWriteBilling, getUserRole } from '@/src/services/rbac';
import { writeAuditLog } from '@/src/services/audit-log';

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const tenantId = String(body.tenantId ?? '').trim();
  const amount = Number(body.amount ?? 0);
  const currency = String(body.currency ?? 'usd').trim().toLowerCase();
  const description = String(body.description ?? '').trim();
  const invoiceId = String(body.invoiceId ?? '').trim();
  const gatewayPreference = body.gatewayPreference ? String(body.gatewayPreference) : undefined;

  if (!tenantId || !Number.isFinite(amount) || amount <= 0 || currency.length !== 3) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  const role = await getUserRole(tenantId, user.id);
  if (!canWriteBilling(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await routeCharge({
    tenantId,
    amount: Math.round(amount),
    currency,
    description: description || undefined,
    invoiceId: invoiceId || undefined,
    gatewayPreference: gatewayPreference as any
  });

  await writeAuditLog({
    tenantId,
    userId: user.id,
    action: 'payment.charge.attempted',
    payload: {
      amount,
      currency,
      gateway: result.gateway,
      ok: result.ok,
      status: result.status
    },
    userAgent: req.headers.get('user-agent') ?? undefined
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
