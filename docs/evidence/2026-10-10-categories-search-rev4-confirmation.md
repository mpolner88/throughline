**Categories and search — revision 4 confirmation (TL-KNOW-001)**

**Reviewer:** Codex. **Verified:** 2026-10-10. **Verdict: `confirmed` — revision 4 stays `handoff_ready`.** CT1 and CT2 are resolved as proposed. **New findings: 0 blocking / 0 material / 0 minor.** Build entry remains unapproved; this receipt does not select or approve build. Q8 remains deferred and unrun.

**Exact review boundary.** Local branch `codex/running-list`, initially clean at `61532b4c20c5a44feb8e03289d75c63344229586`. Ancestry was checked before review and again before writing. Reviewed the requested revision-3-to-4 diff from `49500c7ea1f7bc931a8fdf31a8ffc0dabc87994b`, limited to `docs/handoffs/` and the candidates record, plus the prior Codex receipt. Working reviewed files match the committed target. This follows the exact-revision receipt requirement in [AGENT_TANDEM.md](../AGENT_TANDEM.md:24) and its [exact-file precedent](../AGENT_TANDEM.md:52).

| Reviewed file | SHA-256 |
| --- | --- |
| [Handoff revision 4](../handoffs/2026-10-05-categories-search.md) | `e8591e614450d98fbf2711196f3bf1783c9553221b327b5c4e1a6ac1d00d1855` |
| [Frozen selected-mock.html](../handoffs/assets/2026-10-05-categories-search/selected-mock.html) | `a3015c2c49396e26b1ecc64b47692a2a1024e06796423e3d90818ed63c610bff` |
| [verify-rules.mjs](../handoffs/assets/2026-10-05-categories-search/verify-rules.mjs) | `b36b740c008b423db26ad62e10858be6fe1b8aa34d01c8e505536463626913a5` |
| [SHA256SUMS.txt](../handoffs/assets/2026-10-05-categories-search/SHA256SUMS.txt), 34 entries | `695ddf58bdc9a7cfdc5358d346bf92d074e43bde3456dbd7a5e1519c88654732` |
| [Candidates record](2026-10-05-categories-search-candidates.md) | `b9e5eecdf4ec3444b3f2ab746e20741b9ba9a9796687a0d2e634065867b03718` |
| [Codex re-review 2](2026-10-10-categories-search-feasibility-recheck-2.md) | `9cefe9d8bdbda2bf84b4118f88ac4a776df298999cfd4ca2956492828cdc5713` |

**CT1 — confirmed.** [Handoff:415](../handoffs/2026-10-05-categories-search.md:415) no longer presents the shipped parser as a validity check. [Handoff:420](../handoffs/2026-10-05-categories-search.md:420) requires validation of the whole original string against grammar and date/time/offset ranges, rejects non-nil `Date` as proof, preserves the shared parser, carries known/unknown provenance through models and caches, and requires tests on the supported iOS parser path. This matches [CT1's proposed resolution:78](2026-10-10-categories-search-feasibility-recheck-2.md:78). The added trailing-text vector at [mock:299](../handoffs/assets/2026-10-05-categories-search/selected-mock.html:299) correctly expects `null` under `instantOf` at mock:793–803. Independent synthetic suffix probes also returned unknown instant/day/age; a valid control passed. The iOS requirement is documented, not executed here.

**CT2 — confirmed.** [Handoff:385](../handoffs/2026-10-05-categories-search.md:385) now matches `newer` at [mock:614](../handoffs/assets/2026-10-05-categories-search/selected-mock.html:614) and `todoOrder` at [mock:716–719](../handoffs/assets/2026-10-05-categories-search/selected-mock.html:716): after the source instant, source-note ID descending, then position, then to-do ID ascending. Both added page vectors at [mock:504–517](../handoffs/assets/2026-10-05-categories-search/selected-mock.html:504) are correct: the two offset representations are the same instant; both cases order notes `z, a` and tasks `task-z, task-a`; spans are respectively `today` and `null`.

Independent stdin-only Node probes used synthetic sources `probe-b` and `probe-y`, with task positions 0 and 50. The greater source ID won for equal instants, both unknown, and invalid/missing times, including reversed input order. Page rows/spans, unloaded sources, same-note position and final task-ID ties passed. **22/22 independent assertions passed: 18 ordering/page checks and 4 timestamp checks.**

**Integrity and delta checks passed.**

- `shasum -a 256 -c SHA256SUMS.txt` in the asset directory: **34/34**.
- `node docs/handoffs/assets/2026-10-05-categories-search/verify-rules.mjs`: **197/197**, comprising 192 vectors in 18 groups and 5 calendar checks.
- Direct Git-blob byte comparisons: the 21,826 bytes between RULES markers are identical to revision 3, SHA-256 `9cc27d957758393588dec1ec742a80eac8525f4ff0b31b10f86fb9decfc65354`. All **32/32 screens** and the verifier are byte-identical. Working screens also match those blobs.
- Removing only the vectors block and gallery-header span makes both mock versions byte-identical. Parsed vectors retain every old case, adding exactly one instant and two pages. Only the mock's checksum changes in the manifest.
- Repository docs verification passed (19 backlog items, 49 checked Markdown files); whitespace checks found no errors. Final HEAD remains the reviewed commit, with only this receipt untracked.

**Receipt, base and stage confirmed.** Handoff:33–44 and :765–772 accurately record revision 3's feasible verdict, two minor findings, contract-level closure and permission for Claude to set `handoff_ready` ([prior receipt:5–7](2026-10-10-categories-search-feasibility-recheck-2.md:5)). The “not re-reviewed revision 4” statements were accurate when authored; this file supplies that confirmation. `ecc301a` is accurately identified as the preparation base, not the final commit parent. `bba98bb` changes only the build number; `ecc301a` changes the other slice's documentation/evidence/backlog. Actual parent `a30cede54133d2d0feb05f9a9d124591a2208409` adds another unrelated documentation update. No cited application/backend source changes across those commits. Beyond CT1/CT2, the scoped delta updates receipt/status, provenance, counts and hashes; no other substantive contract or selected behavior changes. No CV findings.

**Remaining unverified:** the entire [re-review 2 list](2026-10-10-categories-search-feasibility-recheck-2.md#remaining-unverified-checks) remains, with the native parity set now **192** vectors. This includes supported-iOS adapter/provenance, backend/suppression/event contracts, loading and lifecycle integration, native rendering/accessibility, physical-device performance, cache protection, Q1 semantics and Q8. No native build, simulator/device run, remote service/database access, commit, push or upload occurred.

**Recommendations only:** Claude may link this receipt and replace revision 4's pending-review wording, preserving `handoff_ready`. A later coordinated documentation pass should refresh the stale TL-KNOW-001 backlog next action and add dated local evidence to CURRENT_STATE; record any missing decision append-only. Retrieval metrics remain later approved instrumentation work in `product/metrics.md`. None of those files was edited; this receipt is the only new file.

**Next action: Mike decides build entry.**
