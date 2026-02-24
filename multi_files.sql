-- ============================================
-- MULTI-FILE SUPPORT: project_files table
-- ============================================

-- 1. Create project_files table
create table public.project_files (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  owner_id uuid references auth.users not null,
  file_url text not null,
  file_extension text not null,
  file_name text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.project_files enable row level security;

-- 3. Policies

-- Anyone can view files belonging to public projects
create policy "Public project files are viewable by everyone"
  on project_files for select
  using (
    exists (
      select 1 from projects
      where projects.id = project_files.project_id
      and projects.is_public = true
    )
  );

-- Owners can view their own project files (even if private)
create policy "Owners can view own project files"
  on project_files for select
  using ( auth.uid() = owner_id );

-- Owners can insert files to their own projects
create policy "Owners can insert project files"
  on project_files for insert
  with check ( auth.uid() = owner_id );

-- Owners can update their own project files (e.g. reorder)
create policy "Owners can update own project files"
  on project_files for update
  using ( auth.uid() = owner_id );

-- Owners can delete their own project files
create policy "Owners can delete own project files"
  on project_files for delete
  using ( auth.uid() = owner_id );
