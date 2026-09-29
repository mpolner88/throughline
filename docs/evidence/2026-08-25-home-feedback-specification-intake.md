# Home feedback specification intake

**Verified:** 2026-08-25 15:37 Pacific  
**Source:** one new private screenshot feedback submission from the existing internal TestFlight group  
**Build observed:** `2026082401`  
**Scope:** evidence intake and specification only; no product code, service, or release state changed

## Outcome

The private feedback poll found two total submissions: one previously ingested item and one new item. The new screenshot was inspected privately and decomposed into six bounded product parts:

1. carryover language and eligibility;
2. time-horizon task navigation;
3. home access to agent connection;
4. the organizing principle for the top task section;
5. task-card information hierarchy; and
6. task completion, editing, and deletion interactions.

The source submission is evidence for these candidate specifications, not proof that any proposed design will improve user outcomes. No implementation or internal TestFlight delivery occurred in this intake.

## Privacy boundary

The screenshot, tester comment, Apple feedback identifier, local intake reference, and note or task content remain in the ignored private inbox. They are not reproduced in this record, the specifications, analytics, fixtures, commits, or release manifests.

## Current behavior confirmed from source

- Home labels a newest-first sample of extracted to-dos as `Most important`; it does not currently rank those rows by importance.
- The carryover section aggregates `tomorrow_todos` strings without proving that an item is unfinished or from the immediately preceding night.
- The settings gear leads to account, privacy, feedback, and agent-access controls; agent connection is already nested inside Settings.
- A task can be completed from its circle or a right swipe. There is no task-specific edit destination or task-specific delete mutation.
- The client and server currently use recording plus normalized task text for completion changes, which is ambiguous for duplicate task text.

These findings were verified on 2026-08-25 against the current dirty checkout. They are source-level facts only and do not establish shipped App Store behavior beyond the observed internal build.
