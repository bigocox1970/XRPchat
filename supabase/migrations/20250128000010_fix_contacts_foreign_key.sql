-- Drop existing foreign key constraints
alter table public.contacts drop constraint if exists contacts_contact_id_fkey;
alter table public.contacts drop constraint if exists contacts_user_id_fkey;

-- Re-add foreign key constraints with proper references
alter table public.contacts
  add constraint contacts_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade;

alter table public.contacts
  add constraint contacts_contact_id_fkey
  foreign key (contact_id)
  references public.profiles(id)
  on delete cascade;

-- Add RLS policy for update
create policy "Users can update their own contacts"
  on public.contacts for update
  using ( auth.uid() = user_id );
