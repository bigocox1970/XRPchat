-- Add last_active column to profiles
alter table public.profiles
add column last_active timestamp with time zone default timezone('utc'::text, now());

-- Create function to update last_active
create or replace function public.update_last_active()
returns trigger as $$
begin
  update public.profiles
  set last_active = now()
  where id = new.sender_id;
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to update last_active when user sends a message
create trigger update_last_active_on_message
  after insert on public.messages
  for each row
  execute function public.update_last_active();
