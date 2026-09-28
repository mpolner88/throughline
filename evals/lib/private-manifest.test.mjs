import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveInferenceContract,
  sha256Hex,
} from "../../core/inference-contract.mjs";
import {
  buildAdapterInput,
  validateAcceptedFullOutput,
  validatePrivateManifest,
} from "./private-manifest.mjs";

function canonicalOutput() {
  return {
    type: "freeform",
    title: "Synthetic note",
    summary: "A generated note for plumbing tests.",
    most_important: ["Verify plumbing"],
    todos: [{
      text: "Verify plumbing",
      status: "open",
      priority: "high",
      due: null,
      for_date: null,
      context: null,
    }],
    priorities: ["Verify plumbing"],
    intentions: [],
    accomplishments: [],
    tomorrow_todos: [],
    mood: "neutral",
    people: [],
    projects: ["Throughline"],
    tags: ["synthetic"],
    centers_of_balance: ["profession"],
  };
}

test("adapter input contains audio but no expected or reference field", () => {
  const input = buildAdapterInput({
    id: "synthetic-001",
    audio: {
      path: "audio/synthetic.wav",
      sha256: "a".repeat(64),
      mime_type: "audio/wav",
    },
  }, "b".repeat(64));
  assert.equal(input.audio_sha256, "a".repeat(64));
  assert.equal("reference" in input, false);
  assert.equal("split" in input, false);
  assert.doesNotMatch(
    JSON.stringify(input),
    /expected|transcript_path|expected_output_sha256/u,
  );
});

test("full output requires every canonical field and exact contract hashes", async () => {
  const contract = await resolveInferenceContract({});
  const label = {
    kind: "accepted_full_output",
    schema_sha256: contract.schema.sha256,
    normalizer_sha256: contract.normalizer.sha256,
    keyset_sha256: contract.schema.keyset_sha256,
  };
  assert.deepEqual(
    validateAcceptedFullOutput(canonicalOutput(), label, contract),
    canonicalOutput(),
  );
  for (const field of contract.schema.snapshot.required) {
    const missing = canonicalOutput();
    delete missing[field];
    assert.throws(() => validateAcceptedFullOutput(missing, label, contract));
  }
  assert.throws(() =>
    validateAcceptedFullOutput(
      { ...canonicalOutput(), extra: true },
      label,
      contract,
    )
  );
  assert.throws(() =>
    validateAcceptedFullOutput(canonicalOutput(), {
      ...label,
      schema_sha256: "0".repeat(64),
    }, contract)
  );
  assert.throws(() =>
    validateAcceptedFullOutput(
      {
        ...canonicalOutput(),
        todos: [{ ...canonicalOutput().todos[0], unexpected: true }],
      },
      label,
      contract,
    )
  );
});

test("synthetic manifests validate hashes but cannot masquerade as real quality", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "throughline-manifest-"));
  try {
    fs.mkdirSync(path.join(root, "audio"));
    const audioPath = path.join(root, "audio", "synthetic.wav");
    fs.writeFileSync(audioPath, "generated audio bytes");
    const contract = await resolveInferenceContract({});
    const manifest = {
      manifest_version: "throughline-private-audio-manifest-v1",
      purpose: "synthetic_plumbing",
      created_at: "2026-08-22T00:00:00.000Z",
      disclosure_version: "synthetic-v1",
      policy_version: "synthetic-v1",
      split_hash: "1".repeat(64),
      content_set_hash: "2".repeat(64),
      label_contract_set_hash: "3".repeat(64),
      inference_contract: {
        contract_sha256: contract.contract_sha256,
        schema_sha256: contract.schema.sha256,
        normalizer_sha256: contract.normalizer.sha256,
        keyset_sha256: contract.schema.keyset_sha256,
      },
      materializer_receipt: null,
      cases: [{
        id: "synthetic-001",
        split: "sealed_holdout",
        active: true,
        audio: {
          path: "audio/synthetic.wav",
          sha256: await sha256Hex(new Uint8Array(fs.readFileSync(audioPath))),
          mime_type: "audio/wav",
        },
        label: {
          kind: "diagnostic_grade",
          reviewed_fields: null,
          canonical_output: null,
          transcript: null,
          transcript_explicitly_corrected: false,
          agent_ready: null,
          exact_revision_id: null,
          inspected_preview: null,
        },
      }],
    };
    const validated = await validatePrivateManifest(manifest, root, {
      contract,
    });
    assert.equal(validated.quality_eligible, false);
    await assert.rejects(
      () =>
        validatePrivateManifest(
          { ...manifest, purpose: "real_private_quality" },
          root,
          { contract },
        ),
      /materializer_receipt_required/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
