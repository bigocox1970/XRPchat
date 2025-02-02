-- Update any profiles with null last_active to use their updated_at time
update public.profiles
set last_active = updated_at
where last_active is null;

-- Set default value for last_active to current timestamp
alter table public.profiles
alter column last_active set default timezone('utc'::text, now());

-- Make last_active not nullable
alter table public.profiles
alter column last_active set not null;
