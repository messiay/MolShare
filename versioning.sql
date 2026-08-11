-- ============================================
-- DATA VERSIONING SUPPORT: project_files versioning
-- ============================================

-- 1. Add version_number and parent_version_id to project_files table
ALTER TABLE public.project_files 
ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_version_id uuid REFERENCES public.project_files(id) ON DELETE SET NULL;

-- 2. Backfill existing records to version 1
UPDATE public.project_files 
SET version_number = 1 
WHERE version_number IS NULL;

-- 3. Index for quick lookup of version chains
CREATE INDEX IF NOT EXISTS idx_project_files_parent_version 
ON public.project_files(parent_version_id);

CREATE INDEX IF NOT EXISTS idx_project_files_version_number 
ON public.project_files(project_id, version_number);
