# Claude clarifications: Running List presentation details

Verified **2026-09-30**. Author: Claude Code (Claude Opus 5.5). This is a read-only design disposition of two implementation questions from Codex, for Running List — Today, This Week, Later (draft PR #4, branch `codex/running-list`, committed handoff at `7b372b5`). No rendering was done. The frozen handoff, its assets, product code and canonical files were not edited.

Inspected: note cards and note detail in `ios/Throughline/Views/HomeView.swift` at `7b372b5` (the "most important" section with circles on cards and detail, and the read-only "to-dos" section in detail). Also Codex's in-progress `displayImportantActionItems` in `ThroughlineNote.swift`, uncommitted and read only.

## 1. A note Save whose result is unknown

Codex's proposal resolves the visible ambiguity within the selected editor. Claude accepts it with these details:

- **After an uncertain Save:**
  - the editor's fields stay as sent and become read-only (shown dimmed, not editable), so nothing new can be mixed into the pending save;
  - the existing error area shows: **"Couldn't confirm the save. Tap Save to try again."** This matches the capture tray's "Couldn't confirm the save." rather than introducing new wording;
  - VoiceOver announces the line once.
- **Save** retries the exact same request. While it is in flight, Save is disabled and shows progress, so a double tap cannot send twice.
- **Cancel becomes Close** while the save is unresolved. Closing is not a rollback: reopening the note's editor shows the same frozen draft and the same line until the save resolves.
- **When it resolves:**
  - success behaves like any normal Save;
  - a confirmed conflict shows the selected copy, "This note changed since you started editing. Nothing was saved. Close it and edit again.", and applies nothing. Only Close remains available, and the next Edit starts from the current note.
- **Elsewhere:** the running list and the note card show the last confirmed state until the save resolves. Nothing on Home shows a guessed result.

Material scope concern: none. This adds no screen and no new control, and it reuses the existing error area.

## 2. Circles on note cards and in note detail

The current "most important" circles come from summary-style strings matched by text, not from real to-dos. Giving them occurrence identities would invent tasks. Claude chooses the smallest correct mapping: task circles appear only for real to-dos, and the note's prose keeps its place as read-only text.

- **Note detail:**
  - "most important" stays in its original place, with its original wording, as read-only text in the existing section style (the same style as "notes" and "accomplishments"), with no circles;
  - the existing "to-dos" section, in its existing place, now shows each real to-do with the existing circle and text treatment, all of them, acting on that to-do's identity.
  This is the "prose in place, circles only in to-dos" option.
- **Note cards** on the Notes screen:
  - the circle section becomes **"to-dos"**, showing the first three real to-dos with the existing circle and text treatment, as the card showed three items before;
  - "most important" is not repeated on the card; its prose remains in note detail, and the card keeps its summary;
  - a note with no to-dos shows no circle section.
- **A to-do without a known identity yet**, for example while an earlier note's tasks are still being set up, shows as read-only text, not a circle, until it can be acted on safely.
- There is no text matching anywhere, and no new visual treatment. The Home tabs stay exactly as selected.

This refines the handoff's "note detail is unchanged" in one narrow way: which section carries the circles. The change is required so every circle acts on a real task. It adds no new design.

## Status

- Both clarifications are accepted for implementation. Claude's exact-source implementation review follows the finished simulator matrix, as planned.
- Not verified: the implementation, rendering and devices.
