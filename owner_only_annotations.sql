-- ============================================
-- OWNER-ONLY ANNOTATION INSERT POLICY
-- ============================================
-- Run this in your Supabase SQL Editor to restrict
-- annotation creation to project owners only.

-- Drop existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can annotate" ON annotations;

-- Create new restrictive policy: only project owner can insert
CREATE POLICY "Only project owner can annotate"
  ON annotations FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_id
      AND projects.owner_id = auth.uid()
    )
  );
