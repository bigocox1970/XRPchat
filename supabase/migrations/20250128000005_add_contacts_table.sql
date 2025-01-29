-- Create contacts table
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles not null,
  contact_id uuid references public.profiles not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
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

-- Create index
create index contacts_user_id_idx on public.contacts using btree (user_id);
create index contacts_contact_id_idx on public.contacts using btree (contact_id);
