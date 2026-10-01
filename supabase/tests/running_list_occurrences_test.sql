begin;
select no_plan();
-- Synthetic account, note, task and mutation fixtures only.
insert into auth.users(id) values('00000000-0000-4000-8000-0000000000a1'),('00000000-0000-4000-8000-0000000000a2');
create function pg_temp.tasks(op text,payload jsonb default '{}'::jsonb,rid text default 'rec_task_fixture') returns jsonb language sql as $$
 select public.throughline_tasks_v1('00000000-0000-4000-8000-0000000000a1',op,rid,payload);
$$;
create temp table task_fixture(note jsonb,request jsonb,response jsonb,page jsonb,first_id uuid,second_id uuid,third_id uuid);
insert into task_fixture(note) values(jsonb_build_object('id','rec_task_fixture','user_id','synthetic','auth_user_id','00000000-0000-4000-8000-0000000000a1',
 'created_at','2026-01-02T10:00:00Z','user_local_time','2026-01-02T10:00:00Z','timezone','UTC','type','freeform','status','processed','processing_status','processed',
 'transcript_raw','Synthetic transcript.','structured_note','{"title":"Synthetic source","summary":"Synthetic summary.","todos":[{"text":"Repeated synthetic task","status":"completed"},{"text":"Repeated synthetic task","status":"open"},{"text":"Tomorrow synthetic task","status":"open","for_date":"2026-01-03"}],"tomorrow_todos":["Tomorrow synthetic task"],"action_items":[],"most_important":[]}'::jsonb));
select ok(not has_table_privilege('authenticated','public.throughline_task_occurrences','SELECT'),'task table is private');
select ok(not has_function_privilege('authenticated','public.throughline_tasks_v1(uuid,text,text,jsonb)','EXECUTE'),'task RPC is service-only');
select ok(not has_function_privilege('service_role','public.throughline_tasks_internal_v1(uuid,text,text,jsonb)','EXECUTE'),'internal dispatcher cannot bypass wrapper');
select ok(has_function_privilege('service_role','public.throughline_tasks_v1(uuid,text,text,jsonb)','EXECUTE'),'service can call wrapper');
select is(public.throughline_task_date_v1('2024-02-29'),date '2024-02-29','valid leap date');
select is(public.throughline_task_date_v1('2025-02-29'),null::date,'invalid leap date is not rolled forward');
select ok((select pg_temp.tasks('insert',jsonb_build_object('recording',note)) ? 'recording' from task_fixture),'first note inserts without enrollment');
select is((select count(*)::int from public.throughline_task_accounts),0,'old client insert does not enroll');
update task_fixture set page=pg_temp.tasks('list','{"limit":1}');
select is((select jsonb_array_length(page->'tasks') from task_fixture),1,'pagination honors page size');
select ok((select page->'next_cursor' <> 'null'::jsonb from task_fixture),'pagination returns continuation');
select is((select count(*)::int from public.throughline_task_occurrences),3,'duplicate text stays separate and tomorrow alias adds no task');
select is((select count(*)::int from public.throughline_task_occurrences where is_earlier),3,'initial notes classified earlier');
select is((select count(*)::int from public.throughline_task_occurrences where origin_local_date='2026-01-02'),3,'origin date retains capture-local day');
select is((select pg_temp.tasks('list')->>'cutover_at'),(select pg_temp.tasks('list')->>'cutover_at'),'repeated bootstrap preserves cutover');
update task_fixture set first_id=(select id from public.throughline_task_occurrences where source_order=0),
 second_id=(select id from public.throughline_task_occurrences where source_order=1),third_id=(select id from public.throughline_task_occurrences where source_order=2);
select throws_ok($$update public.throughline_recordings set structured_note=structured_note||'{"todos":[]}'::jsonb where id='rec_task_fixture'$$,'P0001','update_required','raw managed note replacement is blocked after RPC returns');
select is((select pg_temp.tasks('legacy',jsonb_build_object('before',r.recording,'after',r.recording,'kind','completion','body',jsonb_build_object('text','Repeated synthetic task','completed',true)))->>'error_code'
 from public.throughline_recordings r where id='rec_task_fixture'),'update_required','legacy duplicate selector is refused');
select ok((select pg_temp.tasks('mutation',jsonb_build_object('task_id',first_id,'body',jsonb_build_object('mutation_id','00000000-0000-4000-8000-0000000000b0','expected_version',1,'operation','set_completion','completed',true,'occurred_at',clock_timestamp(),'completion_placement','later'))) ? 'task' from task_fixture),'redundant completion accepts old completed state');
select is((select completed_at from public.throughline_task_occurrences where id=(select first_id from task_fixture)),null::timestamptz,'unknown historical completion instant stays unknown');
update task_fixture set request=jsonb_build_object('task_id',third_id,'body',jsonb_build_object('mutation_id','00000000-0000-4000-8000-0000000000b1',
 'expected_version',1,'operation','set_completion','completed',true,'occurred_at',clock_timestamp(),'completion_placement','later'));
update task_fixture set response=pg_temp.tasks('mutation',request);
select ok((select response ? 'task' from task_fixture),'completion returns ordinary task');
select is((select response from task_fixture),(select pg_temp.tasks('mutation',request) from task_fixture),'identical committed retry returns exact receipt before version check');
select is((select pg_temp.tasks('mutation',jsonb_set(request,'{body,completed}','false'))->>'error_code' from task_fixture),'idempotency_conflict','same mutation UUID with different body refused');
select is((select pg_temp.tasks('list',jsonb_build_object('limit',1,'cursor',page->'next_cursor'))->>'error_code' from task_fixture),'snapshot_changed','old page cursor fails after mutation');
select is((select jsonb_array_length(structured_note->'tomorrow_todos') from public.throughline_recordings where id='rec_task_fixture'),0,'completed tomorrow alias cannot reopen through MCP');
select is((select structured_note->'todos'->2->>'status' from public.throughline_recordings where id='rec_task_fixture'),'completed','legacy note projection reflects completion');
select is((select public.throughline_tasks_v1('00000000-0000-4000-8000-0000000000a2','mutation',null,request)->>'error_code' from task_fixture),'not_found','other owner cannot address task');
update task_fixture set request=jsonb_build_object('task_contract_version',1,'mutation_id','00000000-0000-4000-8000-0000000000b2',
 'expected_task_revision',(select task_revision from public.throughline_recordings where id='rec_task_fixture'),'title','Renamed synthetic source',
 'edited_local_date','2026-09-30','edited_timezone','UTC','todos',jsonb_build_array(jsonb_build_object('id',third_id,'text','Tomorrow synthetic task'),
 jsonb_build_object('id',first_id,'text','Renamed synthetic task'),jsonb_build_object('client_item_id','00000000-0000-4000-8000-0000000000c1','text','New synthetic task')));
update task_fixture set response=pg_temp.tasks('edit',request);
select ok((select response ? 'tasks' from task_fixture),'ordinary editor saves with side metadata');
select is((select pg_temp.tasks('edit',request) from task_fixture),(select response from task_fixture),'edit retries preserve new occurrence IDs and exact receipt');
select is((select count(*)::int from public.throughline_task_occurrences where deleted_at is null),3,'remove and add preserve correct live count');
select is((select status from public.throughline_task_occurrences where id=(select third_id from task_fixture)),'completed','reorder preserves occurrence completion');
select ok((select deleted_at is not null from public.throughline_task_occurrences where id=(select second_id from task_fixture)),'removed occurrence is tombstoned');
select ok((select not is_earlier and origin_local_date='2026-09-30' from public.throughline_task_occurrences where text='New synthetic task'),'new task in old note is current');
select is((select pg_temp.tasks('edit',jsonb_set(request,'{mutation_id}','"00000000-0000-4000-8000-0000000000b3"'))->>'error_code' from task_fixture),'version_conflict','stale editor cannot restore removed occurrence');
select is((select pg_temp.tasks('mutation',jsonb_build_object('task_id',second_id,'body',jsonb_build_object('mutation_id','00000000-0000-4000-8000-0000000000b4','expected_version',1,'operation','set_completion','completed',true,'occurred_at',clock_timestamp(),'completion_placement','later')))->>'error_code' from task_fixture),'task_deleted','queued removed-task command is terminal');
select ok(pg_temp.tasks('audio','{"audio":{"stored":false},"audio_retention":{"status":"expired"}}')->>'updated'='true','audio retention uses atomic narrow merge');
select is((select recording->'structured_note'->>'title' from public.throughline_recordings where id='rec_task_fixture'),'Renamed synthetic source','audio housekeeping preserves current task-bearing note');
select is((select recording->'structured_note' from public.throughline_recordings where id='rec_task_fixture'),(select structured_note from public.throughline_recordings where id='rec_task_fixture'),'both note projections agree');
select is(pg_temp.tasks('assert_reextract')->>'error_code','update_required','managed extraction replacement refused');
select ok(pg_temp.tasks('delete')->>'deleted'='true','owned note deletes through lifecycle lock');
select is((select count(*)::int from public.throughline_task_occurrences),0,'note deletion removes task contents');
select is((select count(*)::int from public.throughline_task_mutations),0,'note deletion removes receipts containing note contents');
select ok((select pg_temp.tasks('insert',jsonb_build_object('recording',note || jsonb_build_object('id','rec_null_arrays','structured_note','{"title":"Synthetic empty","todos":null,"action_items":null,"tomorrow_todos":null}'::jsonb)),'rec_null_arrays') ? 'recording' from task_fixture),'historical null arrays initialize safely');
select is((select count(*)::int from public.throughline_task_occurrences where recording_id='rec_null_arrays'),0,'null historical task arrays manufacture no tasks');
insert into public.throughline_account_deletion_holds(owner_id) values('00000000-0000-4000-8000-0000000000a1');
select is(pg_temp.tasks('list')->>'error_code','account_deletion_pending','deletion hold blocks bootstrap and requests');
delete from auth.users where id='00000000-0000-4000-8000-0000000000a1';
select is((select count(*)::int from public.throughline_task_accounts),0,'account deletion removes enrollment');
-- Direct auth deletion must cascade with a live recording, tasks AND an immutable receipt.
select ok((select public.throughline_tasks_v1('00000000-0000-4000-8000-0000000000a2','insert','rec_live_cascade',jsonb_build_object('recording',note || '{"id":"rec_live_cascade","auth_user_id":"00000000-0000-4000-8000-0000000000a2"}'::jsonb)) ? 'recording' from task_fixture),'second owner has a live source');
select ok(public.throughline_tasks_v1('00000000-0000-4000-8000-0000000000a2','list') ? 'tasks','second owner enrolled');
select ok((select public.throughline_tasks_v1('00000000-0000-4000-8000-0000000000a2','mutation',null,jsonb_build_object('task_id',id,'body',jsonb_build_object('mutation_id','00000000-0000-4000-8000-0000000000d1','expected_version',version,'operation','set_placement','placement','today','anchor_date','2026-09-30'))) ? 'task' from public.throughline_task_occurrences where recording_id='rec_live_cascade' and source_order=2),'second owner has committed receipt');
select is((select public.throughline_tasks_v1('00000000-0000-4000-8000-0000000000a2','mutation',null,jsonb_build_object('task_id',id,'body',jsonb_build_object('mutation_id','00000000-0000-4000-8000-0000000000d2','operation','set_placement','placement','today','anchor_date','2026-09-30')))->>'error_code' from public.throughline_task_occurrences where recording_id='rec_live_cascade' and source_order=2),'invalid_task_request','SQL independently rejects a missing expected version');
select lives_ok($$delete from auth.users where id='00000000-0000-4000-8000-0000000000a2'$$,'direct auth cascade does not rewrite a child of the missing parent');
select is((select count(*)::int from public.throughline_task_accounts),0,'direct auth cascade removes enrollment');
select is((select count(*)::int from public.throughline_task_occurrences),0,'direct auth cascade removes live task contents');
select is((select count(*)::int from public.throughline_task_mutations),0,'direct auth cascade removes live receipt contents');
select * from finish();
rollback;
