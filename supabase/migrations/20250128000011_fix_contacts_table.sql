-- Drop and recreate contacts table with proper foreign keys
drop table if exists public.contacts;

create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null,
  contact_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  foreign key (user_id) references public.profiles(id) on delete cascade,
  foreign key (contact_id) references public.profiles(id) on delete cascade,
  unique(user_id, contact_id)
);

-- Enable RLS for contacts
alter table public.contacts enable row level security;

-- Policies for contacts
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

-- Create indexes
create index contacts_user_id_idx on public.contacts using btree (user_id);
create index contacts_contact_id_idx on public.contacts using btree (contact_id);
