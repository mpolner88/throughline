# App Store Product Page Portfolio

Checked: 2026-08-27. Apple supports up to three PPO treatments in one test and up to 70 custom product pages; PPO and custom pages have separate availability and review paths. Custom pages require review before visibility, can have unique URLs, and show metrics after five first-time downloads. See [Apple PPO](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/create-a-test) and [Apple custom product pages](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions).

## Default Page Recommendation

Audience: people who need to turn spoken plans into clear next actions.

Promise: `Speak a plan. Get clear to-dos.`

Proof sequence: record a synthetic safe plan; show structured note and actionable to-dos; show review/control; then show optional owner-controlled read-only agent connection as the differentiated second act.

Conversion action: campaign-linked App Store download.

Status: planned. Requires a current-build, synthetic-data proof review and Mike product/design approval before any default-page asset or metadata change.

## PPO Successor

Experiment ID: `DISC05-PPO-001`.

Control: original/default product page after reconciling the recorded `20260813-app-store-all-structured-todos-mcp-01` test. Do not overlap this successor with a running test.

Material variable: the screenshot-first-message only: `structured to-dos first` versus `agent-readable voice memory first`. Icon, locale, screenshot treatment count, caption style, price, and all remaining visual sequence remain held constant.

Primary metric: Apple PPO product-page conversion and confidence designation.

Quality guardrail: same-window aggregate first-time downloads to new `auth_succeeded`, then non-demo first value when cohorts and readiness allow; do not call it a matched conversion rate.

Data caveat: results appear only after five first-time downloads; Apple tests run up to 90 days and require review/approved assets before starting. No current PPO dashboard was inspected.

Stop rule: do not start while the recorded PPO is unresolved; stop/defer for an App Store rejection, product reliability incident, overlapping material page changes, privacy-threshold suppression, or no conclusive Apple result by the platform limit. Apply only if Apple marks the treatment better at at least 90% confidence and the quality guardrail is healthy.

Mike approval: required to select assets, submit the test, start the test, stop it, or apply a treatment.

## Custom Product Page Concepts

### CPP-A: Agent-Readable Voice Notes

Audience/query/source: agent builders arriving from a technical owned page or a named campaign link; `voice notes for AI agents` is a hypothesis, not validated search demand.

Promise: `Your voice notes, readable by your agent.`

Proof sequence: voice capture; structured note; redacted synthetic agent retrieval through owner-controlled read-only MCP; owner token/revocation control.

Promotional text: draft only, `Capture a thought by voice, turn it into a structured note, then let your chosen AI agent read saved context through an owner-controlled, read-only MCP connection.`

Keyword visibility choice: no search-keyword assignment in the first release; use only the unique CPP URL until query evidence exists.

Campaign destination: assign a future generated Apple CPP URL to `DISC05-CPP-A`; never invent one.

Downstream proxy: Apple first-time downloads, then same-window aggregate auth and non-demo first value; first MCP tool use is a coverage gap.

Control: default product page.

Material variable: agent/MCP proof sequence and promotional text for this distinct audience only.

Primary metric: Apple CPP first-time downloads and product-page conversion.

Data caveat: CPP metrics are unavailable until Apple reports at least five first-time downloads; current query and campaign data are unavailable.

Stop rule: do not create or submit without approved current-build synthetic proof, a distinct source, and a generated destination URL; disable/defer if the page produces no qualified evidence or misstates the product.

Mike approval: required for asset selection, CPP creation/submission, keyword visibility, destination use, and any linked distribution.

### CPP-B: Voice Plans To To-Dos

Audience/query/source: voice-to-task visitors from owned search, creator content, or a future exact Apple Ads group.

Promise: `Speak a plan. Get clear to-dos.`

Proof sequence: walking or planning capture; organized task list; note review; optional agent-readable context after task proof.

Promotional text: draft only, `Turn a spoken plan into a clear structured note and actionable to-dos without stopping to type.`

Keyword visibility choice: defer. Do not assign until App Store Search data shows an exact qualified term and it is distinct from CPP-A.

Campaign destination: assign a future generated Apple CPP URL to `DISC05-CPP-B`.

Downstream proxy: Apple first-time downloads and product-page conversion; same-window aggregate auth/first value is directional only.

Control: default product page.

Material variable: task-output proof sequence and promotional text for this distinct audience only.

Primary metric: Apple CPP first-time downloads and product-page conversion.

Data caveat: CPP metrics are unavailable until Apple reports at least five first-time downloads; current query and campaign data are unavailable.

Stop rule: do not create or submit without approved current-build synthetic proof, a distinct source, and a generated destination URL; disable/defer if the page produces no qualified evidence or misstates the product.

Mike approval: required for asset selection, CPP creation/submission, keyword visibility, destination use, and any linked distribution.

### CPP-C: Durable Voice Context

Audience/query/source: personal-knowledge users from a technical owned page. `MCP notes` and `voice memory` are unvalidated hypotheses.

Promise: `Keep spoken context useful after the moment.`

Proof sequence: capture; readable structured note; later agent retrieval; account and access controls.

Promotional text: draft only, `Turn spoken ideas into durable structured notes that stay readable to you and available to your chosen AI agent through a read-only connection.`

Keyword visibility choice: defer until query evidence and proof distinction justify it.

Campaign destination: assign a future generated Apple CPP URL to `DISC05-CPP-C`.

Downstream proxy: Apple first-time downloads, aggregate auth, and non-demo first value; no claim about retention until the mature-cohort floor is met.

Control: default product page.

Material variable: durable-context proof sequence and promotional text for this distinct audience only.

Primary metric: Apple CPP first-time downloads and product-page conversion.

Data caveat: CPP metrics are unavailable until Apple reports at least five first-time downloads; current query and campaign data are unavailable.

Stop rule: do not create or submit without approved current-build synthetic proof, a distinct source, and a generated destination URL; disable/defer if the page produces no qualified evidence or misstates the product.

Mike approval: required for asset selection, CPP creation/submission, keyword visibility, destination use, and any linked distribution.

All three CPPs require current-build proof, unique approved page assets, Apple review, and Mike approval. None was created, submitted, made visible, or linked.
