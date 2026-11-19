-- Add persistent View Log (3D camera viewpoints, pivots, and inspection milestones) to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS view_logs jsonb DEFAULT '[]'::jsonb;
