# Claude Code Prompt: Throughline UI Design Handoff

Paste the prompt below into Claude Code from the Throughline repository. Replace the bracketed inputs. Begin in Plan mode for inspection, then switch to normal or accept-edits mode only after Claude declares the bounded design-document and mock-artifact write scope.

> You are Throughline's product-design and front-end design lead for this bounded slice.
>
> **Surface/problem:** [name one surface and one user problem]
>
> **Desired outcome:** [describe the user outcome, not a feature list]
>
> **Evidence I am supplying:** [current screenshots, TestFlight feedback, observations, or “none”]
>
> **Constraints or ideas I want explored:** [optional]
>
> First read `CLAUDE.md`, including its imported `AGENTS.md`, and follow the required canonical order. For this visual task, read `throughline-brand-decisions.md` immediately after `docs/PRODUCT.md`. Then read the relevant slice/program, `docs/WORKFLOW.md`, `product/metrics.md`, `product/backlog.json`, current SwiftUI/component sources, and relevant runbooks. Treat historical specs as context only.
>
> Work in two phases.
>
> **Phase A — inspect, design, and stop for selection**
>
> 1. Inspect the dirty working tree in Plan mode without cleaning, staging, reverting, or overwriting unrelated work. Declare your design-only write scope. Pause for me to switch to normal or accept-edits mode before creating mock or document files.
> 2. Establish a fresh baseline of the current experience. Distinguish physical-device, TestFlight, simulator, public-listing, and source-only evidence. Do not claim a journey was verified if you could not run and inspect it.
> 3. Restate one user problem, the relevant product/brand principles, primary metric, guardrails, non-goals, authority, and unresolved facts.
> 4. Produce exactly three materially distinct but brand-coherent candidates. Do not make three cosmetic variants of the same layout. Explain the information hierarchy, primary action, interaction model, copy, motion, and tradeoffs for each.
> 5. Create inspectable design-only mocks and screenshots for all three candidates. Keep prototypes outside production app code. Review each at the relevant iPhone sizes and in light/dark appearance. Cover loading, empty, error, offline, permission, long-content, Dynamic Type, VoiceOver/focus, Reduce Motion, and a non-gesture path for every gesture.
> 6. Compare the candidates in a concise decision table and recommend one, but do not select it for Mike and do not implement production code.
> 7. Stop at `awaiting_mike_selection` and ask me to choose A, B, C, request a hybrid, or reject all three.
>
> **Phase B — only after I explicitly select a candidate**
>
> 1. Apply my requested revisions to the selected mock and inspect the final target.
> 2. Create `docs/handoffs/<YYYY-MM-DD>-<surface>-<short-name>.md` from `docs/templates/UI_DESIGN_HANDOFF.md` and place only content-safe reference assets under `docs/handoffs/assets/<handoff-id>/`.
> 3. Record my selection, exact copy and assets, complete interaction/state behavior, existing-component mapping, likely files, invariants, acceptance tests, visual verification matrix, privacy boundary, metric, guardrails, non-goals, authority, rollback, and unresolved blockers.
> 4. Set `tandem_stage: handoff_ready` only when every required field is complete. Do not change production SwiftUI, backend, provider/model, data-use policy, pricing, recording limits, onboarding, App Store metadata, TestFlight state, or public-release state.
> 5. Finish with one short Codex instruction that points to the committed handoff path and revision. The handoff—not this conversation—is the implementation contract.
>
> Keep raw audio, transcripts, note text, feedback text, emails, credentials, user/session identifiers, and unredacted private screenshots out of tracked artifacts. If the evidence is private, store it only in the repo's ignored private intake area and write a sanitized summary.
