import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

const builder = await import("./build-evaluation-rollout-package.mjs")
  .catch(() => ({}));

const requiredExport = (name) => {
  assert.equal(
    typeof builder[name],
    "function",
    `expected production export ${name}`,
  );
  return builder[name];
};

const MIGRATIONS = [
  "20260818000000_evaluation_truth_lineage.sql",
  "20260822154500_evaluation_retention.sql",
  "20260822170000_evaluation_retention_claims.sql",
];

const MIGRATION_HASHES = [
  "3e28bfb642f0cbf12bb8b5705de243a12ea71ce9a70fbbb2b9db9a9d86dcbd72",
  "282f7eb45aa7a3b77301e548292da07ca7bfc2b83979ca93830ca55ba7d49b79",
  "4add0d4bd51b71babda3405b8187e4351ea6358e8dfc3378e73bf8280057dd90",
];

const DESCRIPTOR = {
  schema_version: "throughline_artifact_service_target_v1",
  provider: "supabase",
  runtime: "edge_function",
  deployment_name: "throughline-private-artifact-delete",
  region: "us-west-1",
  route: "/artifact-delete",
  identity_status: "planned",
};

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "throughline-rollout-package-test-"));
  const migrationsDirectory = join(root, "supabase", "migrations");
  const inputsDirectory = join(root, "supabase", "functions");
  await mkdir(migrationsDirectory, { recursive: true });
  await mkdir(inputsDirectory, { recursive: true });

  for (const migration of MIGRATIONS) {
    await cp(
      new URL(`../supabase/migrations/${migration}`, import.meta.url),
      join(migrationsDirectory, migration),
    );
  }

  const apiBundle = join(root, "api.bundle.js");
  const artifactBundle = join(root, "artifact-service.bundle.tar");
  const artifactSource = join(
    inputsDirectory,
    "private-artifact-delete",
    "index.ts",
  );
  const artifactConfig = join(root, "supabase", "config.toml");
  const inputA = join(inputsDirectory, "api.ts");
  const inputB = join(inputsDirectory, "shared.ts");
  await mkdir(join(inputsDirectory, "private-artifact-delete"), {
    recursive: true,
  });
  await writeFile(apiBundle, "content-free-api-bundle\n");
  await writeFile(artifactBundle, "content-free-artifact-service-bundle\n");
  await writeFile(artifactSource, "export const artifactDelete = true;\n");
  await writeFile(
    artifactConfig,
    "[functions.private-artifact-delete]\nverify_jwt = false\n",
  );
  await writeFile(inputA, "export const api = true;\n");
  await writeFile(inputB, "export const shared = true;\n");

  return {
    root,
    apiBundle,
    artifactBundle,
    artifactInputs: [artifactSource, artifactConfig],
    apiInputs: [inputB, inputA],
  };
}

test("binds artifact source, function config, toolchain, and derived runtime identities", async (t) => {
  const buildEvaluationRolloutPackage = requiredExport(
    "buildEvaluationRolloutPackage",
  );
  const setup = await fixture();
  t.after(() => rm(setup.root, { recursive: true, force: true }));
  const manifest = await buildEvaluationRolloutPackage({
    repoRoot: setup.root,
    apiBundle: setup.apiBundle,
    apiInputs: setup.apiInputs,
    artifactServiceBundle: setup.artifactBundle,
    artifactServiceInputs: setup.artifactInputs,
    artifactServiceDescriptor: DESCRIPTOR,
  });

  assert.deepEqual(
    manifest.artifact_service.input_set.files.map(({ path }) => path),
    [
      "supabase/config.toml",
      "supabase/functions/private-artifact-delete/index.ts",
    ],
  );
  assert.deepEqual(manifest.artifact_service.build, {
    tool: "deno",
    version: "2.9.5",
    command: [
      "deno",
      "bundle",
      "supabase/functions/private-artifact-delete/index.ts",
    ],
    reproducibility: "byte_identical_twice",
  });
  assert.deepEqual(manifest.api.build.command, [
    "deno",
    "bundle",
    "--frozen",
    "--config",
    "supabase/functions/api/deno.json",
    "--lock",
    "supabase/functions/api/deno.lock",
    "supabase/functions/api/index.ts",
  ]);
  for (const configuration of Object.values(manifest.api.configuration)) {
    const { identity_sha256: identity, ...values } = configuration;
    assert.equal(identity, sha256(`${JSON.stringify(values)}\n`));
    assert.equal(
      values.private_artifact_delete.route,
      "/functions/v1/private-artifact-delete",
    );
    assert.equal(values.private_artifact_storage.max_cases_per_receipt, 249);
    assert.equal(
      values.artifact_reconciliation.schedule_status,
      "required_before_private_materialization",
    );
  }
});

test("builds the same content-free package regardless of API input order", async (t) => {
  const buildEvaluationRolloutPackage = requiredExport(
    "buildEvaluationRolloutPackage",
  );
  const setup = await fixture();
  t.after(() => rm(setup.root, { recursive: true, force: true }));

  const options = {
    repoRoot: setup.root,
    apiBundle: setup.apiBundle,
    artifactServiceBundle: setup.artifactBundle,
    artifactServiceInputs: setup.artifactInputs,
    artifactServiceDescriptor: DESCRIPTOR,
  };
  const first = await buildEvaluationRolloutPackage({
    ...options,
    apiInputs: setup.apiInputs,
  });
  const second = await buildEvaluationRolloutPackage({
    ...options,
    apiInputs: [...setup.apiInputs].reverse(),
  });

  assert.deepEqual(first, second);
  assert.equal(
    `${JSON.stringify(first, null, 2)}\n`,
    builder.serializeEvaluationRolloutPackage(first),
  );
  assert.equal(first.schema_version, "throughline_evaluation_rollout_package_v1");
  assert.equal(first.deployment_state, "planned");
  assert.deepEqual(
    first.migrations.map(({ filename, sha256 }) => [filename, sha256]),
    MIGRATIONS.map((filename, index) => [filename, MIGRATION_HASHES[index]]),
  );
  assert.equal(first.api.configuration.flags_off.evaluation_retention, false);
  assert.equal(
    first.api.configuration.retention_aware_rollback.compatibility_mode,
    "retention_aware",
  );
  assert.deepEqual(first.artifact_service.target, DESCRIPTOR);

  const apiBytes = await readFile(setup.apiBundle);
  const artifactBytes = await readFile(setup.artifactBundle);
  assert.equal(first.api.bundle.sha256, sha256(apiBytes));
  assert.equal(first.api.bundle.size_bytes, apiBytes.byteLength);
  assert.equal(first.artifact_service.bundle.sha256, sha256(artifactBytes));
  assert.equal(first.artifact_service.bundle.size_bytes, artifactBytes.byteLength);
  assert.deepEqual(
    first.api.input_set.files.map(({ path }) => path),
    [
      "supabase/functions/api.ts",
      "supabase/functions/shared.ts",
    ],
  );
  assert.match(first.api.input_set.sha256, /^[0-9a-f]{64}$/u);

  const serialized = builder.serializeEvaluationRolloutPackage(first);
  assert.doesNotMatch(serialized, new RegExp(setup.root, "u"));
  assert.doesNotMatch(serialized, /content-free-(?:api|artifact)/u);
  assert.doesNotMatch(serialized, /(?:Bearer\s|https?:\/\/|supabase\.co|\/Users\/)/iu);
});

test("fails closed when the frozen TL-EVAL migration set or bytes drift", async (t) => {
  const buildEvaluationRolloutPackage = requiredExport(
    "buildEvaluationRolloutPackage",
  );
  const setup = await fixture();
  t.after(() => rm(setup.root, { recursive: true, force: true }));
  const valid = {
    repoRoot: setup.root,
    apiBundle: setup.apiBundle,
    apiInputs: setup.apiInputs,
    artifactServiceBundle: setup.artifactBundle,
    artifactServiceInputs: setup.artifactInputs,
    artifactServiceDescriptor: DESCRIPTOR,
  };

  await writeFile(
    join(setup.root, "supabase", "migrations", MIGRATIONS[0]),
    "-- drift\n",
  );
  await assert.rejects(
    buildEvaluationRolloutPackage(valid),
    /migration SHA-256 mismatch/u,
  );

  await cp(
    new URL(`../supabase/migrations/${MIGRATIONS[0]}`, import.meta.url),
    join(setup.root, "supabase", "migrations", MIGRATIONS[0]),
  );
  await writeFile(
    join(
      setup.root,
      "supabase",
      "migrations",
      "20260823000000_evaluation_unexpected.sql",
    ),
    "-- unexpected\n",
  );
  await assert.rejects(
    buildEvaluationRolloutPackage(valid),
    /exact three TL-EVAL migrations/u,
  );
});

test("requires regular bundles and nonempty unique in-repository input sets", async (t) => {
  const buildEvaluationRolloutPackage = requiredExport(
    "buildEvaluationRolloutPackage",
  );
  const setup = await fixture();
  t.after(() => rm(setup.root, { recursive: true, force: true }));
  const valid = {
    repoRoot: setup.root,
    apiBundle: setup.apiBundle,
    apiInputs: setup.apiInputs,
    artifactServiceBundle: setup.artifactBundle,
    artifactServiceInputs: setup.artifactInputs,
    artifactServiceDescriptor: DESCRIPTOR,
  };

  await assert.rejects(
    buildEvaluationRolloutPackage({ ...valid, apiInputs: [] }),
    /at least one API input/u,
  );
  await assert.rejects(
    buildEvaluationRolloutPackage({
      ...valid,
      apiInputs: [setup.apiInputs[0], setup.apiInputs[0]],
    }),
    /duplicate API input/u,
  );
  await assert.rejects(
    buildEvaluationRolloutPackage({ ...valid, apiInputs: [setup.apiBundle] }),
    /API inputs must be inside the repository/u,
  );
  await assert.rejects(
    buildEvaluationRolloutPackage({ ...valid, apiBundle: join(setup.root, "missing") }),
    /API bundle must be a regular file/u,
  );
  await assert.rejects(
    buildEvaluationRolloutPackage({ ...valid, artifactServiceInputs: [] }),
    /at least one artifact-service input/u,
  );
  await assert.rejects(
    buildEvaluationRolloutPackage({
      ...valid,
      artifactServiceInputs: [
        setup.artifactInputs[0],
        setup.artifactInputs[0],
      ],
    }),
    /duplicate artifact-service input/u,
  );
});

test("accepts only the exact planned artifact-service target descriptor", () => {
  const validateArtifactServiceDescriptor = requiredExport(
    "validateArtifactServiceDescriptor",
  );
  assert.deepEqual(validateArtifactServiceDescriptor(DESCRIPTOR), DESCRIPTOR);
  assert.deepEqual(validateArtifactServiceDescriptor({
    ...DESCRIPTOR,
    provider: "oci",
    runtime: "container",
  }), {
    ...DESCRIPTOR,
    provider: "oci",
    runtime: "container",
  });

  for (const invalid of [
    { ...DESCRIPTOR, unexpected: true },
    { ...DESCRIPTOR, schema_version: "v2" },
    { ...DESCRIPTOR, provider: "oci" },
    { ...DESCRIPTOR, runtime: "container" },
    { ...DESCRIPTOR, deployment_name: "UPPER" },
    { ...DESCRIPTOR, region: "" },
    { ...DESCRIPTOR, route: "https://example.com/delete" },
    { ...DESCRIPTOR, route: "/delete?token=secret" },
    { ...DESCRIPTOR, identity_status: "deployed" },
  ]) {
    assert.throws(
      () => validateArtifactServiceDescriptor(invalid),
      /artifact-service target descriptor/u,
    );
  }
});

test("CLI accepts only explicit non-secret package inputs", () => {
  const parseCliArgs = requiredExport("parseCliArgs");
  const descriptor = JSON.stringify(DESCRIPTOR);
  assert.deepEqual(parseCliArgs([
    "--api-bundle",
    "api.js",
    "--api-input",
    "index.ts",
    "--api-input",
    "shared.ts",
    "--artifact-service-bundle",
    "service.tar",
    "--artifact-service-input",
    "artifact.ts",
    "--artifact-service-input",
    "config.toml",
    "--artifact-service-descriptor",
    descriptor,
  ]), {
    apiBundle: "api.js",
    apiInputs: ["index.ts", "shared.ts"],
    artifactServiceBundle: "service.tar",
    artifactServiceInputs: ["artifact.ts", "config.toml"],
    artifactServiceDescriptor: DESCRIPTOR,
  });

  for (const invalid of [
    [],
    ["--unknown", "value"],
    ["--api-bundle", "api.js"],
    [
      "--api-bundle",
      "api.js",
      "--api-input",
      "index.ts",
      "--artifact-service-bundle",
      "service.tar",
      "--artifact-service-input",
      "artifact.ts",
      "--artifact-service-descriptor",
      "not-json",
    ],
  ]) {
    assert.throws(() => parseCliArgs(invalid), /rollout package arguments/u);
  }
});

test("input-set identity binds repository-relative paths, bytes, and sizes", async (t) => {
  const buildEvaluationRolloutPackage = requiredExport(
    "buildEvaluationRolloutPackage",
  );
  const setup = await fixture();
  t.after(() => rm(setup.root, { recursive: true, force: true }));
  const options = {
    repoRoot: setup.root,
    apiBundle: setup.apiBundle,
    apiInputs: setup.apiInputs,
    artifactServiceBundle: setup.artifactBundle,
    artifactServiceInputs: setup.artifactInputs,
    artifactServiceDescriptor: DESCRIPTOR,
  };
  const before = await buildEvaluationRolloutPackage(options);
  await writeFile(setup.apiInputs[0], "export const shared = false;\n");
  const after = await buildEvaluationRolloutPackage(options);

  assert.notEqual(before.api.input_set.sha256, after.api.input_set.sha256);
  assert.notEqual(
    before.api.input_set.files.find(({ path }) => basename(path) === "shared.ts").sha256,
    after.api.input_set.files.find(({ path }) => basename(path) === "shared.ts").sha256,
  );
});
