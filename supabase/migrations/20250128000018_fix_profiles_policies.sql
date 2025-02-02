-- Drop existing policies
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view profiles of contacts and self" on public.profiles;

-- Create new policies
create policy "Users can view their own profile"
  on public.profiles for select
  using ( auth.uid() = id );

create policy "Users can view contacts' profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.contacts
      where (contacts.contact_id = profiles.id and contacts.user_id = auth.uid())
      or (contacts.user_id = profiles.id and contacts.contact_id = auth.uid())
    )
  );

create policy "Users can view searchable profiles"
  on public.profiles for select
  using (
    not exists (
      select 1 from public.contacts
      where (contacts.contact_id = profiles.id and contacts.user_id = auth.uid())
      or (contacts.user_id = profiles.id and contacts.contact_id = auth.uid())
    )
    and id != auth.uid()
  );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Ensure RLS is enabled
alter table public.profiles enable row level security;

-- Update last_active for all profiles
update public.profiles
set last_active = now()
where last_active is null;
