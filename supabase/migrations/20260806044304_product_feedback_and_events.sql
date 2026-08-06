-- Product-learning foundation for Throughline.
--
-- The iOS app writes through the authenticated Edge Function. Direct Data API
-- access stays disabled for public clients, and telemetry never contains voice
-- recordings, transcripts, note bodies, or other user-created note content.

create table if not exists public.throughline_product_events (
  id text primary key,
  auth_user_id uuid references auth.users (id) on delete cascade,
  session_id uuid not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  event_name text not null check (
    char_length(event_name) between 1 and 80
    and event_name ~ '^[a-z][a-z0-9_]*$'
  ),
  platform text not null default 'ios' check (platform in ('ios')),
  app_version text,
  build_number text,
  properties jsonb not null default '{}'::jsonb
    check (jsonb_typeof(properties) = 'object')
);

create index if not exists throughline_product_events_user_occurred_idx
  on public.throughline_product_events (auth_user_id, occurred_at desc)
  where auth_user_id is not null;

create index if not exists throughline_product_events_session_occurred_idx
  on public.throughline_product_events (session_id, occurred_at desc);

create index if not exists throughline_product_events_name_occurred_idx
  on public.throughline_product_events (event_name, occurred_at desc);

create table if not exists public.throughline_product_feedback (
  id text primary key,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  source text not null default 'ios' check (source in ('ios', 'app_store', 'email', 'x', 'reddit', 'support')),
  category text not null check (category in ('general', 'idea', 'problem', 'praise')),
  message text not null check (char_length(message) between 1 and 4000),
  contact_allowed boolean not null default false,
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'planned', 'shipped', 'closed')
  ),
  app_version text,
  build_number text,
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object')
);

create index if not exists throughline_product_feedback_user_created_idx
  on public.throughline_product_feedback (auth_user_id, created_at desc);

create index if not exists throughline_product_feedback_status_created_idx
  on public.throughline_product_feedback (status, created_at desc);

alter table public.throughline_product_events enable row level security;
alter table public.throughline_product_feedback enable row level security;

revoke all on table public.throughline_product_events from anon, authenticated;
revoke all on table public.throughline_product_feedback from anon, authenticated;

grant select, insert, update, delete on table public.throughline_product_events to service_role;
grant select, insert, update, delete on table public.throughline_product_feedback to service_role;
