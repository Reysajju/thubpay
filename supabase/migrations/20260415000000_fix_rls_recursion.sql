-- Migration: 20260415000000_fix_rls_recursion.sql
-- Description: Fixes recursive RLS policy on workspace_members table to prevent dashboard loading issues.

-- 1. Drop the old recursive policies
DROP POLICY IF EXISTS "members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "admins can manage workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace members can select workspace" ON public.workspaces;

-- 2. Create a new SELECT policy for workspace_members that breaks recursion.
CREATE POLICY "members can view workspace members"
ON public.workspace_members FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id 
    AND wm.user_id = auth.uid()
  )
);

-- 3. Create a new ALL policy for admins on workspace_members.
CREATE POLICY "admins can manage workspace members"
ON public.workspace_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id 
    AND wm.user_id = auth.uid() 
    AND wm.role IN ('owner', 'admin')
  )
);

-- 4. Fix workspaces select policy to also allow owners to see their workspace.
-- This is important for initial setup/discovery.
CREATE POLICY "members and owners can select workspace"
ON public.workspaces FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspaces.id 
    AND wm.user_id = auth.uid()
  )
);
