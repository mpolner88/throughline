begin;
select plan(45);
-- Synthetic identities and metadata only; no actual user content or audio.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000091'),('00000000-0000-4000-8000-000000000092');
create temp table capture_fixture(owner_id uuid,capture_id uuid,metadata jsonb,reservation jsonb,accepted jsonb);
insert into capture_fixture values('00000000-0000-4000-8000-000000000091','00000000-0000-4000-8000-000000000093',
  '{"captured_at":"2026-09-29T00:00:00.000Z","timezone":"UTC","user_local_time":"2026-09-29T00:00:00Z","duration_seconds":4,"type":"freeform","mime_type":"audio/mp4"}',null,null);
select ok((select relrowsecurity from pg_class where oid='public.throughline_capture_reservations'::regclass),'reservations have RLS');
select ok(not has_table_privilege('authenticated','public.throughline_capture_reservations','SELECT'),'owners cannot read reservation table');
select ok(not has_table_privilege('anon','public.throughline_capture_tombstones','SELECT'),'anonymous cannot inspect tombstones');
select ok(not has_function_privilege('authenticated','public.throughline_reserve_capture_v1(uuid,uuid,text,bigint,jsonb)','EXECUTE'),'reservation is service-only');
select ok(has_function_privilege('service_role','public.throughline_reserve_capture_v1(uuid,uuid,text,bigint,jsonb)','EXECUTE'),'service may reserve');
select is((select throughline_capture_status_v1(owner_id,capture_id)->>'capture_outcome' from capture_fixture),'nothing_held','missing is only current absence');
select throws_ok($$select throughline_reserve_capture_v1(owner_id,capture_id,repeat('a',64),0,metadata) from capture_fixture$$,'P0001','invalid capture payload','zero audio refused');
update capture_fixture set reservation=throughline_reserve_capture_v1(owner_id,capture_id,repeat('a',64),4,metadata);
select is((select reservation->>'capture_outcome' from capture_fixture),'incomplete','reservation alone is incomplete');
select is((select count(*)::integer from throughline_recordings where capture_id is not null),0,'no recording before storage and acceptance');
select is((select throughline_reserve_capture_v1(owner_id,capture_id,repeat('a',64),4,metadata) from capture_fixture),(select reservation from capture_fixture),'reservation replay resumes same identities');
select is((select throughline_reserve_capture_v1(owner_id,capture_id,repeat('b',64),4,metadata)->>'capture_outcome' from capture_fixture),'conflict','different audio refused');
select is((select throughline_reserve_capture_v1(owner_id,capture_id,repeat('a',64),4,metadata||'{"timezone":"Asia/Tokyo"}')->>'capture_outcome' from capture_fixture),'conflict','different capture metadata refused');
select is((select throughline_reserve_capture_v1('00000000-0000-4000-8000-000000000092',capture_id,repeat('b',64),4,metadata)->>'capture_outcome' from capture_fixture),'incomplete','other owner uses private separate namespace');
select is((select count(distinct recording_id)::integer from throughline_capture_reservations),2,'other owner receives separate recording identity');
create function pg_temp.capture_recording() returns jsonb language sql as $$
 select jsonb_build_object('id',reservation->>'recording_id','auth_user_id',owner_id,'user_id',owner_id,'capture_id',capture_id,
 'created_at',metadata->>'captured_at','user_local_time',metadata->>'user_local_time','timezone',metadata->>'timezone',
 'duration_seconds',4,'type','freeform','status','uploaded','processing_status','uploaded','transcript_raw',null,
 'audio',jsonb_build_object('storage','supabase','stored',true,'bucket','throughline-audio','object_path','captures/'||(reservation->>'object_token'),'mime_type','audio/mp4','bytes',4)) from capture_fixture;
$$;
select throws_ok($$select throughline_accept_capture_v1(owner_id,capture_id,pg_temp.capture_recording()) from capture_fixture$$,'P0001','incomplete capture storage','acceptance requires audio');
insert into storage.objects(bucket_id,name) select 'throughline-audio','captures/'||(reservation->>'object_token') from capture_fixture;
select is((select throughline_capture_status_v1(owner_id,capture_id)->>'capture_outcome' from capture_fixture),'incomplete','crash after audio remains resumable');
select throws_ok($$update storage.objects set metadata='{}' where name like 'captures/%'$$,'P0001','capture audio is immutable','object cannot be overwritten');
update capture_fixture set accepted=throughline_accept_capture_v1(owner_id,capture_id,pg_temp.capture_recording());
select is((select accepted->>'capture_outcome' from capture_fixture),'accepted','row completion returns receipt');
select is((select accepted->>'processing_claim' from capture_fixture),'true','first acceptance takes the processing claim');
select is((select count(*)::integer from throughline_recordings where capture_id is not null),1,'one accepted recording');
select is((select created_at from throughline_recordings where capture_id is not null),'2026-09-29T00:00:00Z'::timestamptz,'note retains capture time');
select is((select throughline_accept_capture_v1(owner_id,capture_id,pg_temp.capture_recording())->'capture_receipt' from capture_fixture),(select accepted->'capture_receipt' from capture_fixture),'receipt immutable');
select ok((select not (throughline_accept_capture_v1(owner_id,capture_id,pg_temp.capture_recording()) ? 'processing_claim') from capture_fixture),'replay never claims processing again');
delete from storage.objects where name like 'captures/%';
select is((select throughline_reserve_capture_v1(owner_id,capture_id,repeat('a',64),4,metadata)->'capture_receipt' from capture_fixture),(select accepted->'capture_receipt' from capture_fixture),'receipt survives audio retention');
select throws_ok($$insert into storage.objects(bucket_id,name) select 'throughline-audio','captures/'||(reservation->>'object_token') from capture_fixture$$,'P0001','capture storage unavailable','accepted capture never rewrites expired audio');
delete from throughline_recordings where capture_id is not null;
select is((select throughline_capture_status_v1(owner_id,capture_id)->>'capture_outcome' from capture_fixture),'owner_deleted','deleted note returns authoritative tombstone');
select is((select count(*)::integer from throughline_capture_reservations where owner_id='00000000-0000-4000-8000-000000000091'),0,'deletion removes receipt and payload metadata');
select is((select array_agg(column_name::text order by ordinal_position)::text from information_schema.columns where table_schema='public' and table_name='throughline_capture_tombstones'),'{owner_id,capture_id,deleted_at}','tombstone holds only three minimal fields');
select is((select throughline_reserve_capture_v1(owner_id,capture_id,repeat('a',64),4,metadata)->>'capture_outcome' from capture_fixture),'owner_deleted','deleted replay cannot create another note');
select lives_ok($$insert into storage.objects(bucket_id,name) values('throughline-audio','00000000-0000-4000-8000-000000000091/rec_synthetic.m4a')$$,'legacy upload still works before deletion');
select lives_ok($$update storage.objects set metadata='{}' where name='00000000-0000-4000-8000-000000000091/rec_synthetic.m4a'$$,'legacy overwrite compatibility preserved');
select is((select throughline_begin_account_deletion_v1(owner_id,repeat('c',64))->>'deletion_outcome' from capture_fixture),'pending','account deletion establishes persistent hold');
select throws_ok($$insert into storage.objects(bucket_id,name) values('throughline-audio','00000000-0000-4000-8000-000000000091/rec_delayed.m4a')$$,'P0001','account storage unavailable','hold blocks delayed public-client storage upload');

select is((select throughline_reserve_capture_v1(owner_id,'00000000-0000-4000-8000-000000000094',repeat('a',64),4,metadata)->>'capture_outcome' from capture_fixture),'account_deletion_pending','hold blocks new reservations');
select is((select throughline_accept_capture_v1(owner_id,capture_id,pg_temp.capture_recording())->>'capture_outcome' from capture_fixture),'account_deletion_pending','hold blocks acceptance/finalization');
select throws_ok($$insert into storage.objects(bucket_id,name) select 'throughline-audio','captures/'||(reservation->>'object_token') from capture_fixture$$,'P0001','capture storage unavailable','delayed upload cannot recreate deleted object');
delete from auth.users where id='00000000-0000-4000-8000-000000000091';
select throws_ok($$insert into storage.objects(bucket_id,name) values('throughline-audio','00000000-0000-4000-8000-000000000091/rec_delayed.m4a')$$,'P0001','account storage unavailable','deleted owner cannot recreate legacy audio');
select is((select count(*)::integer from throughline_capture_tombstones),0,'account deletion removes tombstones');
select is(throughline_account_deletion_status_v1(repeat('c',64))->>'deletion_outcome','deleted','lost deletion response resolved by random capability');
select ok((select owner_id is null and outcome='deleted' from throughline_account_deletion_receipts where token_sha256=repeat('c',64)),'completed deletion receipt has no owner identity');
select is(public.throughline_account_deletion_status_v1(repeat('e',64))->>'deletion_outcome','unknown','unknown token never proves account survival');
update public.throughline_account_deletion_receipts set expires_at=now()-interval '1 second' where token_sha256=repeat('c',64);
select is(public.throughline_account_deletion_status_v1(repeat('c',64))->>'deletion_outcome','unknown','expired token does not claim survival or deletion');
select is((select count(*)::integer from public.throughline_account_deletion_receipts where token_sha256=repeat('c',64)),0,'expired capability physically removed on resolution');
select is((select count(*)::integer from cron.job where jobname='throughline-capture-deletion-receipt-retention' and schedule='17 3 * * *'),1,'daily local SQL expiry exists for accounts that never poll again');
select ok(not has_function_privilege('anon','public.throughline_account_deletion_status_v1(text)','EXECUTE'),'anonymous database callers cannot enumerate deletion status');
select * from finish();
rollback;
