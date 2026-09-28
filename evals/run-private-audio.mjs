#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  canonicalJson,
  resolveInferenceContract,
  sha256Hex,
} from "../core/inference-contract.mjs";
import { runIsolatedAdapter } from "./lib/adapter-isolation.mjs";
import {
  buildAdapterInput,
  validatePrivateManifest,
} from "./lib/private-manifest.mjs";

export async function sealPredictionBundle(bundle) {
  if (!bundle || !Array.isArray(bundle.predictions)) {
    throw new Error("prediction_bundle_invalid");
  }
  const ids = bundle.predictions.map((prediction) => prediction.case_id);
  if (
    ids.some((id) => typeof id !== "string" || !id) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("prediction_bundle_invalid");
  }
  const copy = structuredClone(bundle);
  const sealSha256 = await sha256Hex(canonicalJson(copy));
  return deepFreeze({ ...copy, seal_sha256: sealSha256 });
}

export async function runPrivateAudio(
  { manifest, root, adapterPath, out, policy = {} },
) {
  if (manifest?.purpose !== "synthetic_plumbing") {
    throw new Error("provider_data_use_not_authorized");
  }
  const contract = await resolveInferenceContract({});
  const validated = await validatePrivateManifest(manifest, root, { contract });
  const adapterBytes = new Uint8Array(await fs.readFile(adapterPath));
  const startedAt = new Date().toISOString();
  const predictions = [];
  for (const caseRecord of validated.cases) {
    const input = buildAdapterInput(caseRecord, contract.contract_sha256);
    const output = await runIsolatedAdapter({
      policy: {
        denoBin: policy.denoBin,
        adapterPath,
        approvedProviderHosts: [],
        approvedProviderEnvNames: [],
      },
      input,
      providerEnv: {},
    });
    predictions.push({ case_id: caseRecord.id, output });
  }
  const sealed = await sealPredictionBundle({
    bundle_version: "throughline-private-predictions-v1",
    manifest_sha256: validated.manifest_sha256,
    contract_sha256: contract.contract_sha256,
    adapter: {
      id: path.basename(adapterPath),
      sha256: await sha256Hex(adapterBytes),
    },
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    predictions,
  });
  if (out) {
    await fs.writeFile(out, `${JSON.stringify(sealed, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  return sealed;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (index % 2 === 0) {
        pairs.push([value.replace(/^--/u, ""), values[index + 1]]);
      }
      return pairs;
    }, []),
  );
  if (!args.manifest || !args.adapter || !args.out) {
    throw new Error("manifest, adapter, and out are required");
  }
  const manifestPath = path.resolve(args.manifest);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const sealed = await runPrivateAudio({
    manifest,
    root: path.dirname(manifestPath),
    adapterPath: path.resolve(args.adapter),
    out: path.resolve(args.out),
  });
  console.log(
    JSON.stringify({
      ok: true,
      plumbing_only: true,
      prediction_count: sealed.predictions.length,
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
