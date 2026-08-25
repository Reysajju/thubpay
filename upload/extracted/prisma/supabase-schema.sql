-- ═══════════════════════════════════════════════════════════════
-- ThubPay Database Schema
-- Run this ONCE in your Supabase SQL Editor
-- (Supabase Dashboard → SQL Editor → New Query → Paste → Run)
-- ═══════════════════════════════════════════════════════════════

-- 1. Workspaces
create table if not exists workspaces (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  slug        text unique,
  owner_id    text not null,
  owner_user_id text not null,
  plan        text not null default 'free',
  base_currency text not null default 'USD',
  monthly_target_cents integer default 0,
  logo_url   text,
  onboarding_completed boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Workspace Members
create table if not exists workspace_members (
  id          text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id     text not null,
  role        text not null default 'owner',
  created_at  timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- 3. Clients
create table if not exists clients (
  id                 text primary key default gen_random_uuid()::text,
  workspace_id       text not null references workspaces(id) on delete cascade,
  name               text not null,
  email              text,
  phone              text,
  company            text,
  total_spend_cents  integer not null default 0,
  transaction_count  integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 4. Invoices
create table if not exists invoices (
  id                     text primary key default gen_random_uuid()::text,
  workspace_id           text not null references workspaces(id) on delete cascade,
  client_id              text references clients(id) on delete set null,
  invoice_number         text,
  status                 text not null default 'draft' check (status in ('draft','sent','viewed','paid','overdue','void')),
  total_cents            integer not null default 0,
  currency               text not null default 'USD',
  due_date               date,
  paid_via_gateway       text,
  custom_payment_gateway text,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_invoices_workspace on invoices(workspace_id);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_status on invoices(status);

-- 5. Gateway Credentials
create table if not exists gateway_credentials (
  id               text primary key default gen_random_uuid()::text,
  workspace_id     text not null references workspaces(id) on delete cascade,
  gateway_slug     text not null,
  label            text not null,
  publishable_key  text,
  secret_key_enc   text,
  mode             text not null default 'test' check (mode in ('test','live')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 6. API Keys
create table if not exists api_keys (
  id          text primary key default gen_random_uuid()::text,
  tenant_id   text not null references workspaces(id) on delete cascade,
  name        text not null,
  key_prefix  text not null,
  key_hash    text not null,
  is_active   boolean not null default true,
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);

-- 7. Webhook Events (log table)
create table if not exists webhook_events (
  id           text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  event_type   text not null,
  gateway      text,
  status       text not null default 'pending' check (status in ('success','failed','pending')),
  payload      jsonb default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists idx_webhook_events_ws on webhook_events(workspace_id);

-- 8. Notifications
create table if not exists notifications (
  id          text primary key default gen_random_uuid()::text,
  workspace_id text not null references workspaces(id) on delete cascade,
  title       text not null,
  body        text,
  type        text not null default 'info',
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 9. App Users (separate from NextAuth — stores profile data)
create table if not exists app_users (
  id         text primary key,
  email      text unique not null,
  name       text,
  password   text not null,
  role       text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════
-- RLS: Enable Row-Level Security
-- ═══════════════════════════════════════════════════════════════
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table gateway_credentials enable row level security;
alter table api_keys enable row level security;
alter table webhook_events enable row level security;
alter table notifications enable row level security;
alter table app_users enable row level security;

-- Service-role bypasses RLS; anon key gets nothing by default.
-- We use the anon key from server-side with service-role for writes.
-- For reads, the workspace_members join acts as the access filter.

-- ═══════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- Now set these env vars in Vercel:
--   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
--   SUPABASE_SERVICE_ROLE_KEY=eyJ...
--   NEXTAUTH_SECRET=any-random-string
-- ═══════════════════════════════════════════════════════════════
