create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'billing')),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  primary key (workspace_id, user_id)
);

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  primary_color text not null default '#7A5A2B',
  icon_url text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  name text not null,
  email text,
  company text,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand_id uuid references brands(id) on delete set null,
  client_id uuid not null references clients(id) on delete cascade,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  currency text not null default 'usd',
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  due_date date,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists payment_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  provider text not null default 'stripe',
  external_url text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'paid')),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists cash_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  direction text not null check (direction in ('incoming', 'outgoing')),
  amount_cents integer not null,
  note text,
  occurred_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table brands enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table payment_links enable row level security;
alter table cash_ledger enable row level security;

create policy "workspace members can select workspace"
  on workspaces for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
    )
  );

create policy "owners can update workspace"
  on workspaces for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin')
    )
  );

create policy "members can view workspace members"
  on workspace_members for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid()
    )
  );

create policy "admins can manage workspace members"
  on workspace_members for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin')
    )
  );

create policy "members can view brands"
  on brands for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = brands.workspace_id and wm.user_id = auth.uid()
    )
  );

create policy "admins can manage brands"
  on brands for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = brands.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin')
    )
  );

create policy "members can view clients"
  on clients for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = clients.workspace_id and wm.user_id = auth.uid()
    )
  );

create policy "members can manage clients"
  on clients for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = clients.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin', 'member')
    )
  );

create policy "members can view invoices"
  on invoices for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = invoices.workspace_id and wm.user_id = auth.uid()
    )
  );

create policy "members can manage invoices"
  on invoices for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = invoices.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin', 'member', 'billing')
    )
  );

create policy "members can view payment links"
  on payment_links for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = payment_links.workspace_id and wm.user_id = auth.uid()
    )
  );

create policy "billing can manage payment links"
  on payment_links for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = payment_links.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin', 'billing')
    )
  );

create policy "members can view cash ledger"
  on cash_ledger for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = cash_ledger.workspace_id and wm.user_id = auth.uid()
    )
  );

create policy "billing can manage cash ledger"
  on cash_ledger for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = cash_ledger.workspace_id and wm.user_id = auth.uid() and wm.role in ('owner', 'admin', 'billing')
    )
  );

create or replace function public.bootstrap_workspace_for_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
  default_name text;
begin
  default_name := coalesce(new.full_name, 'My Startup') || ' Workspace';

  insert into public.workspaces (owner_user_id, name, slug, plan)
  values (new.id, default_name, lower(replace(new.id::text, '-', '')), 'free')
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_workspace_bootstrap_created on public.users;
create trigger on_workspace_bootstrap_created
  after insert on public.users
  for each row execute procedure public.bootstrap_workspace_for_new_user();
