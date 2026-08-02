-- Chore Champions — expose the realtime-relevant tables. RLS still applies to
-- each subscriber, so a client only receives changes within its own family.
alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table device_registrations;
