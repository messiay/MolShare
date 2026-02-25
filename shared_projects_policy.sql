-- ============================================
-- FIX: SHARED PROJECTS VISIBILITY POLICY
-- ============================================
-- This fixes the infinite recursion issue by using
-- a SECURITY DEFINER function to bypass RLS when
-- checking project_views from within projects policy.

-- Step 1: Drop the problematic policy that caused recursion
DROP POLICY IF EXISTS "Users can view projects they have visited" ON projects;

-- Step 2: Create a SECURITY DEFINER function (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_has_viewed_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_views
    WHERE project_views.project_id = p_project_id
    AND project_views.viewer_id = p_user_id
  );
$$;

-- Step 3: Create the policy using the function (no recursion)
CREATE POLICY "Users can view projects they have visited"
  ON projects FOR SELECT
  USING (
    public.user_has_viewed_project(id, auth.uid())
  );

-- Step 4: Allow users to see their own view records
-- (drop first in case it already exists from previous run)
DROP POLICY IF EXISTS "Users can see their own view records" ON project_views;

CREATE POLICY "Users can see their own view records"
  ON project_views FOR SELECT
  USING ( viewer_id = auth.uid() );
