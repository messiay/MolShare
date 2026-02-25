-- ============================================
-- SHARED PROJECTS VISIBILITY POLICY
-- ============================================
-- Run this in your Supabase SQL Editor to allow users
-- to view projects they have previously visited.

-- Allow users to SELECT projects they have a view record for
CREATE POLICY "Users can view projects they have visited"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_views
      WHERE project_views.project_id = projects.id
      AND project_views.viewer_id = auth.uid()
    )
  );

-- Allow users to see their own view records
CREATE POLICY "Users can see their own view records"
  ON project_views FOR SELECT
  USING ( viewer_id = auth.uid() );
