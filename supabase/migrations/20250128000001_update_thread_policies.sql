-- Drop existing thread policies
drop policy if exists "Users can insert threads they're part of" on public.threads;
drop policy if exists "Users can view threads they're part of" on public.threads;
drop policy if exists "Users can update threads they're part of" on public.threads;
drop policy if exists "Users can insert threads they create" on public.threads;
drop policy if exists "Users can delete threads they're part of" on public.threads;

-- Ensure RLS is enabled
alter table public.threads enable row level security;

-- Recreate thread policies with proper permissions
create policy "Users can view threads they're part of"
  on public.threads
  for select
  using ( auth.uid() = any(participant_ids) );

create policy "Users can insert threads they create"
  on public.threads
  for insert
  with check ( 
    auth.uid() = created_by 
    and auth.uid() = any(participant_ids)
  );

create policy "Users can update threads they're part of"
  on public.threads
  for update
  using ( auth.uid() = any(participant_ids) );

create policy "Users can delete threads they're part of"
  on public.threads
  for delete
  using ( auth.uid() = any(participant_ids) );

-- Grant necessary permissions
grant usage on schema public to authenticated;
grant all on public.threads to authenticated;
