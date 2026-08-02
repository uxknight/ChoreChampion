-- Chore Champions — API-role privileges.
-- Tables created in migrations don't automatically receive the anon/authenticated/
-- service_role GRANTs that Supabase applies to dashboard-created tables. Row access
-- is still governed by RLS; these grants only make the tables reachable by PostgREST.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on routines to anon, authenticated, service_role;

-- Re-lock the service-only tally entrypoint (the blanket routine grant above re-exposed it).
revoke execute on function _tally(uuid, text) from public, anon, authenticated;
grant execute on function _tally(uuid, text) to service_role;
