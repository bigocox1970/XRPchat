-- Add last_active column to profiles table
alter table public.profiles
add column if not exists last_active timestamp with time zone default timezone('utc'::text, now());

-- Update existing profiles to have current timestamp as last_active
update public.profiles
set last_active = updated_at
where last_active is null;

-- Create function to update last_active
create or replace function update_last_active()
returns trigger as $$
begin
  update public.profiles
  set last_active = now()
  where id = new.sender_id;
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to update last_active when message is sent
drop trigger if exists update_last_active_on_message on public.messages;
create trigger update_last_active_on_message
  after insert on public.messages
  for each row
  execute function update_last_active();
