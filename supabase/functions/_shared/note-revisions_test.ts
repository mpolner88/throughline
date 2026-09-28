import {
  buildUserMutationCommit,
  canonicalContentFingerprint,
} from "./note-revisions.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const canonical = {
  type: "freeform",
  title: "Original title",
  summary: "Original summary",
  most_important: ["Original point"],
  todos: [{
    text: "Call Sam",
    status: "open",
    priority: null,
    due: null,
    for_date: null,
    context: null,
  }],
  priorities: [],
  intentions: [],
  accomplishments: [],
  tomorrow_todos: [],
  mood: "neutral",
  people: ["Sam"],
  projects: [],
  tags: [],
  centers_of_balance: ["relationships"],
};

const base = {
  recording_id: "rec_revision_test",
  auth_user_id: "00000000-0000-4000-8000-000000000301",
  idempotency_key: "00000000-0000-4000-8000-000000000302",
  revision_id: "00000000-0000-4000-8000-000000000303",
  current_revision: {
    revision_id: "00000000-0000-4000-8000-000000000304",
    processing_operation_id: "00000000-0000-4000-8000-000000000305",
    canonical_snapshot: canonical,
    production_schema_sha256: "a".repeat(64),
    production_normalizer_sha256: "b".repeat(64),
    canonical_keyset_sha256: "c".repeat(64),
  },
  transcript_before: "Original transcript",
  notice_version: "private_evaluation_notice_v1",
  disclosure_version: "private_evaluation_disclosure_v1",
  policy_version: "private_evaluation_policy_v1",
  created_at: "2026-08-22T12:00:00.000Z",
};

Deno.test("content fingerprint covers editable fields and transcript separately", async () => {
  const first = await canonicalContentFingerprint(
    canonical,
    "Original transcript",
  );
  const second = await canonicalContentFingerprint(
    { ...canonical, people: ["Different hidden field"] },
    "Original transcript",
  );
  assert(
    first.editable_sha256 === second.editable_sha256,
    "Non-editable fields must not masquerade as corrected",
  );
  assert(
    first.transcript_sha256 === second.transcript_sha256,
    "Transcript seal drifted",
  );
});

Deno.test("no-op and workflow-only mutations never create eligibility", async () => {
  const noop = await buildUserMutationCommit({
    ...base,
    changes: { title: canonical.title },
    transcript_after: base.transcript_before,
  });
  assert(noop.material_change === false, "No-op should not be material");
  assert(noop.eligibility_source === null, "No-op should not be eligible");
  assert(noop.revision === null, "No-op should not create a revision");

  const workflow = await buildUserMutationCommit({
    ...base,
    mutation_kind: "action_state",
    changes: { todos: [{ ...canonical.todos[0], status: "completed" }] },
    transcript_after: base.transcript_before,
  });
  assert(
    workflow.eligibility_source === null,
    "Workflow state is never quality truth",
  );
  assert(
    workflow.revision?.revision_kind === "action_state",
    "Expected workflow history",
  );
});

Deno.test("material corrections label only changed editable fields", async () => {
  const commit = await buildUserMutationCommit({
    ...base,
    changes: {
      title: "Corrected title",
      summary: canonical.summary,
      people: ["Caller cannot claim this field"],
    },
    transcript_after: base.transcript_before,
  });
  assert(commit.material_change === true, "Expected material edit");
  assert(
    commit.eligibility_source === "content_correction",
    "Expected correction eligibility",
  );
  assert(
    JSON.stringify(commit.revision?.editable_correction_mask) ===
      JSON.stringify(["title"]),
    "Only title was corrected",
  );
  assert(
    (commit.revision?.canonical_snapshot.people as string[])[0] === "Sam",
    "Uneditable canonical fields must remain server-derived",
  );
});

Deno.test("transcript correction is recorded separately from editable output mask", async () => {
  const commit = await buildUserMutationCommit({
    ...base,
    changes: {},
    transcript_after: "Corrected transcript",
  });
  assert(commit.material_change === true, "Transcript correction is material");
  assert(
    commit.revision?.transcript_explicitly_corrected === true,
    "Expected transcript flag",
  );
  assert(
    commit.revision?.editable_correction_mask.length === 0,
    "Transcript is not an editable output field",
  );
});
