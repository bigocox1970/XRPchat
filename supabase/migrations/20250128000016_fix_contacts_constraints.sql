-- Drop existing foreign key constraints
alter table public.contacts drop constraint if exists contacts_user_id_fkey;
alter table public.contacts drop constraint if exists contacts_contact_id_fkey;

-- Drop existing indexes
drop index if exists contacts_user_id_idx;
drop index if exists contacts_contact_id_idx;

-- Recreate the contacts table with proper constraints
drop table if exists public.contacts cascade;
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null,
  contact_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  constraint contacts_user_id_fkey foreign key (user_id)
    references public.profiles(id) on delete cascade,
  constraint contacts_contact_id_fkey foreign key (contact_id)
    references public.profiles(id) on delete cascade,
  constraint contacts_unique_pair unique (user_id, contact_id)
);

-- Create indexes for better performance
create index contacts_user_id_idx on public.contacts using btree (user_id);
create index contacts_contact_id_idx on public.contacts using btree (contact_id);
create index contacts_created_at_idx on public.contacts using btree (created_at);

-- Enable RLS
alter table public.contacts enable row level security;

-- Recreate RLS policies
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
