-- Function to verify and fix contacts data
create or replace function verify_contacts_data()
returns void as $$
declare
  v_count int;
begin
  -- Check if contacts table exists
  select count(*) into v_count
  from information_schema.tables
  where table_schema = 'public'
  and table_name = 'contacts';

  if v_count = 0 then
    raise notice 'Creating contacts table...';
    
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

    create index contacts_user_id_idx on public.contacts using btree (user_id);
    create index contacts_contact_id_idx on public.contacts using btree (contact_id);
    create index contacts_created_at_idx on public.contacts using btree (created_at);

    alter table public.contacts enable row level security;

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
  end if;

  -- Remove any orphaned contacts (where user_id or contact_id doesn't exist in profiles)
  delete from public.contacts
  where user_id not in (select id from public.profiles)
  or contact_id not in (select id from public.profiles);

  -- Remove any duplicate contacts
  with duplicates as (
    select user_id, contact_id,
    row_number() over (partition by user_id, contact_id order by created_at) as rnum
    from public.contacts
  )
  delete from public.contacts
  where (user_id, contact_id) in (
    select user_id, contact_id
    from duplicates
    where rnum > 1
  );

  -- Update last_active for all profiles
  update public.profiles
  set last_active = coalesce(last_active, updated_at, now())
  where last_active is null;
end;
$$ language plpgsql;

-- Execute the verification function
select verify_contacts_data();
