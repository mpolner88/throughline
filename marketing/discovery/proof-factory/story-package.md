# DISC-03 story package

**Master:** `20260827-proof-agent-builders-voice-agent-01`
**Format:** 60-second, 9:16 master proof demo; silent-readable with captions.
**Status:** `planned`; no export exists.

## Default hook and controlled alternatives

Keep beats 2-8, proof, caption, CTA, length, and target audience unchanged. Select one hook only per experiment run.

| Hook ID | 0-3 seconds | Status |
| --- | --- | --- |
| H-01 default | "Your agent cannot use the plan you only said out loud." | Selected; CLM-05 framing. |
| H-02 | "A walk is where I plan the work I do when I get back." | Alternative opening only; no comparative claim. |
| H-03 | "Record the thought. Let your agent read the useful part later." | Alternative opening only; CLM-01 and CLM-05. |

## Master beat sheet

| Beat | Duration | Spoken line / caption | Claim ID | Inspectable visual | Transition reason |
| --- | ---: | --- | --- | --- | --- |
| 1 | 0:00-0:03 | H-01 default. | CLM-05 | Optional contextual support shot of a phone held with screen unreadable, or a title card. It is labeled support, never product UI. | Establishes the tension. |
| 2 | 0:03-0:10 | "On the way back, I say the plan once." Caption: "Synthetic demo data." | CLM-01 | Current-build recorder capture begins. The displayed script is synthetic and fully visible in `production-plan.md`. | Moves from tension to action. |
| 3 | 0:10-0:20 | "Throughline turns it into a structured note." | CLM-01 | Current-build processed result: title, one summary, three to-dos. No transcript, notifications, account details, or identifiers. | Shows the immediate human benefit. |
| 4 | 0:20-0:30 | "The note stays readable when I am back at my desk." | CLM-01 | Current-build note detail with the same synthetic title and to-dos. | Holds continuity before the technical proof. |
| 5 | 0:30-0:43 | "Then my agent can read the saved note through a read-only connection." | CLM-02, CLM-03 | A controlled, real retrieval in a local agent client shows a question about the synthetic plan and a response limited to its three known to-dos. The credential line, endpoint, account identity, tool metadata, and any surrounding history are cropped or redacted. | Delivers the differentiated proof. |
| 6 | 0:43-0:51 | "The agent reads it. It does not write back." | CLM-03 | Static read-only boundary card created locally, not generated; no product UI simulated. | Makes the trust boundary explicit. |
| 7 | 0:51-0:57 | "Voice notes your agent can read." | CLM-05 | Three inspected current-build frames: record, structured note, agent retrieval. | Compresses the proof loop. |
| 8 | 0:57-1:00 | "See the workflow in Throughline." | CLM-05 | CTA slate with a named campaign URL only after DISC-05 supplies and validates it. Until then: `CTA destination pending`. | Keeps action traceable. |

## On-screen and caption rules

- Captions retain the exact approved lines above; no transcript overlay is used.
- Use a plain 0.5px border, restrained monochrome, and sparse electric blue `#2563EB` according to `throughline-brand-decisions.md`.
- No simulated chat interface, fake app view, fake testimonial, stock user claim, or copied creator format is permitted.
- Any generated support visual receives a visible `Contextual visual` label in the asset passport and is separated from current-build footage.
