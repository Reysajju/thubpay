-- ============================================================
-- ThubPay Dashboard Features Migration
-- Adds extended fields for brands, clients, invoices
-- plus invoice lifecycle tracking (dispatch, pay, receipt)
-- ============================================================

-- ── BRANDS: website, gradient, logo ─────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS gradient_from text NOT NULL DEFAULT '#7A5A2B',
  ADD COLUMN IF NOT EXISTS gradient_to   text NOT NULL DEFAULT '#D4B27A',
  ADD COLUMN IF NOT EXISTS logo_url      text,
  ADD COLUMN IF NOT EXISTS public_slug   text;

-- Unique slug per workspace
CREATE UNIQUE INDEX IF NOT EXISTS brands_workspace_slug_idx
  ON brands(workspace_id, public_slug)
  WHERE public_slug IS NOT NULL;

-- ── CLIENTS: phone, address, services, notes ─────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS phone    text,
  ADD COLUMN IF NOT EXISTS address  text,
  ADD COLUMN IF NOT EXISTS services text,
  ADD COLUMN IF NOT EXISTS notes    text;

-- ── INVOICES: lifecycle, balance, description ─────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS payment_terms    text NOT NULL DEFAULT 'Net 30',
  ADD COLUMN IF NOT EXISTS tax_rate_pct     numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_cents integer,
  ADD COLUMN IF NOT EXISTS dispatched_at    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS viewed_at        timestamp with time zone,
  ADD COLUMN IF NOT EXISTS paid_at          timestamp with time zone;

-- Back-fill balance_due_cents for existing rows
UPDATE invoices
SET balance_due_cents = total_cents
WHERE balance_due_cents IS NULL;

-- ── INVOICE LINE ITEMS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  text NOT NULL,
  quantity     numeric(10,2) NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  total_cents  integer GENERATED ALWAYS AS
                 (ROUND(quantity * unit_price_cents)::integer) STORED
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can manage invoice line items"
  ON invoice_line_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM invoices i
      JOIN workspace_members wm ON wm.workspace_id = i.workspace_id
      WHERE i.id = invoice_line_items.invoice_id
        AND wm.user_id = auth.uid()
    )
  );

-- ── PAYMENT RECEIPTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_receipts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_paid_cents integer NOT NULL,
  balance_remaining_cents integer NOT NULL DEFAULT 0,
  gateway          text NOT NULL DEFAULT 'stripe',
  gateway_tx_id    text,
  paid_at          timestamp with time zone NOT NULL DEFAULT now(),
  receipt_url      text,
  created_at       timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view payment receipts"
  ON payment_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM invoices i
      JOIN workspace_members wm ON wm.workspace_id = i.workspace_id
      WHERE i.id = payment_receipts.invoice_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "service role can insert payment receipts"
  ON payment_receipts FOR INSERT
  WITH CHECK (true);

-- ── AUDIT LOG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text,
  entity_id  uuid,
  metadata   jsonb,
  ip         text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can view audit log"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = audit_log.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type         text NOT NULL, -- 'invoice_paid','payment_failed','invoice_overdue'
  title        text NOT NULL,
  body         text,
  is_read      boolean NOT NULL DEFAULT false,
  entity       text,
  entity_id    uuid,
  created_at   timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE portal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own notifications"
  ON portal_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users can update own notifications"
  ON portal_notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "service role can insert notifications"
  ON portal_notifications FOR INSERT
  WITH CHECK (true);

-- ── GATEWAY CREDENTIALS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS gateway_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  gateway_slug    text NOT NULL, -- stripe, paypal, square, etc.
  publishable_key text,
  secret_key_enc  text,          -- AES-256 encrypted
  webhook_secret_enc text,
  mode            text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  is_default      boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  last_verified_at timestamp with time zone,
  created_at      timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, gateway_slug, mode)
);

ALTER TABLE gateway_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners can manage gateway credentials"
  ON gateway_credentials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = gateway_credentials.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );
