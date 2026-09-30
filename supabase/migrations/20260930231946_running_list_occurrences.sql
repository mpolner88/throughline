-- Ordinary task identity is independent of immutable extraction/evaluation lineage.
-- All application entry points are service-only and share capture's owner lock.
alter table public.throughline_recordings
  add column if not exists task_revision bigint not null default 1,
  add column if not exists tasks_initialized boolean not null default false;
create table public.throughline_task_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  cutover_at timestamptz not null default clock_timestamp(),
  snapshot_version bigint not null default 1 check(snapshot_version > 0)
);
create table public.throughline_task_occurrences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recording_id text not null references public.throughline_recordings(id) on delete cascade,
  version bigint not null default 1 check(version > 0),
  source_order integer not null check(source_order >= 0),
  todo_data jsonb not null,
  text text not null,
  status text not null check(status in ('open','completed')),
  completed_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  origin_local_date date,
  source_created_at timestamptz not null,
  source_local_date date,
  source_timezone text,
  is_earlier boolean not null,
  placement_override text check(placement_override in ('today','this_week','later')),
  placement_anchor_date date,
  completed_placement text check(completed_placement in ('today','this_week','later')),
  legacy_keys text[] not null,
  deleted_at timestamptz
);
create index throughline_tasks_owner_page on public.throughline_task_occurrences(owner_id,id) where deleted_at is null;
create index throughline_tasks_note on public.throughline_task_occurrences(recording_id,source_order);
create table public.throughline_task_mutations (
  owner_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  recording_id text not null references public.throughline_recordings(id) on delete cascade,
  task_id uuid references public.throughline_task_occurrences(id) on delete cascade,
  request jsonb not null,
  response jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(owner_id,mutation_id)
);
alter table public.throughline_task_accounts enable row level security;
alter table public.throughline_task_occurrences enable row level security;
alter table public.throughline_task_mutations enable row level security;
revoke all on public.throughline_task_accounts,public.throughline_task_occurrences,public.throughline_task_mutations from public,anon,authenticated;
grant all on public.throughline_task_accounts,public.throughline_task_occurrences,public.throughline_task_mutations to service_role;

create function public.throughline_task_date_v1(value text) returns date
language plpgsql immutable set search_path='' as $$
declare d date;
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  d := value::date;
  if to_char(d,'YYYY-MM-DD') <> value then return null; end if;
  return d;
exception when others then return null;
end $$;
create function public.throughline_task_key_v1(value text) returns text
language sql immutable set search_path='' as $$
  select trim(regexp_replace(lower(regexp_replace(coalesce(value,''),'[^[:alnum:][:space:]-]','','g')),'[[:space:]]+',' ','g'));
$$;
create function public.throughline_task_instant_v1(value text) returns timestamptz
language plpgsql stable set search_path='' as $$
declare instant timestamptz;
begin instant := value::timestamptz; if not isfinite(instant) then return null; end if; return instant; exception when others then return null; end $$;

create function public.throughline_task_guard_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner uuid; enrolled boolean;
begin
  owner := case when tg_op='DELETE' then old.auth_user_id else new.auth_user_id end;
  if owner is not null then perform public.throughline_capture_owner_lock_v1(owner); end if;
  enrolled := exists(select 1 from public.throughline_task_accounts where owner_id=owner);
  if tg_op='UPDATE' then
    if new.auth_user_id is distinct from old.auth_user_id then raise exception 'update_required'; end if;
    if enrolled and current_setting('throughline.task_write',true) is distinct from 'allowed'
      and (new.structured_note is distinct from old.structured_note
        or new.recording->'structured_note' is distinct from old.recording->'structured_note'
        or new.transcript_raw is distinct from old.transcript_raw
        or new.tasks_initialized is distinct from old.tasks_initialized)
    then raise exception 'update_required'; end if;
    new.task_revision := old.task_revision+1;
  elsif tg_op='INSERT' and enrolled and new.structured_note is not null
    and current_setting('throughline.task_write',true) is distinct from 'allowed'
  then raise exception 'update_required'; end if;
  -- The auth parent is already gone during ON DELETE CASCADE; touching its child would recheck a now-invalid FK.
  if enrolled and exists(select 1 from auth.users where id=owner) then
    update public.throughline_task_accounts set snapshot_version=snapshot_version+1 where owner_id=owner;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger throughline_task_guard before insert or update or delete on public.throughline_recordings
for each row execute function public.throughline_task_guard_v1();

create function public.throughline_task_dto_v1(t public.throughline_task_occurrences) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object(
  'id',t.id,'recording_id',t.recording_id,'version',t.version,'source_order',t.source_order,
  'text',t.text,'status',t.status,'completed_at',t.completed_at,
  'due',case when jsonb_typeof(t.todo_data->'due')='string' then t.todo_data->'due' else 'null'::jsonb end,
  'for_date',case when jsonb_typeof(t.todo_data->'for_date')='string' then t.todo_data->'for_date' else 'null'::jsonb end,'created_at',t.created_at,
  'origin_local_date',t.origin_local_date,'source_created_at',t.source_created_at,
  'source_local_date',t.source_local_date,'source_timezone',t.source_timezone,
  'source_title',coalesce((select structured_note->>'title' from public.throughline_recordings where id=t.recording_id),''),
  'is_earlier',t.is_earlier,'placement_override',t.placement_override,
  'placement_anchor_date',t.placement_anchor_date,'completed_placement',t.completed_placement);
$$;
create function public.throughline_task_detail_v1(p_owner uuid,p_id text) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('recording',r.recording,'current_revision_id',r.current_note_revision_id)
  || case when a.owner_id is null then '{}'::jsonb else jsonb_build_object(
    'task_contract_version',1,'task_revision',r.task_revision,'snapshot_version',a.snapshot_version,
    'tasks',coalesce((select jsonb_agg(public.throughline_task_dto_v1(t) order by t.source_order,t.id)
      from public.throughline_task_occurrences t where t.recording_id=r.id and t.owner_id=p_owner and t.deleted_at is null),'[]'::jsonb)) end
 from public.throughline_recordings r left join public.throughline_task_accounts a on a.owner_id=p_owner
 where r.id=p_id and r.auth_user_id=p_owner;
$$;

create function public.throughline_task_project_v1(p_id text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.throughline_recordings; note jsonb; todos jsonb; actions jsonb; tomorrow jsonb;
begin
  select * into strict r from public.throughline_recordings where id=p_id for update;
  note := r.structured_note;
  select coalesce(jsonb_agg(t.todo_data || jsonb_build_object('text',t.text,'status',t.status,'completed_at',t.completed_at)
    order by t.source_order,t.id),'[]'::jsonb) into todos
    from public.throughline_task_occurrences t where recording_id=p_id and deleted_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'text',t.text,'status',t.status,'source','todo','completed_at',t.completed_at)
    order by t.source_order,t.id),'[]'::jsonb) into actions
    from public.throughline_task_occurrences t where recording_id=p_id and deleted_at is null;
  -- Keep unrelated legacy action rows, but never allow their aliases to reopen a managed task.
  actions := actions || coalesce((select jsonb_agg(item) from jsonb_array_elements(case when jsonb_typeof(note->'action_items')='array' then note->'action_items' else '[]'::jsonb end) item
    where jsonb_typeof(item)='object' and jsonb_typeof(item->'text')='string' and coalesce(item->>'source','') <> 'todo' and not exists(select 1 from public.throughline_task_occurrences t
      where t.recording_id=p_id and public.throughline_task_key_v1(item->>'text')=any(t.legacy_keys))),'[]'::jsonb);
  -- tomorrow_todos is a presentation alias. Completed/removed occurrences cannot reappear in MCP.
  select coalesce(jsonb_agg(to_jsonb(value)),'[]'::jsonb) into tomorrow
    from jsonb_array_elements_text(case when jsonb_typeof(note->'tomorrow_todos')='array' then note->'tomorrow_todos' else '[]'::jsonb end) value
    where not exists(select 1 from public.throughline_task_occurrences t where t.recording_id=p_id
      and public.throughline_task_key_v1(value)=any(t.legacy_keys))
    or exists(select 1 from public.throughline_task_occurrences t where t.recording_id=p_id and t.deleted_at is null
      and t.status='open' and t.text=value);
  note := note || jsonb_build_object('todos',todos,'action_items',actions,'tomorrow_todos',tomorrow);
  update public.throughline_recordings set structured_note=note,
    recording=jsonb_set(recording,'{structured_note}',note,true),tasks_initialized=true where id=p_id;
end $$;

create function public.throughline_task_seed_v1(p_owner uuid,p_id text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.throughline_recordings; a public.throughline_task_accounts; item jsonb; ord bigint; local_day date; done timestamptz;
begin
  select * into strict r from public.throughline_recordings where id=p_id and auth_user_id=p_owner for update;
  if r.tasks_initialized or r.structured_note is null or jsonb_typeof(r.structured_note)<>'object' then return; end if;
  select * into strict a from public.throughline_task_accounts where owner_id=p_owner;
  local_day := public.throughline_task_date_v1(left(r.user_local_time,10));
  if local_day is null and exists(select 1 from pg_timezone_names where name=r.timezone) then
    local_day := (r.created_at at time zone r.timezone)::date;
  end if;
  for item,ord in select value,ordinality from jsonb_array_elements(case when jsonb_typeof(r.structured_note->'todos')='array' then r.structured_note->'todos' else '[]'::jsonb end) with ordinality loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item->'text') is distinct from 'string' or nullif(trim(item->>'text'),'') is null then continue; end if;
    done := public.throughline_task_instant_v1(item->>'completed_at');
    insert into public.throughline_task_occurrences(owner_id,recording_id,source_order,todo_data,text,status,completed_at,
      origin_local_date,source_created_at,source_local_date,source_timezone,is_earlier,legacy_keys)
    values(p_owner,p_id,ord-1,item,item->>'text',case when item->>'status' in ('completed','done') then 'completed' else 'open' end,
      case when item->>'status' in ('completed','done') then done end,local_day,r.created_at,local_day,r.timezone,r.created_at<a.cutover_at,
      array[public.throughline_task_key_v1(item->>'text')]);
  end loop;
  perform public.throughline_task_project_v1(p_id);
end $$;

-- Central service-only transaction boundary. Raw request bodies and receipts remain
-- private account data; nothing here emits product events or evaluation contributions.
create function public.throughline_tasks_internal_v1(p_owner uuid,p_operation text,p_recording_id text default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.throughline_task_accounts; r public.throughline_recordings; t public.throughline_task_occurrences;
  receipt public.throughline_task_mutations; result jsonb; request jsonb; body jsonb; item jsonb; note jsonb; proposed jsonb;
  mid uuid; tid uuid; ids uuid[] := '{}'; new_ids jsonb := '[]'; rows jsonb; next_id uuid; amount integer; ord integer;
  completed boolean; instant timestamptz; selector text; matched integer; revision bigint; enrolled boolean; seed_id text;
begin
  if p_owner is null then raise exception 'invalid_task_request'; end if;
  perform public.throughline_capture_owner_lock_v1(p_owner);
  if exists(select 1 from public.throughline_account_deletion_holds where owner_id=p_owner)
    or not exists(select 1 from auth.users where id=p_owner) then raise exception 'account_deletion_pending'; end if;
  select * into a from public.throughline_task_accounts where owner_id=p_owner;
  enrolled := found;
  if p_operation='list' then
    if not enrolled then
      insert into public.throughline_task_accounts(owner_id) values(p_owner);
      for seed_id in select rec.id from public.throughline_recordings rec where rec.auth_user_id=p_owner order by rec.id loop
        perform public.throughline_task_seed_v1(p_owner,seed_id);
      end loop;
    end if;
    select * into strict a from public.throughline_task_accounts where owner_id=p_owner;
    if p_payload->'cursor' is not null and p_payload->'cursor' <> 'null'::jsonb
      and (p_payload->'cursor'->>'snapshot_version')::bigint <> a.snapshot_version then raise exception 'snapshot_changed'; end if;
    amount := coalesce((p_payload->>'limit')::integer,200);
    if amount < 1 or amount > 200 then raise exception 'invalid_task_request'; end if;
    select coalesce(jsonb_agg(public.throughline_task_dto_v1(page::public.throughline_task_occurrences) order by page.id),'[]'::jsonb) into rows
      from (select ts.* from public.throughline_task_occurrences ts where ts.owner_id=p_owner and ts.deleted_at is null
        and (p_payload->'cursor'->>'after' is null or ts.id>(p_payload->'cursor'->>'after')::uuid)
        order by ts.id limit amount) page;
    if jsonb_array_length(rows)>0 then next_id := (rows->-1->>'id')::uuid; end if;
    return jsonb_build_object('contract_version',1,'cutover_at',a.cutover_at,'snapshot_version',a.snapshot_version,'tasks',rows,
      'next_cursor',case when exists(select 1 from public.throughline_task_occurrences where owner_id=p_owner and deleted_at is null and id>next_id)
        then jsonb_build_object('snapshot_version',a.snapshot_version,'after',next_id) else null end);
  end if;
  if p_operation='mutation' then
    select * into t from public.throughline_task_occurrences where id=(p_payload->>'task_id')::uuid and owner_id=p_owner;
    if not found then raise exception 'not_found'; end if;
    if t.deleted_at is not null then raise exception 'task_deleted'; end if;
    p_recording_id := t.recording_id;
  end if;
  select * into r from public.throughline_recordings where id=p_recording_id and auth_user_id=p_owner for update;
  if not found and p_operation<>'insert' then raise exception 'not_found'; end if;
  if p_operation='detail' then return public.throughline_task_detail_v1(p_owner,p_recording_id); end if;
  if p_operation='assert_reextract' then
    if enrolled and r.structured_note is not null then raise exception 'update_required'; end if;
    return jsonb_build_object('allowed',true);
  end if;
  if p_operation in ('mutation','edit') then
    if not enrolled or not r.tasks_initialized then raise exception 'update_required'; end if;
    if r.current_note_revision_id is not null then raise exception 'evaluation_task_conflict'; end if;
    body := case when p_operation='mutation' then p_payload->'body' else p_payload end;
    mid := (body->>'mutation_id')::uuid;
    if mid is null then raise exception 'invalid_task_request'; end if;
    request := jsonb_build_object('operation',p_operation,'recording_id',p_recording_id,'payload',p_payload);
    select * into receipt from public.throughline_task_mutations where owner_id=p_owner and mutation_id=mid;
    if found then
      if receipt.request<>request then raise exception 'idempotency_conflict'; end if;
      return receipt.response;
    end if;
  end if;
  if p_operation='mutation' then
    select * into strict t from public.throughline_task_occurrences where id=t.id for update;
    if body->>'expected_version' is null then raise exception 'invalid_task_request'; end if;
    if t.version<>(body->>'expected_version')::bigint then raise exception 'version_conflict'; end if;
    if body->>'operation'='set_completion' then
      completed := (body->>'completed')::boolean;
      instant := public.throughline_task_instant_v1(body->>'occurred_at');
      if jsonb_typeof(body->'completed') is distinct from 'boolean' or completed is null or instant is null or instant>clock_timestamp()+interval '5 minutes'
        or (completed and (body->>'completion_placement' is null or body->>'completion_placement' not in ('today','this_week','later'))) then raise exception 'invalid_task_request'; end if;
      update public.throughline_task_occurrences set status=case when completed then 'completed' else 'open' end,
        completed_at=case when completed then case when status='completed' then completed_at else instant end end,
        completed_placement=case when completed then case when status='completed' then completed_placement else body->>'completion_placement' end end,
        version=version+1 where id=t.id;
    elsif body->>'operation'='set_placement' then
      if body->>'placement' is null or body->>'placement' not in ('today','this_week','later') or public.throughline_task_date_v1(body->>'anchor_date') is null
        then raise exception 'invalid_task_request'; end if;
      update public.throughline_task_occurrences set placement_override=body->>'placement',placement_anchor_date=(body->>'anchor_date')::date,
        is_earlier=false,version=version+1 where id=t.id;
    else raise exception 'invalid_task_request'; end if;
    perform public.throughline_task_project_v1(p_recording_id);
    select * into t from public.throughline_task_occurrences where id=t.id;
    select snapshot_version into revision from public.throughline_task_accounts where owner_id=p_owner;
    result := jsonb_build_object('mutation_id',mid,'snapshot_version',revision,'task',public.throughline_task_dto_v1(t));
  elsif p_operation='edit' then
    if body->>'expected_task_revision' is null then raise exception 'invalid_task_request'; end if;
    if r.task_revision<>(body->>'expected_task_revision')::bigint then raise exception 'version_conflict'; end if;
    note := r.structured_note;
    if body ? 'todos' then
      if jsonb_typeof(body->'todos')<>'array' or public.throughline_task_date_v1(body->>'edited_local_date') is null then raise exception 'invalid_task_request'; end if;
      ord := 0;
      for item in select value from jsonb_array_elements(body->'todos') loop
        if jsonb_typeof(item->'text') is distinct from 'string' or nullif(trim(item->>'text'),'') is null
          or ((item ? 'id')::integer+(item ? 'client_item_id')::integer)<>1 then raise exception 'invalid_task_request'; end if;
        if item ? 'id' then
          tid := (item->>'id')::uuid;
          select * into t from public.throughline_task_occurrences where id=tid and recording_id=p_recording_id and owner_id=p_owner and deleted_at is null for update;
          if not found or tid=any(ids) then raise exception 'version_conflict'; end if;
          update public.throughline_task_occurrences set text=trim(item->>'text'),source_order=ord,version=version+1,
            legacy_keys=case when public.throughline_task_key_v1(trim(item->>'text'))=any(legacy_keys) then legacy_keys
              else array_append(legacy_keys,public.throughline_task_key_v1(trim(item->>'text'))) end where id=tid;
        else
          if item->>'client_item_id' is null then raise exception 'invalid_task_request'; end if;
          tid := gen_random_uuid();
          if exists(select 1 from jsonb_array_elements(new_ids) n where n->>'client_item_id'=item->>'client_item_id') then raise exception 'invalid_task_request'; end if;
          insert into public.throughline_task_occurrences(id,owner_id,recording_id,source_order,todo_data,text,status,origin_local_date,
            source_created_at,source_local_date,source_timezone,is_earlier,legacy_keys)
          values(tid,p_owner,p_recording_id,ord,jsonb_build_object('priority',null,'due',null,'for_date',null,'context','manual_edit'),
            trim(item->>'text'),'open',(body->>'edited_local_date')::date,r.created_at,public.throughline_task_date_v1(left(r.user_local_time,10)),r.timezone,false,
            array[public.throughline_task_key_v1(trim(item->>'text'))]);
          new_ids := new_ids || jsonb_build_array(jsonb_build_object('client_item_id',item->>'client_item_id','id',tid));
        end if;
        ids := array_append(ids,tid); ord := ord+1;
      end loop;
      update public.throughline_task_occurrences set deleted_at=clock_timestamp(),version=version+1 where recording_id=p_recording_id and deleted_at is null and not(id=any(ids));
    end if;
    if body ? 'title' then
      if nullif(trim(body->>'title'),'') is null or length(trim(body->>'title'))>80 then raise exception 'invalid_task_request'; end if;
      note := jsonb_set(note,'{title}',to_jsonb(trim(body->>'title')),true);
    end if;
    if body ? 'summary' then note := jsonb_set(note,'{summary}',to_jsonb(trim(body->>'summary')),true); end if;
    if body ? 'most_important' then note := jsonb_set(note,'{most_important}',body->'most_important',true); end if;
    proposed := r.recording || jsonb_build_object('structured_note',note);
    if body ? 'transcript' then proposed := proposed || jsonb_build_object('transcript_raw',trim(body->>'transcript')); end if;
    update public.throughline_recordings set structured_note=note,transcript_raw=proposed->>'transcript_raw',recording=proposed where id=p_recording_id;
    perform public.throughline_task_project_v1(p_recording_id);
    result := public.throughline_task_detail_v1(p_owner,p_recording_id) || jsonb_build_object('mutation_id',mid,'created_task_ids',new_ids);
  elsif p_operation='legacy' then
    if r.recording is distinct from p_payload->'before' then raise exception 'version_conflict'; end if;
    proposed := p_payload->'after'; body := p_payload->'body';
    if enrolled then
      if r.current_note_revision_id is not null then raise exception 'evaluation_task_conflict'; end if;
      if p_payload->>'kind'='completion' then
        selector := public.throughline_task_key_v1(body->>'text');
        select count(*) into matched from public.throughline_task_occurrences where recording_id=p_recording_id and selector=any(legacy_keys);
        select * into t from public.throughline_task_occurrences where recording_id=p_recording_id and deleted_at is null and public.throughline_task_key_v1(text)=selector;
        if matched<>1 or not found then raise exception 'update_required'; end if;
        completed := (body->>'completed')::boolean;
        update public.throughline_task_occurrences set status=case when completed then 'completed' else 'open' end,
          completed_at=case when completed then case when status='completed' then completed_at else clock_timestamp() end end,
          completed_placement=case when completed then completed_placement end,version=version+1 where id=t.id;
        -- Never copy legacy text-derived completion over other occurrence fields.
        proposed := r.recording;
      else
        if body ? 'todos' and body->'todos' is distinct from
          (select coalesce(jsonb_agg(to_jsonb(ts.text) order by ts.source_order,ts.id),'[]'::jsonb) from public.throughline_task_occurrences ts where ts.recording_id=p_recording_id and ts.deleted_at is null)
          then raise exception 'update_required'; end if;
        if body ? 'tomorrow_todos' and body->'tomorrow_todos' is distinct from r.structured_note->'tomorrow_todos' then raise exception 'update_required'; end if;
        proposed := jsonb_set(proposed,'{structured_note,todos}',r.structured_note->'todos',true);
        proposed := jsonb_set(proposed,'{structured_note,tomorrow_todos}',coalesce(r.structured_note->'tomorrow_todos','[]'::jsonb),true);
      end if;
    end if;
    update public.throughline_recordings set structured_note=proposed->'structured_note',transcript_raw=proposed->>'transcript_raw',
      type=proposed->>'type',recording=proposed where id=p_recording_id;
    if enrolled and r.structured_note is not null then perform public.throughline_task_project_v1(p_recording_id); end if;
    return public.throughline_task_detail_v1(p_owner,p_recording_id);
  elsif p_operation in ('insert','processing') then
    proposed := p_payload->'recording';
    if proposed->>'auth_user_id' is distinct from p_owner::text or proposed->>'id' is distinct from p_recording_id then raise exception 'invalid_task_request'; end if;
    if p_operation='insert' then
      if r.id is not null then raise exception 'version_conflict'; end if;
      insert into public.throughline_recordings(id,user_id,auth_user_id,capture_id,created_at,user_local_time,timezone,duration_seconds,type,status,processing_status,transcript_raw,structured_note,audio,recording)
      values(p_recording_id,coalesce(proposed->>'user_id',p_owner::text),p_owner,(proposed->>'capture_id')::uuid,(proposed->>'created_at')::timestamptz,
        proposed->>'user_local_time',proposed->>'timezone',(proposed->>'duration_seconds')::numeric,proposed->>'type',proposed->>'status',proposed->>'processing_status',
        proposed->>'transcript_raw',nullif(proposed->'structured_note','null'::jsonb),proposed->'audio',proposed);
    else
      if enrolled and r.tasks_initialized then raise exception 'version_conflict'; end if;
      -- Preserve current audio metadata: retention can finish during extraction.
      proposed := proposed || jsonb_build_object('audio',r.audio);
      if r.recording ? 'audio_retention' then proposed := proposed || jsonb_build_object('audio_retention',r.recording->'audio_retention'); end if;
      update public.throughline_recordings set transcript_raw=proposed->>'transcript_raw',structured_note=nullif(proposed->'structured_note','null'::jsonb),
        type=proposed->>'type',status=proposed->>'status',processing_status=proposed->>'processing_status',recording=proposed where id=p_recording_id;
    end if;
    if enrolled then perform public.throughline_task_seed_v1(p_owner,p_recording_id); end if;
    return public.throughline_task_detail_v1(p_owner,p_recording_id);
  elsif p_operation='audio' then
    update public.throughline_recordings set audio=p_payload->'audio',
      recording=recording || jsonb_build_object('audio',p_payload->'audio','audio_retention',p_payload->'audio_retention') where id=p_recording_id;
    return jsonb_build_object('updated',true);
  elsif p_operation='delete' then
    delete from public.throughline_recordings where id=p_recording_id;
    return jsonb_build_object('deleted',true);
  else raise exception 'invalid_task_request'; end if;
  insert into public.throughline_task_mutations(owner_id,mutation_id,recording_id,task_id,request,response)
    values(p_owner,mid,p_recording_id,case when p_operation='mutation' then t.id end,request,result);
  return result;
exception
  when raise_exception then
    if sqlerrm in ('version_conflict','snapshot_changed','idempotency_conflict','update_required','task_deleted','not_found','account_deletion_pending','evaluation_task_conflict','invalid_task_request')
      then return jsonb_build_object('error_code',sqlerrm); end if;
    raise;
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or check_violation or not_null_violation then
    return jsonb_build_object('error_code','invalid_task_request');
end $$;

create function public.throughline_tasks_v1(p_owner uuid,p_operation text,p_recording_id text default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; previous text := current_setting('throughline.task_write',true);
begin
  perform set_config('throughline.task_write','allowed',true);
  result := public.throughline_tasks_internal_v1(p_owner,p_operation,p_recording_id,p_payload);
  perform set_config('throughline.task_write',coalesce(previous,''),true);
  return result;
exception when others then
  perform set_config('throughline.task_write',coalesce(previous,''),true);
  raise;
end $$;

-- Private helpers are never a direct client surface.
revoke all on function public.throughline_task_date_v1(text),public.throughline_task_key_v1(text),public.throughline_task_instant_v1(text),
 public.throughline_task_guard_v1(),public.throughline_task_dto_v1(public.throughline_task_occurrences),public.throughline_task_detail_v1(uuid,text),
 public.throughline_task_project_v1(text),public.throughline_task_seed_v1(uuid,text),public.throughline_tasks_internal_v1(uuid,text,text,jsonb),public.throughline_tasks_v1(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.throughline_tasks_v1(uuid,text,text,jsonb) to service_role;
