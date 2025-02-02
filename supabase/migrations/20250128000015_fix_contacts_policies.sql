-- Drop existing policies
drop policy if exists "Users can view their own contacts" on public.contacts;
drop policy if exists "Users can add their own contacts" on public.contacts;
drop policy if exists "Users can delete their own contacts" on public.contacts;
drop policy if exists "Users can update their own contacts" on public.contacts;
drop policy if exists "Users can view profiles of contacts" on public.profiles;

-- Recreate policies with proper conditions
create policy "Users can view their own contacts"
  on public.contacts for select
  using ( auth.uid() = user_id );

create policy "Users can add their own contacts"
  on public.contacts for insert
  with check ( auth.uid() = user_id );

create policy "Users can delete their own contacts"
  on public.contacts for delete
  using ( auth.uid() = user_id );

create policy "Users can update their own contacts"
  on public.contacts for update
  using ( auth.uid() = user_id );

-- Add policy to allow viewing profiles of contacts and own profile
create policy "Users can view profiles of contacts and self"
  on public.profiles for select
  using (
    id = auth.uid() or
    exists (
      select 1 from public.contacts
      where contacts.contact_id = profiles.id
      and contacts.user_id = auth.uid()
    )
  );

-- Enable RLS on both tables
alter table public.contacts enable row level security;
alter table public.profiles enable row level security;
