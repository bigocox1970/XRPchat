-- Create avatars bucket if not exists
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;
end $$;

-- Allow public access to avatars
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload avatar
drop policy if exists "Users can upload avatar image" on storage.objects;
create policy "Users can upload avatar image"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update their avatar
drop policy if exists "Users can update their avatar image" on storage.objects;
create policy "Users can update their avatar image"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to delete their avatar
drop policy if exists "Users can delete their avatar image" on storage.objects;
create policy "Users can delete their avatar image" 
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Enable RLS on storage.objects
alter table storage.objects enable row level security;
