-- Migration: 20260414160000_fix_workspace_creation_rls.sql
-- Description: Adds missing RLS INSERT policies for workspaces and workspace_members to allow dashboard auto-creation.

-- 1. Allow authenticated users to create a workspace where they are the owner.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'workspaces' AND policyname = 'Users can create their own workspace'
    ) THEN
        CREATE POLICY "Users can create their own workspace" 
        ON public.workspaces FOR INSERT 
        WITH CHECK (auth.uid() = owner_user_id);
    END IF;
END $$;

-- 2. Allow users to add the first member record for a workspace they own.
-- This resolves the chicken-and-egg problem for initial workspace setup.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'workspace_members' AND policyname = 'Owners can add members to their workspace'
    ) THEN
        CREATE POLICY "Owners can add members to their workspace"
        ON public.workspace_members FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.id = workspace_members.workspace_id
                AND w.owner_user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- 3. Ensure brands can be created by workspace owners/admins.
-- (Existing "admins can manage brands" uses USING, adding WITH CHECK for clarity for INSERT)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'brands' AND policyname = 'Admins can create brands'
    ) THEN
        CREATE POLICY "Admins can create brands"
        ON public.brands FOR INSERT
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = brands.workspace_id
                AND wm.user_id = auth.uid()
                AND wm.role IN ('owner', 'admin')
            )
        );
    END IF;
END $$;
