-- Drop existing contacts table and related objects
drop table if exists public.contacts cascade;
drop policy if exists "Users can view their own contacts" on public.contacts;
drop policy if exists "Users can add their own contacts" on public.contacts;
drop policy if exists "Users can delete their own contacts" on public.contacts;
drop policy if exists "Users can update their own contacts" on public.contacts;
drop policy if exists "Users can join contacts with profiles" on public.profiles;

-- Recreate contacts table with proper structure
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, contact_id)
);

-- Enable RLS
alter table public.contacts enable row level security;

-- Create policies
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

-- Create policy for profiles to allow contact joins
create policy "Users can view profiles of contacts"
  on public.profiles for select
  using (
    exists (
      select 1 from public.contacts
      where (contacts.contact_id = profiles.id and contacts.user_id = auth.uid())
      or profiles.id = auth.uid()
    )
  );

-- Create indexes
create index contacts_user_id_idx on public.contacts using btree (user_id);
create index contacts_contact_id_idx on public.contacts using btree (contact_id);
