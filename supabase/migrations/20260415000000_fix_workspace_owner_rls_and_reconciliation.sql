-- Migration: 20260415000000_fix_workspace_owner_rls_and_reconciliation.sql
-- Description: 
-- 1. Redefine is_workspace_member and is_workspace_admin to include owner check.
-- 2. Add SELECT policies for workspace owners on workspaces and workspace_members.
-- 3. Update main table policies (brands, clients, invoices) to use these helpers.

-- 1. Redefine helper functions to include ownership check
-- We use SECURITY DEFINER to ensure these functions can check workspaces/members tables 
-- regardless of the user's current RLS access to those tables.
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
          AND role IN ('owner', 'admin')
    ) OR EXISTS (
        SELECT 1 FROM public.workspaces
        WHERE id = ws_id AND owner_user_id = auth.uid()
    );
$$;

-- 2. Add explicit SELECT policies for owners on workspaces and workspace_members
-- This ensures that even if the membership record is missing, the owner can see the workspace.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'workspaces' AND policyname = 'Owners can always view their own workspaces'
    ) THEN
        CREATE POLICY "Owners can always view their own workspaces"
        ON public.workspaces FOR SELECT
        USING (auth.uid() = owner_user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'workspace_members' AND policyname = 'Owners can always view their own workspace members'
    ) THEN
        CREATE POLICY "Owners can always view their own workspace members"
        ON public.workspace_members FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.workspaces w
                WHERE w.id = public.workspace_members.workspace_id
                AND w.owner_user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- 3. Update main tables to use helper functions for consistency and ownership fallback
-- Brands
DROP POLICY IF EXISTS "members can view brands" ON public.brands;
CREATE POLICY "members can view brands" ON public.brands 
FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "admins can manage brands" ON public.brands;
CREATE POLICY "admins can manage brands" ON public.brands 
FOR ALL USING (is_workspace_admin(workspace_id));

-- Clients
DROP POLICY IF EXISTS "members can view clients" ON public.clients;
CREATE POLICY "members can view clients" ON public.clients 
FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "members can manage clients" ON public.clients;
CREATE POLICY "members can manage clients" ON public.clients 
FOR ALL USING (is_workspace_member(workspace_id));

-- Invoices
DROP POLICY IF EXISTS "members can view invoices" ON public.invoices;
CREATE POLICY "members can view invoices" ON public.invoices 
FOR SELECT USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "members can manage invoices" ON public.invoices;
CREATE POLICY "members can manage invoices" ON public.invoices 
FOR ALL USING (is_workspace_member(workspace_id));
