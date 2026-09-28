import assert from "node:assert/strict";
import test from "node:test";

import {
  runAdversarialIsolationProbe,
  runIsolatedAdapter,
  verifyAdapterIsolation,
} from "./adapter-isolation.mjs";

test("adversarial adapter cannot read a sentinel reference before output", async () => {
  const result = await runAdversarialIsolationProbe();
  assert.equal(result.exitCode === 0, false);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /PermissionDenied|Requires read access/u);
});

test("isolation verification fails closed without a compatible Deno", async () => {
  await assert.rejects(
    () => verifyAdapterIsolation({ denoBin: "/definitely/missing/deno" }),
    /adapter_isolation_unavailable/u,
  );
});

test("private provider network execution remains authorization-locked", async () => {
  await assert.rejects(
    () =>
      runIsolatedAdapter({
        policy: {
          approvedProviderHosts: ["api.groq.com"],
          approvedProviderEnvNames: ["GROQ_API_KEY"],
        },
        input: {},
        providerEnv: { GROQ_API_KEY: "not-a-real-key" },
      }),
    /provider_data_use_not_authorized/u,
  );
});
