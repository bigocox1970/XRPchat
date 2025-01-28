-- Create realtime publication if it doesn't exist
create publication if not exists supabase_realtime;

-- Enable realtime for messages and threads tables
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table threads;

-- Enable realtime replication for specific columns
alter table messages replica identity full;
alter table threads replica identity full;

-- Ensure realtime is enabled for these tables
alter table messages set (replica_identity = 'full');
alter table threads set (replica_identity = 'full');

-- Grant necessary permissions for realtime
grant select on messages to authenticated;
grant select on threads to authenticated;

-- Enable row level security for realtime
comment on table messages is '@realtime={"*":true}';
comment on table threads is '@realtime={"*":true}';
