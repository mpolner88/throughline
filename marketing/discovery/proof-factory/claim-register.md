# DISC-03 claim register

**Checked:** 2026-08-27. `verified` below means verified current repository/runtime evidence, not a published-content approval.

| ID | Claim | Status | Source | Checked | Allowed wording | Prohibited implication | Visual proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CLM-01 | Throughline turns a voice note into a structured note with summary and to-dos. | `verified` | `docs/PRODUCT.md`; `ios/Throughline/Views/HomeView.swift`; `ios/Throughline/Services/UploadClient.swift` | 2026-08-27 | "Turn a voice note into a structured note with a summary and to-dos." | Every recording is perfect, immediate, or error-free. | Current-build capture of one synthetic processed note. |
| CLM-02 | A signed-in owner can create an MCP token and let an agent read saved notes. | `verified` | `docs/CURRENT_STATE.md`; `docs/agent-connect.md`; `ios/Throughline/Views/SharedComponents.swift` | 2026-08-27 | "Your agent can read saved notes through Throughline's MCP connection." | Native integration with any named agent, automatic connection, or universal client support. | Redacted current-build connection state plus a real, inspected retrieval from a controlled synthetic note. |
| CLM-03 | Current MCP access is owner-scoped and read-only. | `verified` | `docs/CURRENT_STATE.md`; `docs/agent-connect.md` | 2026-08-27 | "Owner-scoped, read-only access." | The agent writes, completes tasks, takes actions, or sees anyone else's notes. | Capture copy plus read-only tool/result evidence, with all secrets redacted. |
| CLM-04 | Throughline is for personal voice capture rather than meeting recording. | `verified` | `docs/PRODUCT.md`; `marketing/voice-and-messaging.md` | 2026-08-27 | "For personal voice notes, not meeting recording." | It cannot ever be used around meetings or replaces every transcription tool. | Master's fictional individual planning scenario. |
| CLM-05 | The first loop can be stated as voice notes your agent can read. | `verified` | `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md`; CLM-01 to CLM-03 | 2026-08-27 | "Voice notes your agent can read." | The agent understands, remembers, or acts correctly without inspection. | Full current-build loop. |
| CLM-06 | Throughline is the fastest way to get voice to an AI agent. | `needs-verification` | `docs/superpowers/specs/2026-08-22-throughline-discovery-agent-system-design.md` | 2026-08-27 | Do not use in this kernel. | Comparative superiority, benchmark result, or category leadership. | None; requires comparative evidence and Mike approval. |
| CLM-07 | The current internal build proves public user outcomes. | `do-not-use` | `docs/CURRENT_STATE.md`; `marketing/discovery/_run/baseline.md` | 2026-08-27 | Do not use. | Public adoption, install, activation, or satisfaction. | None. |
| CLM-08 | Generated support media depicts the Throughline product. | `do-not-use` | `marketing/assets/production-pipeline.md`; this package | 2026-08-27 | Label any optional generated clip as contextual support; use no UI in it. | Real app behavior, real user activity, or a product screenshot. | No generated UI or terminal output permitted. |

## Review rule

Every on-screen sentence, narration line, caption, and CTA must map to a `verified` claim above. A claim without that mapping is a hard fail. The terms `fastest`, `best`, `only`, `native integration`, `writes`, `takes action`, `customer`, and `users love` are prohibited unless this register is updated with verified evidence and approval.
