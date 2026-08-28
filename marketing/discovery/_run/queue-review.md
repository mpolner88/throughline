# Discovery Queue Review

**Checked:** 2026-08-27

## Structural Result

- Seven unique jobs parse from `marketing/orchestration/queue.seed.jsonl`.
- Every job references an existing prompt and plan.
- Every dependency names a known job.
- The dependency graph is acyclic.
- Downstream generated inputs are intentionally absent until their producer jobs complete.

## Active Execution

| Job | State | Route | Note |
| --- | --- | --- | --- |
| `ROOT-00` | complete | 5.6 Sol high | Baseline, evidence manifest, ownership map, dependency map, slice, decision, and backlog selection recorded |
| `DISC-01` | complete | 5.6 Terra high | Registry package and product-gap decisions accepted |
| `DISC-03` | complete | 5.6 Terra high | Proof kernel and provider action packet accepted; no generation submitted |
| `DISC-05` | complete | 5.6 Terra high | Demand portfolio accepted; `DISC05-SEO-001` selected |
| `DISC-02` | complete | 5.6 Terra high | Owned pages built, QA passed, and root deployment verified |
| `DISC-04` | complete | 5.6 Terra high | Eight-person no-send pilot and community packets accepted |
| `ROOT-99` | complete | 5.6 Sol high | Integration, isolated deployment, and public postflight complete |

## Current Authorization

Mike's 2026-08-27 “Ship it” selects `TL-DISC-001`, authorizes the reversible owned discovery build, and authorizes deployment of the verified static owned surface. Exact paid spend, compensation, direct outreach, account posting, community or directory submission, App Store change, and live product change remain decision packets.
