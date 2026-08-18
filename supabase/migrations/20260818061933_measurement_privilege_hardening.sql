-- Normalize privileges that older Supabase projects granted implicitly.
-- The client owns only its profile through RLS. Edge Functions use the
-- service role for the recording and feedback REST operations.

revoke all privileges on table public.throughline_profiles
from public, anon, authenticated;

grant select, insert, update on table public.throughline_profiles
to authenticated;

revoke all privileges on table
  public.throughline_recordings,
  public.throughline_feedback
from public, anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.throughline_recordings,
  public.throughline_feedback
to service_role;
