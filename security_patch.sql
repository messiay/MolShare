-- 1. DROP insecure/loose policies
drop policy "Authenticated users can upload" on storage.objects;

-- 2. CREATE Strict Upload Policy (Can only upload to own folder: molecules/USER_ID/...)
create policy "Users can upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'molecules' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. ALLOW Deletion of Files (Users can delete their own files)
create policy "Users can delete own files"
  on storage.objects for delete
  using (
    bucket_id = 'molecules' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. ALLOW Deletion of Projects (Row Level Security)
create policy "Users can delete their own projects"
  on projects for delete
  using ( auth.uid() = owner_id );
