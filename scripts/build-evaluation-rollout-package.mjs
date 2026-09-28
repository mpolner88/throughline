import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const PACKAGE_SCHEMA_VERSION = "throughline_evaluation_rollout_package_v1";
const ARTIFACT_TARGET_SCHEMA_VERSION = "throughline_artifact_service_target_v1";
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;
const ROUTE_PATTERN = /^\/[A-Za-z0-9/_-]*$/u;

const FROZEN_MIGRATIONS = [
  {
    filename: "20260818000000_evaluation_truth_lineage.sql",
    sha256: "3e28bfb642f0cbf12bb8b5705de243a12ea71ce9a70fbbb2b9db9a9d86dcbd72",
  },
  {
    filename: "20260822154500_evaluation_retention.sql",
    sha256: "282f7eb45aa7a3b77301e548292da07ca7bfc2b83979ca93830ca55ba7d49b79",
  },
  {
    filename: "20260822170000_evaluation_retention_claims.sql",
    sha256: "4add0d4bd51b71babda3405b8187e4351ea6358e8dfc3378e73bf8280057dd90",
  },
];

const CONFIGURATION_VALUES = {
  flags_off: {
    schema_version: "throughline_evaluation_runtime_configuration_v1",
    lineage_writes: false,
    evaluation_writes: false,
    evaluation_retention: false,
    compatibility_mode: null,
    evaluation_retention_eligible_since: null,
    private_artifact_delete: {
      provider: "supabase",
      deployment_name: "private-artifact-delete",
      route: "/functions/v1/private-artifact-delete",
      same_project_only: true,
      required_secret_names: ["THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN"],
    },
    private_artifact_storage: {
      bucket: "throughline-audio",
      prefix: "evaluation-artifacts",
      max_objects_per_receipt: 1000,
      max_cases_per_receipt: 249,
    },
    artifact_reconciliation: {
      endpoint: "/maintenance/evaluation-artifact-reconciliation",
      schedule_status: "required_before_private_materialization",
      stale_seconds: 3600,
      batch_limit: 100,
      claim_ttl_seconds: 300,
    },
  },
  retention_aware_rollback: {
    schema_version: "throughline_evaluation_runtime_configuration_v1",
    lineage_writes: false,
    evaluation_writes: false,
    evaluation_retention: true,
    compatibility_mode: "retention_aware",
    evaluation_retention_eligible_since: "cutover_timestamp_required",
    private_artifact_delete: {
      provider: "supabase",
      deployment_name: "private-artifact-delete",
      route: "/functions/v1/private-artifact-delete",
      same_project_only: true,
      required_secret_names: ["THROUGHLINE_PRIVATE_ARTIFACT_DELETE_TOKEN"],
    },
    private_artifact_storage: {
      bucket: "throughline-audio",
      prefix: "evaluation-artifacts",
      max_objects_per_receipt: 1000,
      max_cases_per_receipt: 249,
    },
    artifact_reconciliation: {
      endpoint: "/maintenance/evaluation-artifact-reconciliation",
      schedule_status: "required_before_private_materialization",
      stale_seconds: 3600,
      batch_limit: 100,
      claim_ttl_seconds: 300,
    },
  },
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const configurationManifest = (values) => ({
  identity_sha256: sha256(`${JSON.stringify(values)}\n`),
  ...values,
});
const CONFIGURATION = Object.fromEntries(
  Object.entries(CONFIGURATION_VALUES).map(([name, values]) => [
    name,
    configurationManifest(values),
  ]),
);
const API_BUILD = {
  tool: "deno",
  version: "2.9.5",
  command: [
    "deno",
    "bundle",
    "--frozen",
    "--config",
    "supabase/functions/api/deno.json",
    "--lock",
    "supabase/functions/api/deno.lock",
    "supabase/functions/api/index.ts",
  ],
  reproducibility: "byte_identical_twice",
};
const ARTIFACT_SERVICE_BUILD = {
  tool: "deno",
  version: "2.9.5",
  command: [
    "deno",
    "bundle",
    "supabase/functions/private-artifact-delete/index.ts",
  ],
  reproducibility: "byte_identical_twice",
};

const exactKeys = (value, expected) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index]);
};

export function validateArtifactServiceDescriptor(value) {
  const keys = [
    "schema_version",
    "provider",
    "runtime",
    "deployment_name",
    "region",
    "route",
    "identity_status",
  ];
  const pairing = `${value?.provider ?? ""}:${value?.runtime ?? ""}`;
  if (
    !exactKeys(value, keys) ||
    value.schema_version !== ARTIFACT_TARGET_SCHEMA_VERSION ||
    !["supabase:edge_function", "oci:container"].includes(pairing) ||
    typeof value.deployment_name !== "string" ||
    value.deployment_name.length > 80 ||
    !SLUG_PATTERN.test(value.deployment_name) ||
    typeof value.region !== "string" ||
    value.region.length > 80 ||
    !SLUG_PATTERN.test(value.region) ||
    typeof value.route !== "string" ||
    value.route.length > 200 ||
    !ROUTE_PATTERN.test(value.route) ||
    value.route.includes("//") ||
    value.identity_status !== "planned"
  ) {
    throw new Error("Invalid artifact-service target descriptor");
  }

  return {
    schema_version: value.schema_version,
    provider: value.provider,
    runtime: value.runtime,
    deployment_name: value.deployment_name,
    region: value.region,
    route: value.route,
    identity_status: value.identity_status,
  };
}

const requiredValue = (args, index) => {
  const value = args[index + 1];
  if (typeof value !== "string" || value.length === 0 || value.startsWith("--")) {
    throw new Error("Invalid rollout package arguments");
  }
  return value;
};

export function parseCliArgs(args) {
  if (!Array.isArray(args)) throw new Error("Invalid rollout package arguments");
  const parsed = { apiInputs: [], artifactServiceInputs: [] };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = requiredValue(args, index);
    if (flag === "--api-input") {
      parsed.apiInputs.push(value);
      continue;
    }
    if (flag === "--artifact-service-input") {
      parsed.artifactServiceInputs.push(value);
      continue;
    }
    const property = {
      "--api-bundle": "apiBundle",
      "--artifact-service-bundle": "artifactServiceBundle",
      "--artifact-service-descriptor": "artifactServiceDescriptor",
    }[flag];
    if (property === undefined || parsed[property] !== undefined) {
      throw new Error("Invalid rollout package arguments");
    }
    parsed[property] = value;
  }

  if (
    parsed.apiBundle === undefined ||
    parsed.apiInputs.length === 0 ||
    parsed.artifactServiceBundle === undefined ||
    parsed.artifactServiceInputs.length === 0 ||
    parsed.artifactServiceDescriptor === undefined
  ) {
    throw new Error("Invalid rollout package arguments");
  }
  try {
    parsed.artifactServiceDescriptor = validateArtifactServiceDescriptor(
      JSON.parse(parsed.artifactServiceDescriptor),
    );
  } catch {
    throw new Error("Invalid rollout package arguments");
  }
  return parsed;
}

async function regularFileIdentity(path, label) {
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size === 0) {
      throw new Error("not regular");
    }
    const bytes = await readFile(path);
    return { sha256: sha256(bytes), size_bytes: bytes.byteLength };
  } catch {
    throw new Error(`${label} must be a regular file`);
  }
}

const portableRelativePath = (repoRoot, path, label) => {
  const candidate = relative(repoRoot, path);
  if (
    candidate.length === 0 ||
    candidate === ".." ||
    candidate.startsWith(`..${sep}`) ||
    resolve(repoRoot, candidate) !== path
  ) {
    throw new Error(`${label} inputs must be inside the repository`);
  }
  return candidate.split(sep).join("/");
};

async function migrationManifest(repoRoot) {
  const directory = resolve(repoRoot, "supabase", "migrations");
  let names;
  try {
    names = (await readdir(directory))
      .filter((name) => /_evaluation_.*\.sql$/u.test(name))
      .sort();
  } catch {
    throw new Error("Expected exact three TL-EVAL migrations");
  }
  const expectedNames = FROZEN_MIGRATIONS.map(({ filename }) => filename);
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error("Expected exact three TL-EVAL migrations");
  }

  const result = [];
  for (const expected of FROZEN_MIGRATIONS) {
    const identity = await regularFileIdentity(
      resolve(directory, expected.filename),
      "TL-EVAL migration",
    );
    if (!SHA256_PATTERN.test(identity.sha256) || identity.sha256 !== expected.sha256) {
      throw new Error(`TL-EVAL migration SHA-256 mismatch: ${expected.filename}`);
    }
    result.push({
      filename: expected.filename,
      sha256: identity.sha256,
      size_bytes: identity.size_bytes,
    });
  }
  return result;
}

async function inputSetManifest({ repoRoot, bundle, inputs, label }) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error(`Expected at least one ${label} input`);
  }
  const resolvedBundle = resolve(bundle);
  const resolvedInputs = inputs.map((path) => resolve(path));
  if (new Set(resolvedInputs).size !== resolvedInputs.length) {
    throw new Error(`Unexpected duplicate ${label} input`);
  }

  const files = [];
  for (const path of resolvedInputs) {
    if (path === resolvedBundle) {
      throw new Error(`${label} inputs must be inside the repository`);
    }
    const portablePath = portableRelativePath(repoRoot, path, label);
    const identity = await regularFileIdentity(path, `${label} input`);
    files.push({ path: portablePath, ...identity });
  }
  files.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return {
    sha256: sha256(`${JSON.stringify(files)}\n`),
    files,
  };
}

export async function buildEvaluationRolloutPackage(options) {
  if (!exactKeys(options, [
    "repoRoot",
    "apiBundle",
    "apiInputs",
    "artifactServiceBundle",
    "artifactServiceInputs",
    "artifactServiceDescriptor",
  ])) {
    throw new Error("Invalid rollout package build inputs");
  }
  const repoRoot = resolve(options.repoRoot);
  const descriptor = validateArtifactServiceDescriptor(
    options.artifactServiceDescriptor,
  );
  const [
    migrations,
    apiBundle,
    apiInputSet,
    artifactBundle,
    artifactInputSet,
  ] = await Promise.all([
    migrationManifest(repoRoot),
    regularFileIdentity(resolve(options.apiBundle), "API bundle"),
    inputSetManifest({
      repoRoot,
      bundle: options.apiBundle,
      inputs: options.apiInputs,
      label: "API",
    }),
    regularFileIdentity(
      resolve(options.artifactServiceBundle),
      "Artifact-service bundle",
    ),
    inputSetManifest({
      repoRoot,
      bundle: options.artifactServiceBundle,
      inputs: options.artifactServiceInputs,
      label: "artifact-service",
    }),
  ]);

  return {
    schema_version: PACKAGE_SCHEMA_VERSION,
    deployment_state: "planned",
    migrations,
    api: {
      bundle: apiBundle,
      input_set: apiInputSet,
      build: API_BUILD,
      configuration: CONFIGURATION,
    },
    artifact_service: {
      target: descriptor,
      bundle: artifactBundle,
      input_set: artifactInputSet,
      build: ARTIFACT_SERVICE_BUILD,
    },
  };
}

export function serializeEvaluationRolloutPackage(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

async function main() {
  const parsed = parseCliArgs(process.argv.slice(2));
  const manifest = await buildEvaluationRolloutPackage({
    repoRoot: process.cwd(),
    ...parsed,
  });
  process.stdout.write(serializeEvaluationRolloutPackage(manifest));
}

if (
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    process.stderr.write(`evaluation rollout package: ${error.message}\n`);
    process.exitCode = 1;
  });
}
