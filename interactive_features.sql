-- 1. Create COMMENTS table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.comments enable row level security;

-- 3. Policies for Comments
-- Everyone can read comments on public projects
create policy "Public comments are viewable by everyone"
  on comments for select
  using ( 
    exists (
      select 1 from projects 
      where projects.id = comments.project_id 
      and projects.is_public = true
    )
    OR
    exists (
      select 1 from projects 
      where projects.id = comments.project_id 
      and projects.owner_id = auth.uid()
    )
  );

-- Authenticated users can comment on public projects or their own projects
create policy "Authenticated users can comment"
  on comments for insert
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

-- Users can delete their own comments
create policy "Users can delete own comments"
  on comments for delete
  using ( auth.uid() = user_id );

-- Project owners can delete any comment on their project
create policy "Owners can delete comments on their project"
  on comments for delete
  using (
      exists (
        select 1 from projects 
        where projects.id = comments.project_id 
        and projects.owner_id = auth.uid()
      )
  );
