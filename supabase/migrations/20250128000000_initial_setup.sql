-- Create profiles table
create table public.profiles (
  id uuid references auth.users primary key,
  username text unique not null,
  avatar_url text,
  wallet_address text unique not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;

-- Policies for profiles
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id or auth.role() = 'service_role' );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Create wallets table
create table public.wallets (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles not null unique,
  address text not null unique,
  public_key text not null,
  private_key text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS for wallets
alter table public.wallets enable row level security;

-- Policies for wallets
create policy "Users can view their own wallet"
  on public.wallets for select
  using ( auth.uid() = profile_id );

create policy "Users can insert their own wallet"
  on public.wallets for insert
  with check ( auth.uid() = profile_id or auth.role() = 'service_role' );

create policy "Users can update their own wallet"
  on public.wallets for update
  using ( auth.uid() = profile_id );

-- Create threads table
create table public.threads (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  name text not null,
  participant_ids uuid[] not null,
  last_message_at timestamp with time zone,
  created_by uuid references public.profiles not null
);

-- Enable RLS for threads
alter table public.threads enable row level security;

-- Policies for threads
create policy "Users can view threads they're part of"
  on public.threads for select
  using ( auth.uid() = any(participant_ids) );

create policy "Users can insert threads they create"
  on public.threads for insert
  with check ( auth.uid() = created_by );

create policy "Users can update threads they're part of"
  on public.threads for update
  using ( auth.uid() = any(participant_ids) );

-- Create messages table
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  thread_id uuid references public.threads not null,
  sender_id uuid references public.profiles not null,
  content text not null,
  read boolean default false
);

-- Enable RLS for messages
alter table public.messages enable row level security;

-- Policies for messages
create policy "Users can view messages in their threads"
  on public.messages for select
  using (
    exists (
      select 1 from public.threads
      where id = messages.thread_id
      and auth.uid() = any(participant_ids)
    )
  );

create policy "Users can insert messages in their threads"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.threads
      where id = thread_id
      and auth.uid() = any(participant_ids)
    )
  );

create policy "Users can update read status of their messages"
  on public.messages for update
  using (
    exists (
      select 1 from public.threads
      where id = messages.thread_id
      and auth.uid() = any(participant_ids)
    )
  );

-- Create send_message function
create or replace function public.send_message(
  p_thread_id uuid,
  p_content text,
  p_sender_id uuid
) returns public.messages as $$
declare
  v_message public.messages;
begin
  -- Insert the message
  insert into public.messages (thread_id, sender_id, content)
  values (p_thread_id, p_sender_id, p_content)
  returning * into v_message;

  -- Update thread's last_message_at
  update public.threads
  set last_message_at = v_message.created_at
  where id = p_thread_id;

  return v_message;
end;
$$ language plpgsql security definer;

-- Create indexes
create index profiles_username_idx on public.profiles using btree (username);
create index profiles_wallet_address_idx on public.profiles using btree (wallet_address);
create index wallets_profile_id_idx on public.wallets using btree (profile_id);
create index wallets_address_idx on public.wallets using btree (address);
create index threads_participant_ids_idx on public.threads using gin (participant_ids);
create index threads_last_message_at_idx on public.threads using btree (last_message_at);
create index messages_thread_id_idx on public.messages using btree (thread_id);
create index messages_sender_id_idx on public.messages using btree (sender_id);
create index messages_created_at_idx on public.messages using btree (created_at);

-- Create thread timestamp update trigger
create or replace function public.update_thread_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_thread_timestamp
  before update on public.threads
  for each row
  execute function public.update_thread_timestamp();

-- Create function to handle profile creation during signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Extract metadata from the user
  insert into public.profiles (id, username, wallet_address)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'wallet_address');

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger to automatically create profile when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to confirm a user's email
create or replace function public.confirm_user(user_id uuid)
returns void as $$
begin
  -- Update the user's email_confirmed_at timestamp
  update auth.users
  set email_confirmed_at = now(),
      updated_at = now()
  where id = user_id;
end;
$$ language plpgsql security definer;
