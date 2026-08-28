# Throughline Discovery Orchestration

This package turns five discovery priorities into six queueable prompts: one coordinator and one prompt for each independently reviewable workstream.

It is an evidence-bound production system. It can research, draft, build in approved files, verify, deploy the selected owned static site, and prepare exact external-action packets. It cannot submit to third parties, spend, contact creators, post from an account, change the App Store, or change live product behavior without the required Mike gate.

## Queue Order

| Job | Default route | May start when | Delivers |
| --- | --- | --- | --- |
| `ROOT-00` | `5.6-sol/high` | immediately | baseline, run manifest, ownership map, integration decision |
| `DISC-01` | `5.6-terra/high` | `ROOT-00` complete | agent ecosystem readiness and submission packet |
| `DISC-02` | `5.6-terra/high` | research can start after `ROOT-00`; build waits for `DISC-03` proof architecture and `DISC-05` attribution | owned surface spec/build/QA packet |
| `DISC-03` | `5.6-terra/high` | `ROOT-00` complete | first proof kernel and reusable content system |
| `DISC-04` | `5.6-terra/high` | research after `ROOT-00`; outreach packet waits for `DISC-03`, `DISC-02`, and `DISC-05` | creator/community pilot packet |
| `DISC-05` | `5.6-terra/high` | `ROOT-00` complete | ASO, product-page, Apple Ads, SEO, and attribution portfolio |
| `ROOT-99` | `5.6-sol/high` | all five workstreams complete | independent integration review and Mike decision packet |

## The Handful Of Prompts

1. Run `prompts/00-discovery-director.md` once to freeze the baseline and queue.
2. Queue `prompts/01-agent-ecosystem.md`, `prompts/03-proof-factory.md`, and `prompts/05-demand-capture.md` in parallel.
3. Queue `prompts/02-owned-surface.md` when its proof and attribution inputs exist.
4. Queue `prompts/04-creator-seeding.md` when an accepted proof kit and named destination links exist.
5. Queue `ROOT-99`, which reuses the director prompt with `mode=integrate`, to audit combined outputs and prepare Mike's decision packet.

Each workstream prompt contains its own subagent map. If the runtime supports delegation, the lead dispatches the leaf assignments with fresh context. If it does not, the lead executes the assignments sequentially while preserving the same ownership and review gates.

## Seeded Queue

`queue.seed.jsonl` contains one JSON object per job. The queue runner must validate every line against `job.schema.json` before execution.

Allowed status transitions:

```text
queued -> running -> review -> complete
                  -> blocked
```

`blocked` means a missing dependency, unavailable first-party source, or impossible required verification prevents the preparation deliverable. It does not authorize a workaround. Reaching the intended approval gate after every preparation acceptance check passes is `complete`, with the gated external action listed as not taken.

## Job Contract

Every job includes:

- `id`: stable job identifier;
- `workstream`: one of the five priorities or root coordination;
- `model_alias` and `effort`: routing labels from `model-routing.md`;
- `prompt_file`: self-contained prompt packet;
- `plan_file`: the workstream implementation plan;
- `inputs`: minimum allowed context;
- `write_scope`: exclusive file or directory ownership;
- `dependencies`: jobs whose artifacts must exist first;
- `decision_context`: essential user decisions without full-chat inheritance;
- `acceptance`: objective exit checks;
- `approval_gate`: the external action the worker must not cross;
- `status`: current queue state.

## Shared Canonical Read Order

Every lead reads, in order:

1. `docs/CURRENT_STATE.md`
2. `docs/PRODUCT.md`
3. `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`
4. its workstream plan
5. `docs/WORKFLOW.md`
6. `product/metrics.md`
7. `product/backlog.json`
8. the relevant runbooks and marketing artifacts listed in the job

## Shared Safety Contract

- Separate shipped, demo, internal/debug, planned, and unverified behavior.
- Use current first-party sources for platform rules and attach the checked date.
- Never commit raw recordings, transcripts, note text, feedback text, emails, credentials, tokens, raw IDs, or private messages.
- Use synthetic demo data and obscure notifications, tokens, and identifiers in media.
- Do not call Throughline write-capable; the current MCP is owner-scoped and read-only.
- Treat “fastest” as a message hypothesis until comparative evidence is approved.
- The selected owned static site may deploy after root verification; do not post from an account, schedule, submit to third parties, spend, or conduct outreach.
- Provider, base-model, data-use, pricing, recording-limit, onboarding, OAuth/product flow, and App Store changes go to Mike.

## Output Contract

Every workstream creates:

```text
decision-summary.md
evidence-manifest.md
acceptance-checklist.md
blockers.md
```

The decision summary must contain:

1. current baseline;
2. work completed;
3. evidence strength;
4. one recommended next action;
5. alternatives considered;
6. required Mike decision;
7. external actions not taken.

The evidence manifest records only public or repository-safe evidence:

```markdown
| Claim | Status | Source | Checked | Used by |
| --- | --- | --- | --- | --- |
```

Allowed statuses are `verified_current`, `repository_assertion`, `observed_signal`, `hypothesis`, `planned`, and `blocked`.

## Learning Loop

Every experiment receives an ID before an asset or post is made. Use one material variable and one primary metric.

The Evidence and Learning Auditor checks:

- source/campaign attribution exists before distribution;
- platform privacy thresholds are respected;
- download-to-auth is labeled as an aggregate proxy;
- first value excludes onboarding-promotion activity;
- first MCP use remains a coverage gap until instrumented;
- weak samples produce a next measurement action, not a winner;
- qualitative feedback is coded without retaining private text.

Only evidence that repeats or prevents a material failure may update the durable message or workflow library. A single subjective preference stays in the experiment retro.

## Approval Packet

The director's final packet contains no more than five decisions:

- exact action proposed;
- why now;
- evidence and confidence;
- cost or external exposure;
- rollback or stop condition;
- linked artifacts;
- a clear approve, revise, or defer choice.

This preserves Mike's control without making him review every intermediate artifact.
