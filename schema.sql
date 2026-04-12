-- ==========================================
-- 1. THE "NUKE" (CLEANUP)
-- ==========================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.webhook_events cascade;
drop table if exists public.transactions cascade;
drop table if exists public.invoices cascade;
drop table if exists public.subscriptions cascade;
drop table if exists public.prices cascade;
drop table if exists public.products cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.gateway_customers cascade;
drop table if exists public.customer_addresses cascade;
drop table if exists public.clients cascade;
drop table if exists public.brands cascade;
drop table if exists public.customers cascade;
drop table if exists public.users cascade;

-- Drop custom types
drop type if exists public.subscription_status cascade;
drop type if exists public.pricing_plan_interval cascade;
drop type if exists public.pricing_type cascade;
drop type if exists public.gateway_name cascade;
drop type if exists public.transaction_status cascade;
drop type if exists public.transaction_type cascade;
drop type if exists public.payment_method_type cascade;
drop type if exists public.invoice_status cascade;

drop publication if exists supabase_realtime;

-- ==========================================
-- 2. CREATE TYPES
-- ==========================================

create type pricing_type as enum ('one_time', 'recurring');
create type pricing_plan_interval as enum ('day', 'week', 'month', 'year');
create type subscription_status as enum ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');
create type gateway_name as enum ('stripe', 'paypal', 'square', 'adyen', 'razorpay', 'authorize_net', 'mollie', 'twocheckout', 'klarna');
create type transaction_status as enum ('pending', 'succeeded', 'failed');
create type transaction_type as enum ('charge', 'refund', 'dispute');
create type payment_method_type as enum ('card', 'bank', 'wallet');
create type invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');

-- ==========================================
-- 3. CREATE TABLES FOR MULTI-TENANCY
-- ==========================================

/**
 * BRANDS
 * Workspaces owned by ThubPay users. Each brand has its own SMTP settings and clients.
 */
create table brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  logo_url text,
  -- SMTP credentials for white-labeled emails. Encrypted via pgcrypto.
  smtp_host text,
  smtp_port integer default 587,
  smtp_user text,
  smtp_pass_encrypted text, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table brands enable row level security;
create policy "Users can view own brands" on brands for select using (auth.uid() = owner_id);
create policy "Users can insert own brands" on brands for insert with check (auth.uid() = owner_id);
create policy "Users can update own brands" on brands for update using (auth.uid() = owner_id);

/**
 * CLIENTS
 * The end-payers who receive invoices from a Brand.
 */
create table clients (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  full_name text not null, -- Encrypt in app
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table clients enable row level security;
-- Policy: owner of the brand can manage clients
create policy "Users can manage clients of own brands" on clients 
using (exists (select 1 from brands b where b.id = clients.brand_id and b.owner_id = auth.uid()));

/**
 * CUSTOMER ADDRESSES
 * Addresses for a specific client.
 */
create table customer_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  address_line1 text, -- enc
  address_line2 text, -- enc
  city text, -- enc
  state text,
  country_code text,
  postal_code text, -- enc
  is_billing boolean default true,
  is_shipping boolean default false
);

alter table customer_addresses enable row level security;
create policy "Users can manage addresses of own clients" on customer_addresses 
using (exists (select 1 from clients c join brands b on c.brand_id = b.id where c.id = customer_addresses.client_id and b.owner_id = auth.uid()));

/**
 * GATEWAY CUSTOMERS
 * Maps a client to a specific gateway customer object.
 */
create table gateway_customers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  gateway_name gateway_name not null,
  gateway_customer_id text not null,
  unique(client_id, gateway_name)
);

alter table gateway_customers enable row level security;

/**
 * PAYMENT METHODS
 * Vaulted payment tokens for a client.
 */
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade not null,
  gateway_name gateway_name not null,
  gateway_method_id text not null, -- vault token
  type payment_method_type not null default 'card',
  last4 text,
  brand text,
  exp_month integer,
  exp_year integer,
  is_default boolean default false
);

alter table payment_methods enable row level security;

/**
 * PRODUCTS
 * Scoped catalogs to a brand.
 */
create table products (
  id text primary key,
  brand_id uuid references brands(id) on delete cascade not null,
  active boolean,
  name text,
  description text,
  image text,
  metadata jsonb
);

alter table products enable row level security;

/**
 * PRICES
 */
create table prices (
  id text primary key,
  product_id text references products(id) on delete cascade, 
  gateway_name gateway_name,
  gateway_price_id text,
  active boolean,
  description text,
  unit_amount bigint,
  currency text check (char_length(currency) = 3),
  type pricing_type,
  interval pricing_plan_interval,
  interval_count integer,
  trial_period_days integer,
  metadata jsonb
);

alter table prices enable row level security;

/**
 * INVOICES
 * Invoices sent to a client by a brand.
 */
create table invoices (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade not null,
  client_id uuid references clients(id) on delete set null,
  amount bigint not null,
  currency text check (char_length(currency) = 3) not null,
  status invoice_status not null default 'draft',
  due_date timestamp with time zone,
  pdf_url text, -- link to generated PDF
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table invoices enable row level security;

/**
 * TRANSACTIONS
 * Immutable audit log of all financial events.
 */
create table transactions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  gateway_name gateway_name not null,
  gateway_payment_id text not null,
  amount bigint not null,
  currency text check (char_length(currency) = 3) not null,
  status transaction_status not null,
  type transaction_type not null,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table transactions enable row level security;

/**
 * WEBHOOK EVENTS
 * Deduplication and audit log for webhook processing.
 */
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway_name gateway_name not null,
  event_id text not null,
  event_type text not null,
  payload text, -- marked for encryption
  processed_at timestamp with time zone,
  idempotency_key text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table webhook_events enable row level security;

-- ==========================================
-- 4. FUNCTIONS & TRIGGERS
-- ==========================================

create function public.handle_new_user() 
returns trigger as $$
begin
  -- Automatically create a default brand for new users
  insert into public.brands (owner_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'My Default Brand') || '''s Brand');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 5. REALTIME CONFIGURATION
-- ==========================================

create publication supabase_realtime for table products, prices;