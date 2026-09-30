# Running List native review images

Recorded September 30, 2026 from the isolated Debug simulator build of app source `f86d04af6d46a784d3498d20e4b99cad80928804`. The current app tree and all 62 isolated iOS files match that revision. [Implementation receipt](../../2026-09-30-running-list-implementation.md); [review request](../../2026-09-30-running-list-review-request.md).

The 32 native PNGs cover all 31 filenames in the selected handoff's visual matrix plus the uncertain-Save state. Their point sizes and appearances are in their names. Pixel sizes follow each simulator's screen scale. The 375-point frames use iPhone SE (third generation), 390-point frames iPhone 13, and 430-point frames iPhone 15 Plus; runtime iOS 26.3.1. Maximum text uses the system accessibility-extra-extra-extra-large category, which is larger than the HTML approximation. All content is synthetic. No production account or real recording is shown.

`source.json` binds every frame to source and checksum; `SHA256SUMS.txt` verifies the PNGs. The immutable handoff reference assets are unchanged. These images are evidence for review, not a review pass.

## Evidence boundaries

- These are first viewports of real app views with synthetic DEBUG scenarios, not full scrolling pages. The expanded earlier-notes group, long rows and maximum-text screens continue below the viewport. Do not infer scroll reachability from a still image.
- Native menu and destructive confirmation use the runtime's system presentation. Source and editor keep their native sheets. The capture tray and recorder use their shipped source.
- The recording scene is a DEBUG fixture; it does not prove microphone permission, a real interruption or successful provider processing. Offline and editor failure scenes illustrate states; separate focused tests verify persistence and retry contracts.
- Thirty-two image files were locally recognized by Apple's on-device text recognizer. In particular, dark Today, Done and Notes retain their headings, task text and recorder labels in the saved pixels. An intermittent preview-display discrepancy omitted some text in the agent's image view; it is not evidence of a source defect. No colors or gestures were changed to compensate.
- Automated vertical drag also failed in the standard iOS Settings list. Its separate accessibility Scroll Down action worked. Running List vertical touch scrolling, long-row reachability, spoken VoiceOver and physical-device interaction remain unverified, clearly separate from the earlier successful horizontal completion, circle, menu and editor checks.
- Claude must review these images and source, record findings and decide whether any material presentation issue remains. This packet does not establish hosted deployment, TestFlight upload or owner acceptance.

## Frames

- [ax-light-375x667.png](ax-light-375x667.png)
- [ax-light-390x844.png](ax-light-390x844.png)
- [discard-light-390x844.png](discard-light-390x844.png)
- [done-dark-390x844.png](done-dark-390x844.png)
- [done-light-390x844.png](done-light-390x844.png)
- [earlier-light-390x844.png](earlier-light-390x844.png)
- [editor-conflict-light-390x844.png](editor-conflict-light-390x844.png)
- [editor-dark-390x844.png](editor-dark-390x844.png)
- [editor-light-390x844.png](editor-light-390x844.png)
- [editor-pending-light-390x844.png](editor-pending-light-390x844.png)
- [empty-later-light-390x844.png](empty-later-light-390x844.png)
- [empty-light-390x844.png](empty-light-390x844.png)
- [landed-light-390x844.png](landed-light-390x844.png)
- [later-light-390x844.png](later-light-390x844.png)
- [menu-dark-390x844.png](menu-dark-390x844.png)
- [menu-light-390x844.png](menu-light-390x844.png)
- [morning-light-390x844.png](morning-light-390x844.png)
- [moved-light-390x844.png](moved-light-390x844.png)
- [notes-dark-390x844.png](notes-dark-390x844.png)
- [notes-light-390x844.png](notes-light-390x844.png)
- [offline-light-390x844.png](offline-light-390x844.png)
- [recording-light-390x844.png](recording-light-390x844.png)
- [repeat-light-390x844.png](repeat-light-390x844.png)
- [source-light-390x844.png](source-light-390x844.png)
- [sunday-light-390x844.png](sunday-light-390x844.png)
- [sunday-week-light-390x844.png](sunday-week-light-390x844.png)
- [swipe-light-390x844.png](swipe-light-390x844.png)
- [today-dark-390x844.png](today-dark-390x844.png)
- [today-light-375x667.png](today-light-375x667.png)
- [today-light-390x844.png](today-light-390x844.png)
- [today-light-430x932.png](today-light-430x932.png)
- [week-light-390x844.png](week-light-390x844.png)
