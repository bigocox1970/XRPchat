-- Drop existing foreign key constraints
alter table public.contacts drop constraint if exists contacts_contact_id_fkey;

-- Add the foreign key constraint with the correct reference
alter table public.contacts
  add constraint contacts_contact_id_fkey
  foreign key (contact_id)
  references public.profiles(id)
  on delete cascade;

-- Add explicit reference name for the join
comment on constraint contacts_contact_id_fkey on public.contacts is 'Reference to contact profile';

-- Create RLS policy for joining with profiles
create policy "Users can join contacts with profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.contacts
      where contacts.contact_id = profiles.id
      and contacts.user_id = auth.uid()
    )
    or id = auth.uid()
  );
