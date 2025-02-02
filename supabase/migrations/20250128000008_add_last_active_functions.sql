-- Function to add last_active column if it doesn't exist
create or replace function add_last_active_column()
returns void as $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'profiles'
    and column_name = 'last_active'
  ) then
    alter table public.profiles
    add column last_active timestamp with time zone default timezone('utc'::text, now());
  end if;
end;
$$ language plpgsql security definer;

-- Function to update last_active
create or replace function update_last_active()
returns trigger as $$
begin
  update public.profiles
  set last_active = now()
  where id = new.sender_id;
  return new;
end;
$$ language plpgsql security definer;

-- Function to create the trigger
create or replace function create_update_last_active_trigger()
returns void as $$
begin
  drop trigger if exists update_last_active_on_message on public.messages;
  
  create trigger update_last_active_on_message
    after insert on public.messages
    for each row
    execute function update_last_active();
end;
$$ language plpgsql security definer;
