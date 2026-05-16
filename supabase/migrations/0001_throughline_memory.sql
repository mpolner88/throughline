-- Throughline v0 hosted memory store.
-- Run this in a Supabase project before setting THROUGHLINE_STORAGE=supabase.

create table if not exists public.throughline_recordings (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null,
  user_local_time text,
  timezone text,
  duration_seconds numeric,
  type text check (type in ('morning', 'evening', 'weekly_review', 'freeform')),
  status text not null,
  processing_status text not null,
  transcript_raw text,
  structured_note jsonb,
  audio jsonb,
  recording jsonb not null
);

create index if not exists throughline_recordings_user_created_idx
  on public.throughline_recordings (user_id, created_at desc);

create index if not exists throughline_recordings_type_idx
  on public.throughline_recordings (type);

create index if not exists throughline_recordings_processing_idx
  on public.throughline_recordings (processing_status);

create table if not exists public.throughline_feedback (
  id text primary key,
  recording_id text references public.throughline_recordings (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null,
  status text not null,
  answers jsonb not null,
  expected jsonb,
  recording_snapshot jsonb,
  feedback jsonb not null
);

create index if not exists throughline_feedback_recording_idx
  on public.throughline_feedback (recording_id);

create index if not exists throughline_feedback_user_created_idx
  on public.throughline_feedback (user_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('throughline-audio', 'throughline-audio', false)
on conflict (id) do nothing;
