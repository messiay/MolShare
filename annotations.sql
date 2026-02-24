-- ============================================
-- ATOM-LEVEL ANNOTATIONS
-- ============================================

-- 1. Create annotations table
create table public.annotations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  file_id uuid references public.project_files(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade not null,
  atom_serial integer,
  atom_name text,
  residue_name text,
  residue_id integer,
  chain text,
  x float,
  y float,
  z float,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.annotations enable row level security;

-- 3. Policies

-- Anyone can view annotations on public projects (or their own)
create policy "Annotations viewable on public or own projects"
  on annotations for select
  using (
    exists (
      select 1 from projects
      where projects.id = annotations.project_id
      and projects.is_public = true
    )
    OR
    exists (
      select 1 from projects
      where projects.id = annotations.project_id
      and projects.owner_id = auth.uid()
    )
  );

-- Authenticated users can annotate public projects or their own
create policy "Authenticated users can annotate"
  on annotations for insert
  with check (
    auth.role() = 'authenticated' AND (
      exists (
        select 1 from projects
        where projects.id = project_id
        and projects.is_public = true
      )
      OR
      exists (
        select 1 from projects
        where projects.id = project_id
        and projects.owner_id = auth.uid()
      )
    )
  );

-- Users can delete their own annotations
create policy "Users can delete own annotations"
  on annotations for delete
  using ( auth.uid() = user_id );

-- Project owners can delete any annotation on their project
create policy "Owners can delete annotations on their project"
  on annotations for delete
  using (
    exists (
      select 1 from projects
      where projects.id = annotations.project_id
      and projects.owner_id = auth.uid()
    )
  );
