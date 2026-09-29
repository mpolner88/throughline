import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  canonicalJson,
  resolveInferenceContract,
  sha256Hex,
} from "../core/inference-contract.mjs";
import {
  createSupabaseArtifactStore,
  materializePrivateCorpus,
  resolvePrivateArtifactStoreMode,
} from "./materialize-private-corpus.mjs";
import { validatePrivateManifest } from "./lib/private-manifest.mjs";

const canonical = {
  type: "freeform",
  title: "Private corpus test",
  summary: "A synthetic staging test.",
  most_important: ["Verify staging"],
  todos: [],
  priorities: [],
  intentions: [],
  accomplishments: [],
  tomorrow_todos: [],
  mood: "neutral",
  people: [],
  projects: [],
  tags: [],
  centers_of_balance: [],
};

test("real private materialization remains explicitly authorization locked", async () => {
  await assert.rejects(
    materializePrivateCorpus({
      authorized: false,
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      privateRoot: "/private/tmp/unused",
      manifestPath: "/private/tmp/unused.json",
    }),
    /private_materialization_not_authorized/,
  );
});

test("real CLI materialization accepts only the production-reachable Supabase artifact store mode", () => {
  assert.equal(
    resolvePrivateArtifactStoreMode({
      THROUGHLINE_PRIVATE_ARTIFACT_STORE: "supabase_storage_v1",
    }),
    "supabase_storage_v1",
  );
  for (const value of [undefined, "", "local_filesystem", "other"]) {
    assert.throws(
      () => resolvePrivateArtifactStoreMode({
        ...(value === undefined
          ? {}
          : { THROUGHLINE_PRIVATE_ARTIFACT_STORE: value }),
      }),
      /private_artifact_store_invalid/,
    );
  }
});

test("Supabase artifact store seals one immutable receipt prefix and removes local staging only after commit", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-store-"));
  const stagingRoot = path.join(root, ".staging-synthetic");
  const receipt = "a".repeat(64);
  const requests = [];
  await fs.mkdir(path.join(stagingRoot, "cases", "case-a"), { recursive: true });
  await fs.writeFile(
    path.join(stagingRoot, "cases", "case-a", "audio.m4a"),
    "synthetic audio bytes",
  );
  const fetchImpl = async (url, init = {}) => {
    requests.push({
      url: String(url),
      method: init.method,
      upsert: new Headers(init.headers).get("x-upsert"),
    });
    return new Response(null, { status: 200 });
  };

  try {
    const store = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl,
      bucket: "throughline-audio",
      prefix: "evaluation-artifacts",
    });
    const handle = await store.seal({
      stagingRoot,
      receipt: { receipt_sha256: receipt },
      manifest: { materializer_receipt: { receipt_sha256: receipt } },
    });

    assert.equal(await fs.stat(stagingRoot).then(() => true), true);
    assert.deepEqual(
      requests.map(({ url, method, upsert }) => ({ url, method, upsert })),
      [
        {
          url: `https://supabase.test/storage/v1/object/throughline-audio/evaluation-artifacts/${receipt}/cases/case-a/audio.m4a`,
          method: "POST",
          upsert: "false",
        },
        {
          url: `https://supabase.test/storage/v1/object/throughline-audio/evaluation-artifacts/${receipt}/manifest.json`,
          method: "POST",
          upsert: "false",
        },
      ],
    );
    assert.deepEqual(handle.locator, {
      storage: "supabase",
      bucket: "throughline-audio",
      object_prefix: `evaluation-artifacts/${receipt}`,
      file_count: 2,
    });

    await store.commit(handle);
    await assert.rejects(fs.stat(stagingRoot), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Supabase artifact store rolls back every uploaded object when registration fails", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-rollback-"));
  const stagingRoot = path.join(root, ".staging-synthetic");
  const receipt = "b".repeat(64);
  const requests = [];
  await fs.mkdir(stagingRoot, { recursive: true });
  await fs.writeFile(path.join(stagingRoot, "audio.m4a"), "synthetic audio");
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method });
    return new Response(null, { status: 200 });
  };

  try {
    const store = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl,
    });
    const handle = await store.seal({
      stagingRoot,
      receipt: { receipt_sha256: receipt },
      manifest: { materializer_receipt: { receipt_sha256: receipt } },
    });
    await store.rollback(handle);

    assert.deepEqual(
      requests.filter((request) => request.method === "DELETE"),
      [
        {
          url: `https://supabase.test/storage/v1/object/throughline-audio/evaluation-artifacts/${receipt}/manifest.json`,
          method: "DELETE",
        },
        {
          url: `https://supabase.test/storage/v1/object/throughline-audio/evaluation-artifacts/${receipt}/audio.m4a`,
          method: "DELETE",
        },
      ],
    );
    await assert.rejects(fs.stat(stagingRoot), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Supabase artifact store removes partial uploads when sealing fails", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-partial-"));
  const stagingRoot = path.join(root, ".staging-synthetic");
  const receipt = "c".repeat(64);
  const requests = [];
  await fs.mkdir(stagingRoot, { recursive: true });
  await fs.writeFile(path.join(stagingRoot, "audio.m4a"), "synthetic audio");
  let uploadCount = 0;
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url: String(url), method: init.method });
    if (init.method === "POST") {
      uploadCount += 1;
      return new Response(null, { status: uploadCount === 2 ? 503 : 200 });
    }
    return new Response(null, { status: 200 });
  };

  try {
    const store = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl,
    });
    await assert.rejects(
      store.seal({
        stagingRoot,
        receipt: { receipt_sha256: receipt },
        manifest: { materializer_receipt: { receipt_sha256: receipt } },
      }),
      /artifact_upload_failed_503/,
    );
    assert.deepEqual(
      requests.filter((request) => request.method === "DELETE"),
      [{
        url: `https://supabase.test/storage/v1/object/throughline-audio/evaluation-artifacts/${receipt}/audio.m4a`,
        method: "DELETE",
      }],
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("materializer rejects a corpus that cannot fit the bounded deletion service", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-corpus-bound-"));
  const contract = await resolveInferenceContract({});
  let requestCount = 0;
  const fetchImpl = async (url, init = {}) => {
    requestCount += 1;
    const target = String(url);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    if (
      target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1") &&
      body?.payload?.mode === "prepare"
    ) {
      return Response.json({
        source_set_sha256: "d".repeat(64),
        case_count: 250,
        candidates: Array.from({ length: 250 }, () => ({})),
      });
    }
    throw new Error(`Unexpected request: ${target}`);
  };

  try {
    await assert.rejects(
      materializePrivateCorpus({
        authorized: true,
        supabaseUrl: "https://supabase.test",
        serviceRoleKey: "service-test",
        privateRoot: root,
        fetchImpl,
        contract,
      }),
      /corpus_case_limit_exceeded/,
    );
    assert.equal(requestCount, 1);
    assert.deepEqual(await fs.readdir(root), []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("materializer removes uploaded artifacts and leaves deterministic rejection metadata for reconciliation", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-register-"));
  const audio = new TextEncoder().encode("synthetic rollback audio");
  const audioHash = await sha256Hex(audio);
  const contract = await resolveInferenceContract({});
  const requests = [];
  const prepareResult = {
    source_set_sha256: "e".repeat(64),
    case_count: 1,
    candidates: [{
      contribution_id: "00000000-0000-4000-8000-000000000911",
      eligibility_source: "explicit_grade",
      disclosure_version: "private_evaluation_disclosure_v1",
      policy_version: "private_evaluation_policy_v1",
      revision_id: "00000000-0000-4000-8000-000000000912",
      canonical_snapshot: canonical,
      canonical_output_sha256: await sha256Hex(canonicalJson(canonical)),
      production_schema_sha256: contract.schema.sha256,
      production_normalizer_sha256: contract.normalizer.sha256,
      canonical_keyset_sha256: contract.schema.keyset_sha256,
      editable_correction_mask: [],
      transcript_explicitly_corrected: false,
      agent_ready: false,
      readiness_preview_sha256: null,
      audio_sha256: audioHash,
      audio_bucket: "throughline-audio",
      audio_object_path: "private/synthetic-rollback.m4a",
      audio_mime_type: "audio/m4a",
      audio_duration_ms: 800,
      stable_split: "development",
      label_kind: "diagnostic_grade",
      label_completeness: "diagnostic_only",
    }],
  };
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ target, method: init.method ?? "GET", body });
    if (target.endsWith("/rpc/throughline_reserve_evaluation_artifact_receipt_v1")) {
      return Response.json({ state: "pending", idempotent: false });
    }
    if (target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1")) {
      if (body.payload.mode === "prepare") return Response.json(prepareResult);
      return new Response("rejected", { status: 400 });
    }
    if (target.includes("/storage/v1/object/authenticated/")) {
      return new Response(audio);
    }
    if (target.includes("/storage/v1/object/")) {
      return new Response(null, { status: 200 });
    }
    throw new Error(`Unexpected request: ${target}`);
  };

  try {
    const artifactStore = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl,
    });
    await assert.rejects(
      materializePrivateCorpus({
        authorized: true,
        supabaseUrl: "https://supabase.test",
        serviceRoleKey: "service-test",
        privateRoot: root,
        artifactStore,
        fetchImpl,
        contract,
        now: () => "2026-08-22T23:45:00.000Z",
        newUuid: () => "00000000-0000-4000-8000-000000000919",
      }),
      /corpus_rpc_failed_400/,
    );
    const uploads = requests.filter((request) => request.method === "POST" &&
      request.target.includes("/storage/v1/object/throughline-audio/evaluation-artifacts/"));
    const deletes = requests.filter((request) => request.method === "DELETE");
    assert(uploads.length > 0);
    assert.equal(deletes.length, uploads.length);
    assert.deepEqual(
      deletes.map((request) => request.target).sort(),
      uploads.map((request) => request.target).sort(),
    );
    const reserveIndex = requests.findIndex((request) =>
      request.target.endsWith("/rpc/throughline_reserve_evaluation_artifact_receipt_v1"));
    const uploadIndex = requests.findIndex((request) => uploads.includes(request));
    const commitIndex = requests.findIndex((request) =>
      request.target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1") &&
      request.body?.payload?.mode === "commit");
    const deleteIndex = requests.findIndex((request) => deletes.includes(request));
    assert(reserveIndex >= 0);
    assert(reserveIndex < uploadIndex);
    assert(uploadIndex < commitIndex);
    assert(commitIndex < deleteIndex);
    assert.equal(
      requests.filter((request) =>
        request.target.endsWith(
          "/rpc/throughline_acknowledge_evaluation_artifact_deletion_v1",
        )
      ).length,
      0,
    );
    assert.deepEqual(await fs.readdir(root), []);

    const localRoot = path.join(root, "local-adapter");
    await fs.mkdir(localRoot);
    await assert.rejects(
      materializePrivateCorpus({
        authorized: true,
        supabaseUrl: "https://supabase.test",
        serviceRoleKey: "service-test",
        privateRoot: localRoot,
        fetchImpl,
        contract,
        now: () => "2026-08-22T23:45:00.000Z",
        newUuid: () => "00000000-0000-4000-8000-000000000920",
      }),
      /corpus_rpc_failed_400/,
    );
    assert.deepEqual(await fs.readdir(localRoot), []);

    const cleanupRoot = path.join(root, "post-commit-cleanup");
    await fs.mkdir(cleanupRoot);
    const cleanupRequests = [];
    const cleanupFetch = async (url, init = {}) => {
      const target = String(url);
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      cleanupRequests.push({ target, method: init.method ?? "GET", body });
      if (target.endsWith("/rpc/throughline_reserve_evaluation_artifact_receipt_v1")) {
        return Response.json({ state: "pending", idempotent: false });
      }
      if (target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1")) {
        if (body.payload.mode === "prepare") return Response.json(prepareResult);
        return Response.json({
          receipt_sha256: body.payload.materializer_receipt_sha256,
          case_count: 1,
        });
      }
      if (target.includes("/storage/v1/object/authenticated/")) {
        return new Response(audio);
      }
      if (target.includes("/storage/v1/object/")) {
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected request: ${target}`);
    };
    const committedStore = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl: cleanupFetch,
    });
    await assert.rejects(
      materializePrivateCorpus({
        authorized: true,
        supabaseUrl: "https://supabase.test",
        serviceRoleKey: "service-test",
        privateRoot: cleanupRoot,
        artifactStore: {
          ...committedStore,
          async commit() {
            throw new Error("local_cleanup_failed");
          },
        },
        fetchImpl: cleanupFetch,
        contract,
        now: () => "2026-08-22T23:45:00.000Z",
        newUuid: () => "00000000-0000-4000-8000-000000000921",
      }),
      /local_cleanup_failed/,
    );
    assert.equal(
      cleanupRequests.filter((request) => request.method === "DELETE").length,
      0,
    );

    const ambiguousRoot = path.join(root, "ambiguous-commit");
    await fs.mkdir(ambiguousRoot);
    const ambiguousRequests = [];
    const ambiguousFetch = async (url, init = {}) => {
      const target = String(url);
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      ambiguousRequests.push({ target, method: init.method ?? "GET", body });
      if (target.endsWith("/rpc/throughline_reserve_evaluation_artifact_receipt_v1")) {
        return Response.json({ state: "pending", idempotent: false });
      }
      if (target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1")) {
        if (body.payload.mode === "prepare") return Response.json(prepareResult);
        return new Response("unavailable", { status: 503 });
      }
      if (target.includes("/storage/v1/object/authenticated/")) {
        return new Response(audio);
      }
      if (target.includes("/storage/v1/object/")) {
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected request: ${target}`);
    };
    const ambiguousStore = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl: ambiguousFetch,
    });
    await assert.rejects(
      materializePrivateCorpus({
        authorized: true,
        supabaseUrl: "https://supabase.test",
        serviceRoleKey: "service-test",
        privateRoot: ambiguousRoot,
        artifactStore: ambiguousStore,
        fetchImpl: ambiguousFetch,
        contract,
        now: () => "2026-08-22T23:45:00.000Z",
        newUuid: () => "00000000-0000-4000-8000-000000000922",
      }),
      /corpus_rpc_failed_503/,
    );
    assert.equal(
      ambiguousRequests.filter((request) => request.method === "DELETE").length,
      0,
    );
    assert.equal(
      ambiguousRequests.filter((request) =>
        request.target.endsWith("/rpc/throughline_acknowledge_evaluation_artifact_deletion_v1")
      ).length,
      0,
    );
    assert((await fs.readdir(ambiguousRoot)).length > 0);

    const mismatchRoot = path.join(root, "ambiguous-commit-receipt");
    await fs.mkdir(mismatchRoot);
    const mismatchRequests = [];
    const mismatchFetch = async (url, init = {}) => {
      const target = String(url);
      const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
      mismatchRequests.push({ target, method: init.method ?? "GET", body });
      if (target.endsWith("/rpc/throughline_reserve_evaluation_artifact_receipt_v1")) {
        return Response.json({ state: "pending", idempotent: false });
      }
      if (target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1")) {
        if (body.payload.mode === "prepare") return Response.json(prepareResult);
        return Response.json({ receipt_sha256: "0".repeat(64), case_count: 1 });
      }
      if (target.includes("/storage/v1/object/authenticated/")) {
        return new Response(audio);
      }
      if (target.includes("/storage/v1/object/")) {
        return new Response(null, { status: 200 });
      }
      throw new Error(`Unexpected request: ${target}`);
    };
    const mismatchStore = createSupabaseArtifactStore({
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      fetchImpl: mismatchFetch,
    });
    await assert.rejects(
      materializePrivateCorpus({
        authorized: true,
        supabaseUrl: "https://supabase.test",
        serviceRoleKey: "service-test",
        privateRoot: mismatchRoot,
        artifactStore: mismatchStore,
        fetchImpl: mismatchFetch,
        contract,
        now: () => "2026-08-22T23:45:00.000Z",
        newUuid: () => "00000000-0000-4000-8000-000000000923",
      }),
      /corpus_commit_receipt_mismatch/,
    );
    assert.equal(
      mismatchRequests.filter((request) => request.method === "DELETE").length,
      0,
    );
    assert((await fs.readdir(mismatchRoot)).length > 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("materializer stages derived cases and commits without caller case lists", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "throughline-corpus-"));
  const sentinelPath = path.join(root, "unrelated-sentinel.txt");
  await fs.writeFile(sentinelPath, "keep", { mode: 0o600 });
  const audio = new TextEncoder().encode("synthetic audio bytes");
  const audioHash = await sha256Hex(audio);
  const contract = await resolveInferenceContract({});
  const requests = [];
  const prepareResult = {
    source_set_sha256: "f".repeat(64),
    case_count: 1,
    candidates: [{
      contribution_id: "00000000-0000-4000-8000-000000000901",
      eligibility_source: "explicit_grade",
      disclosure_version: "private_evaluation_disclosure_v1",
      policy_version: "private_evaluation_policy_v1",
      revision_id: "00000000-0000-4000-8000-000000000902",
      canonical_snapshot: canonical,
      canonical_output_sha256: await sha256Hex(canonicalJson(canonical)),
      production_schema_sha256: contract.schema.sha256,
      production_normalizer_sha256: contract.normalizer.sha256,
      canonical_keyset_sha256: contract.schema.keyset_sha256,
      editable_correction_mask: [],
      transcript_explicitly_corrected: false,
      agent_ready: false,
      readiness_preview_sha256: null,
      audio_sha256: audioHash,
      audio_bucket: "throughline-audio",
      audio_object_path: "private/synthetic.m4a",
      audio_mime_type: "audio/m4a",
      audio_duration_ms: 1200,
      stable_split: "development",
      label_kind: "diagnostic_grade",
      label_completeness: "diagnostic_only",
    }],
  };
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ target, body });
    if (target.endsWith("/rpc/throughline_materialize_evaluation_corpus_v1")) {
      if (body.payload.mode === "prepare") return Response.json(prepareResult);
      return Response.json({
        receipt_sha256: body.payload.materializer_receipt_sha256,
        case_count: 1,
      });
    }
    if (target.includes("/storage/v1/object/authenticated/")) {
      return new Response(audio);
    }
    throw new Error(`Unexpected request: ${target}`);
  };

  try {
    const result = await materializePrivateCorpus({
      authorized: true,
      supabaseUrl: "https://supabase.test",
      serviceRoleKey: "service-test",
      privateRoot: root,
      fetchImpl,
      contract,
      now: () => "2026-08-22T23:30:00.000Z",
      newUuid: () => "00000000-0000-4000-8000-000000000999",
    });
    assert.equal(result.receipt.case_count, 1);
    const receiptRoot = path.join(root, result.receipt.receipt_sha256);
    assert.equal(result.artifactRoot, receiptRoot);
    assert.equal(result.manifestPath, path.join(receiptRoot, "manifest.json"));
    const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
    assert.equal(manifest.purpose, "real_private_quality");
    const validated = await validatePrivateManifest(manifest, receiptRoot, {
      contract,
      verifyMaterializerReceipt: async () => ({
        valid: true,
        split_hash: manifest.split_hash,
        content_set_hash: manifest.content_set_hash,
        label_contract_set_hash: manifest.label_contract_set_hash,
        disclosure_version: manifest.disclosure_version,
        policy_version: manifest.policy_version,
        schema_sha256: contract.schema.sha256,
        normalizer_sha256: contract.normalizer.sha256,
        keyset_sha256: contract.schema.keyset_sha256,
      }),
    });
    assert.equal(validated.quality_eligible, true);
    assert.equal(validated.cases[0].audio.mime_type, "audio/m4a");
    const stagedAudio = path.join(receiptRoot, manifest.cases[0].audio.path);
    assert.equal(
      await sha256Hex(new Uint8Array(await fs.readFile(stagedAudio))),
      audioHash,
    );
    const rpcBodies = requests
      .filter((request) => request.target.includes("/rpc/"))
      .map((request) => request.body.payload);
    assert(rpcBodies.every((body) => !("cases" in body)));
    assert(rpcBodies.every((body) => !("contribution_ids" in body)));
    assert.equal(await fs.readFile(sentinelPath, "utf8"), "keep");
    const baseEntries = (await fs.readdir(root)).sort();
    assert.deepEqual(baseEntries, [
      result.receipt.receipt_sha256,
      "unrelated-sentinel.txt",
    ]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
