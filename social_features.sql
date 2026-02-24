-- 1. Create PROFILES table (Publicly visible user info)
create table public.profiles (
  id uuid references auth.users not null primary key,
  updated_at timestamp with time zone,
  email text,
  full_name text,
  avatar_url text
);

-- 2. Create Trigger to Auto-Create Profile on Signup
-- This ensures every user has a row in 'profiles' automatically
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Create PROJECT_VIEWS table (Tracking)
create table public.project_views (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  viewer_id uuid references auth.users(id), -- Nullable (for anonymous views if we allow them)
  viewed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable RLS
alter table public.profiles enable row level security;
alter table public.project_views enable row level security;

-- 5. Policies for Profiles
-- Everyone can read profiles (needed to show "Shared by...")
create policy "Public profiles are viewable by everyone"
  on profiles for select
  using ( true );

-- Users can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- 6. Policies for Views
-- Everyone can insert a view (logging)
create policy "Everyone can log a view"
  on project_views for insert
  with check ( true );

-- Only project owners can see who viewed their projects
create policy "Owners can see views of their projects"
  on project_views for select
  using ( 
    exists (
      select 1 from projects 
      where projects.id = project_views.project_id 
      and projects.owner_id = auth.uid()
    )
  );
