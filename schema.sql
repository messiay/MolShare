-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references auth.users not null,
  title text not null,
  file_url text not null,
  file_extension text not null,
  is_public boolean default true,
  notes text
);

-- Enable RLS
alter table public.projects enable row level security;

-- Policies for projects
create policy "Users can view public projects"
  on projects for select
  using ( is_public = true );

create policy "Users can view their own projects"
  on projects for select
  using ( auth.uid() = owner_id );

create policy "Users can insert their own projects"
  on projects for insert
  with check ( auth.uid() = owner_id );

create policy "Users can update their own projects"
  on projects for update
  using ( auth.uid() = owner_id );

-- Storage bucket setup (You might need to create the bucket 'molecules' in the dashboard if this fails)
insert into storage.buckets (id, name, public) values ('molecules', 'molecules', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'molecules' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'molecules' and auth.role() = 'authenticated' );
