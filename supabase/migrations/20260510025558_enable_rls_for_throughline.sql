-- Keep Throughline memory private by default.
--
-- The iOS app talks to Supabase Edge Functions. Those functions use the
-- service role key server-side, so public client roles do not need direct
-- table access through the Data API.

alter table public.throughline_recordings enable row level security;
alter table public.throughline_feedback enable row level security;

revoke all on table public.throughline_recordings from anon, authenticated;
revoke all on table public.throughline_feedback from anon, authenticated;
