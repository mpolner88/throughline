# PR #3: two decisions before a main merge

Verified 2026-09-28 by Codex against source `372178b2b68d81691e8228443dacfebeec989e00`, main `fd85d0183719ac119d2c12a64435ef846faa3a0d`, live read-only GitHub Pages settings, and the primary sources below. Both decisions are **pending Mike**. This packet does not authorize implementation, publication, or a merge.

## R8 — AI-processing permission

**Verified change:** main contains the permission gate introduced in `39f8ce8`. PR #3 removes its Home prompt, stored permission and Settings control through the reconstructed release source in `c69fc05`. Compare [main Home](https://github.com/mpolner88/throughline/blob/fd85d0183719ac119d2c12a64435ef846faa3a0d/ios/Throughline/Views/HomeView.swift#L19) with [reviewed Home](https://github.com/mpolner88/throughline/blob/372178b2b68d81691e8228443dacfebeec989e00/ios/Throughline/Views/HomeView.swift#L17). The [readiness record](../app-store-readiness.md) already identifies absent ordinary AI permission as unresolved. Main's source is not proof of the exact public binary; source-to-signed-binary identity remains unproved.

**Why approval matters:** this is a consent-behavior change, separate from approving accurate policy text. Apple's current [App Review Guideline 5.1.2(i)](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing) requires clear disclosure of third-party sharing, including AI, and explicit permission beforehand. A microphone prompt and a privacy-policy link do not by themselves establish that permission. No new Apple account or device verification was performed here.

**Recommendation:** retain equivalent explicit AI-processing permission in the shared base. Approve a separately bounded restoration/adaptation of main's gate before merging PR #3, with Claude reviewing its presentation. Test first use, refusal, permission withdrawal, persisted choice, demo and signed-in paths, and no provider request before permission. This task changes no app code and selects no new onboarding design.

**Alternative requiring an explicit decision:** accept the gate's removal as a source-reconciliation choice and keep submission blocked until a separately approved replacement is implemented. This leaves the known consent gap open; Codex does not recommend it. Merging source does not update installed apps, but can establish an unsafe future release baseline.

**Policy interaction:** approved policy bytes remain frozen: Markdown `2b0b68dce68b816f9471df3855fe0d2e7462ae9050c7d0c8ae34a144e71c7fce`, HTML `4be13989c8a52153f4f9faf54770c564a483437ec54ce74803dfbc7d2a455965`. Any behavior-driven policy wording change needs approval of the revised text; none is made here. App Store answers remain a next-build task.

## R9 — what the public website publishes

**Verified configuration:** the GitHub Pages API returned `build_type: legacy`, `source: {branch: main, path: /docs}`, `status: built` on 2026-09-28. The candidate has no tracked `docs/_config.yml` and no root/docs `.nojekyll`.

**Expected consequence, not a deployed-candidate observation:** merging adds current-state documents, evidence, handoffs and images beneath the publishing source. [GitHub's Pages/Jekyll documentation](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll) describes default exclusions and automatic publication after changes reach the publishing branch. These new paths have no explicit exclusion. Markdown can become pages and images/static assets can become directly reachable. The candidate site was not built or deployed in this task; the exact generated URL inventory remains to be tested. All committed files are already public in Git regardless of site exclusions.

**Recommendation:** approve a separate Pages-output restriction before the main merge. Preserve the intended public home, privacy, support, voice-to-task-list page and their required assets; explicitly exclude internal Markdown, evidence, handoffs, unreleased mock images, prompts, templates, release records and other non-site material. Use `docs/_config.yml` exclusions with an output inventory check, or a separately approved explicit site build that publishes only intended assets. An `include` list alone is not an allowlist. Adding `.nojekyll` alone does not hide files and can expose them as raw static downloads.

**Alternative requiring an explicit decision:** approve all of `/docs` as additional public website content. Repository-publication approval did not make this website decision. Codex does not recommend exposing operating evidence and unreleased UI on the product site.

**Verification for an approved restriction:** generate the complete local site; check intended routes/assets survive and all excluded paths are absent from output. After a separately approved merge/publication, verify the actual deployed routes and exclusions. No Pages settings, configuration files or deployment workflows were changed here.

## Approval boundary

Mike can decide R8 and R9 independently. Approving either recommendation authorizes only the explicitly named follow-up work; the exact main merge remains a separate action. Private Evaluation, provider/model/data-use changes, migrations, deployments, TestFlight and App Store actions remain outside this packet. The [Codex review](2026-09-28-codex-capture-rereview.md) dispositions the remaining base findings and capture dependencies.
