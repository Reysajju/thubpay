-- ============================================================
-- Migration: 20260410000000_full_portal_requirements.sql
-- Description: Add all tables and columns needed by the
--              55-question requirements document.
-- Style:       Idempotent (IF NOT EXISTS throughout)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1.  ALTER existing tables -- add new columns
-- ----------------------------------------------------------

-- workspaces ------------------------------------------------
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS base_currency          text        NOT NULL DEFAULT 'usd';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_completed  boolean     NOT NULL DEFAULT false;

-- invoices --------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS viewed_at               timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at                 timestamptz;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_via_gateway         text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gateway_transaction_id   text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number_prefix    text        NOT NULL DEFAULT 'INV';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes                   text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms            text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent         numeric(5,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due_cents        integer     NOT NULL DEFAULT 0;

-- Drop and recreate the status check constraint on invoices
DO $$
BEGIN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status;
END$$;

ALTER TABLE invoices ADD CONSTRAINT invoices_status_check
    CHECK (status IN (
        'draft', 'sent', 'viewed', 'paid', 'partially_paid',
        'void', 'uncollectible', 'deleted', 'overdue'
    ));

-- clients ---------------------------------------------------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_spend_cents    integer     NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS transaction_count    integer     NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_payment_at      timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes                text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags                 text[];

-- payment_links ---------------------------------------------
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS amount_cents       integer;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS currency           text        NOT NULL DEFAULT 'usd';
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS description        text;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS max_uses           integer;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS current_uses       integer     NOT NULL DEFAULT 0;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS expires_at         timestamptz;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS gateway_slug      text;
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS success_redirect_url text;

-- brands ----------------------------------------------------
ALTER TABLE brands ADD COLUMN IF NOT EXISTS smtp_host            text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS smtp_port            integer;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS smtp_user            text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS smtp_pass_encrypted  text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS support_email        text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS website_url          text;


-- ----------------------------------------------------------
-- 2.  NEW TABLES
-- ----------------------------------------------------------

-- 2a. subscription_plans ------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
    id            uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          text        NOT NULL,
    amount_cents  integer     NOT NULL,
    currency      text        NOT NULL DEFAULT 'usd',
    interval      text        NOT NULL CHECK (interval IN ('day','week','month','year')),
    trial_days    integer     NOT NULL DEFAULT 0,
    is_active     boolean     NOT NULL DEFAULT true,
    metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_plans_workspace  ON subscription_plans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sub_plans_active      ON subscription_plans(workspace_id, is_active);

-- 2b. subscriptions -----------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS workspace_id             uuid;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id                 uuid REFERENCES subscription_plans(id) ON DELETE SET NULL;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS client_id                uuid REFERENCES clients(id) ON DELETE SET NULL;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_slug             text;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id  text;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status                  text NOT NULL DEFAULT 'active';
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start    timestamptz;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end      timestamptz;
        ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end    boolean NOT NULL DEFAULT false;
        ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
        ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
            CHECK (status IN ('trialing','active','past_due','canceled','unpaid','paused'));
    ELSE
        CREATE TABLE subscriptions (
            id                      uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
            workspace_id            uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            plan_id                  uuid                REFERENCES subscription_plans(id) ON DELETE SET NULL,
            client_id                uuid                REFERENCES clients(id) ON DELETE SET NULL,
            gateway_slug             text,
            gateway_subscription_id  text,
            status                   text        NOT NULL DEFAULT 'active'
                                                CHECK (status IN ('trialing','active','past_due','canceled','unpaid','paused')),
            current_period_start     timestamptz,
            current_period_end       timestamptz,
            cancel_at_period_end     boolean     NOT NULL DEFAULT false,
            created_at               timestamptz NOT NULL DEFAULT now()
        );
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace   ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client     ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan       ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status     ON subscriptions(status);

-- 2c. payouts -----------------------------------------------
CREATE TABLE IF NOT EXISTS payouts (
    id                  uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    gateway_slug        text        NOT NULL,
    gateway_payout_id   text,
    amount_cents        integer     NOT NULL,
    currency            text        NOT NULL DEFAULT 'usd',
    status              text        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','in_transit','paid','failed','canceled')),
    scheduled_at        timestamptz,
    processed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payouts_workspace    ON payouts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status      ON payouts(workspace_id, status);

-- 2d. payout_settings ---------------------------------------
CREATE TABLE IF NOT EXISTS payout_settings (
    id                      uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id            uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    bank_account_encrypted  text        NOT NULL,
    schedule                text        NOT NULL DEFAULT 'monthly'
                                        CHECK (schedule IN ('daily','weekly','monthly')),
    minimum_amount_cents    integer     NOT NULL DEFAULT 0,
    is_active               boolean     NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- 2e. disputes ----------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
    id                  uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    transaction_id      uuid,
    gateway_slug        text        NOT NULL,
    gateway_dispute_id  text,
    amount_cents        integer     NOT NULL,
    currency            text        NOT NULL DEFAULT 'usd',
    reason              text,
    status              text        NOT NULL DEFAULT 'needs_response'
                                    CHECK (status IN ('needs_response','under_review','won','lost')),
    evidence_due_at     timestamptz,
    resolved_at         timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_workspace     ON disputes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status       ON disputes(workspace_id, status);

-- 2f. dispute_evidence --------------------------------------
CREATE TABLE IF NOT EXISTS dispute_evidence (
    id          uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    dispute_id  uuid        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    file_url    text        NOT NULL,
    file_type   text,
    file_name   text,
    uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 2g. notifications ----------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id            uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type          text        NOT NULL,
    title         text        NOT NULL,
    message       text,
    channel       text        NOT NULL DEFAULT 'in_app'
                              CHECK (channel IN ('email','in_app','slack')),
    is_read       boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user      ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read       ON notifications(user_id, is_read);

-- 2h. notification_preferences ------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
    id            uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel       text        NOT NULL CHECK (channel IN ('email','in_app','slack')),
    event_type    text        NOT NULL,
    is_enabled    boolean     NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_prefs_unique
    ON notification_preferences(workspace_id, user_id, channel, event_type);

-- 2i. rate_limits -------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id             uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    identifier     text        NOT NULL,
    endpoint_type  text        NOT NULL,
    request_count  integer     NOT NULL DEFAULT 1,
    window_start   timestamptz NOT NULL DEFAULT now(),
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier
    ON rate_limits(identifier, endpoint_type, window_start);

-- 2j. fraud_alerts ------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id              uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    transaction_id   uuid,
    alert_type      text        NOT NULL,
    details         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    status          text        NOT NULL DEFAULT 'flagged'
                                CHECK (status IN ('flagged','reviewed','dismissed')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_workspace   ON fraud_alerts(workspace_id);

-- 2k. gateway_health ----------------------------------------
CREATE TABLE IF NOT EXISTS gateway_health (
    id                    uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    gateway_slug          text        NOT NULL UNIQUE,
    status                text        NOT NULL DEFAULT 'healthy'
                                    CHECK (status IN ('healthy','degraded','down')),
    consecutive_failures  integer     NOT NULL DEFAULT 0,
    last_checked_at       timestamptz NOT NULL DEFAULT now(),
    last_success_at       timestamptz
);

-- 2l. invoice_line_items ------------------------------------
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id                  uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id          uuid        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description         text        NOT NULL,
    quantity            numeric     NOT NULL DEFAULT 1,
    unit_amount_cents   integer     NOT NULL,
    tax_rate            numeric(5,2) NOT NULL DEFAULT 0,
    discount_percent    numeric(5,2) NOT NULL DEFAULT 0,
    sort_order          integer     NOT NULL DEFAULT 0,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

-- 2m. onboarding_steps -------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id              uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    step_name       text        NOT NULL,
    is_completed    boolean     NOT NULL DEFAULT false,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_steps_unique
    ON onboarding_steps(workspace_id, step_name);

-- 2n. transaction_events ------------------------------------
CREATE TABLE IF NOT EXISTS transaction_events (
    id              uuid        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    transaction_id   uuid,
    workspace_id    uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    event_type      text        NOT NULL,
    payload         jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_events_workspace   ON transaction_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transaction_events_type        ON transaction_events(event_type);


-- ----------------------------------------------------------
-- 3.  ROW-LEVEL SECURITY
-- ----------------------------------------------------------
ALTER TABLE subscription_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_evidence        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_health          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_events      ENABLE ROW LEVEL SECURITY;

-- Helper: membership check functions
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    );
$$;

-- SELECT policies (workspace members can read)
DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'subscription_plans','subscriptions','payouts','payout_settings',
        'disputes','dispute_evidence','notifications','notification_preferences',
        'fraud_alerts','invoice_line_items','onboarding_steps','transaction_events'
    ]
    LOOP
        EXECUTE format(
            'CREATE POLICY %I ON %I FOR SELECT USING (is_workspace_member(workspace_id))',
            tbl || '_member_select', tbl
        );
    END LOOP;
END$$;

-- INSERT / UPDATE / DELETE policies (admins/owners)
DO $$
DECLARE
    tbl text;
    op  text;
    policy_suffix text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'subscription_plans','subscriptions','payouts','payout_settings',
        'disputes','dispute_evidence','fraud_alerts','invoice_line_items',
        'onboarding_steps','transaction_events'
    ]
    LOOP
        FOREACH op IN ARRAY ARRAY['insert', 'update', 'delete']
        LOOP
            policy_suffix := '_admin_' || op;
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR %I WITH CHECK (is_workspace_admin(workspace_id))',
                tbl || policy_suffix, tbl, op
            );
        END LOOP;
    END LOOP;
END$$;

-- Special: notifications — users can insert/update their own
CREATE POLICY notifications_user_insert ON notifications
    FOR INSERT WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY notifications_user_update ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Special: notification_preferences — users manage their own
CREATE POLICY notif_prefs_user_insert ON notification_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY notif_prefs_user_update ON notification_preferences
    FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY notif_prefs_user_delete ON notification_preferences
    FOR DELETE USING (user_id = auth.uid());

-- gateway_health: anyone can read
CREATE POLICY gateway_health_read ON gateway_health FOR SELECT USING (true);
-- rate_limits: service_role only
CREATE POLICY rate_limits_service_read ON rate_limits FOR SELECT USING (true);


-- ----------------------------------------------------------
-- 4.  ONBOARDING TRIGGERS
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_onboarding_step_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    ws_id   uuid;
    step_nm text;
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'clients'             THEN step_nm := 'add_client';
        WHEN 'invoices'            THEN step_nm := 'create_invoice';
        WHEN 'payment_links'       THEN step_nm := 'create_payment_link';
        WHEN 'gateway_credentials' THEN step_nm := 'connect_gateway';
        WHEN 'brands'              THEN step_nm := 'customize_brand';
        ELSE RETURN NEW;
    END CASE;

    BEGIN
        ws_id := NEW.workspace_id;
    EXCEPTION WHEN undefined_column THEN
        RETURN NEW;
    END;

    INSERT INTO onboarding_steps (workspace_id, step_name, is_completed, completed_at)
    VALUES (ws_id, step_nm, true, now())
    ON CONFLICT (workspace_id, step_name)
    DO UPDATE SET is_completed = true, completed_at = now();

    IF NOT EXISTS (
        SELECT 1 FROM onboarding_steps WHERE workspace_id = ws_id AND is_completed = false
    ) AND EXISTS (
        SELECT 1 FROM onboarding_steps WHERE workspace_id = ws_id
    ) THEN
        UPDATE workspaces SET onboarding_completed = true WHERE id = ws_id AND onboarding_completed = false;
    END IF;

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    trg record;
BEGIN
    FOR trg IN SELECT * FROM (VALUES
        ('clients','trg_onboarding_client'),
        ('invoices','trg_onboarding_invoice'),
        ('payment_links','trg_onboarding_payment_link'),
        ('gateway_credentials','trg_onboarding_gateway'),
        ('brands','trg_onboarding_brand')
    ) AS t(tbl, trg_name)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trg.trg_name, trg.tbl);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION mark_onboarding_step_completed()',
            trg.trg_name, trg.tbl
        );
    END LOOP;
END$$;

-- Seed default onboarding steps for new workspaces
CREATE OR REPLACE FUNCTION seed_onboarding_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO onboarding_steps (workspace_id, step_name, is_completed)
    VALUES
        (NEW.id, 'add_client', false),
        (NEW.id, 'create_invoice', false),
        (NEW.id, 'create_payment_link', false),
        (NEW.id, 'connect_gateway', false),
        (NEW.id, 'customize_brand', false);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_onboarding ON workspaces;
CREATE TRIGGER trg_seed_onboarding
    AFTER INSERT ON workspaces
    FOR EACH ROW EXECUTE FUNCTION seed_onboarding_steps();
