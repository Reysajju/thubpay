create table if not exists gateway_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workspaces(id) on delete cascade,
  gateway_slug text not null,
  publishable_key text,
  secret_key_encrypted text not null,
  webhook_secret_encrypted text,
  mode text not null default 'test' check (mode in ('test', 'live')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  last_verified_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  public_key text not null unique,
  secret_key_hash text not null,
  scope text not null default 'read' check (scope in ('read', 'write', 'admin')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  ip_address text,
  user_agent text,
  payload_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists webhook_jobs (
  id uuid primary key default gen_random_uuid(),
  gateway_slug text not null,
  event_id text not null,
  event_type text not null,
  payload text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'processed', 'failed')),
  attempts integer not null default 0,
  next_run_at timestamp with time zone not null default timezone('utc'::text, now()),
  last_error text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  processed_at timestamp with time zone
);

create unique index if not exists webhook_jobs_unique_event
  on webhook_jobs (gateway_slug, event_id);

create index if not exists webhook_jobs_status_next_run_idx
  on webhook_jobs (status, next_run_at);

alter table gateway_credentials enable row level security;
alter table api_keys enable row level security;
alter table audit_logs enable row level security;
alter table webhook_jobs enable row level security;

create policy "members can view gateway credentials"
  on gateway_credentials for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = gateway_credentials.tenant_id
        and wm.user_id = auth.uid()
    )
  );

create policy "owner can manage gateway credentials"
  on gateway_credentials for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = gateway_credentials.tenant_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "members can view api keys"
  on api_keys for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = api_keys.tenant_id
        and wm.user_id = auth.uid()
    )
  );

create policy "owner can manage api keys"
  on api_keys for all
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = api_keys.tenant_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "members can view audit logs"
  on audit_logs for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = audit_logs.tenant_id
        and wm.user_id = auth.uid()
    )
  );
