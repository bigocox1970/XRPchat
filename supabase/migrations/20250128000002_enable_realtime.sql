-- Drop existing publication to ensure clean state
drop publication if exists supabase_realtime;

-- Create realtime publication with explicit configuration
create publication supabase_realtime for all tables
with (publish = 'insert,update,delete');

-- Enable realtime replication for messages table
alter table messages replica identity full;
comment on table messages is '@realtime={"*": true}';
alter table messages set (replica_identity = 'full');

-- Enable realtime replication for threads table
alter table threads replica identity full;
comment on table threads is '@realtime={"*": true}';
alter table threads set (replica_identity = 'full');

-- Grant necessary permissions
grant select, insert, update on messages to authenticated;
grant select, update on threads to authenticated;

-- Enable row level security
alter table messages force row level security;
alter table threads force row level security;

-- Ensure policies are properly set for realtime
drop policy if exists "Users can view messages in their threads" on messages;
create policy "Users can view messages in their threads"
  on messages for select
  using (
    exists (
      select 1 from threads
      where id = messages.thread_id
      and auth.uid() = any(participant_ids)
    )
  );

drop policy if exists "Users can insert messages in their threads" on messages;
create policy "Users can insert messages in their threads"
  on messages for insert
  with check (
    exists (
      select 1 from threads
      where id = thread_id
      and auth.uid() = any(participant_ids)
    )
  );

drop policy if exists "Users can update read status of their messages" on messages;
create policy "Users can update read status of their messages"
  on messages for update
  using (
    exists (
      select 1 from threads
      where id = messages.thread_id
      and auth.uid() = any(participant_ids)
    )
  );
