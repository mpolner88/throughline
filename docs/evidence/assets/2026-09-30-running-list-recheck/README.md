# Running List correction screenshots

Verified September 30, 2026. Exact app source `a59d68ddf1bafdb0bfb8cc5fe31f605bb1d2e068`. These four native captures replace only the corresponding review views for the [narrow recheck](../../2026-09-30-running-list-recheck.md). The [original 32-frame packet](../2026-09-30-running-list/README.md) remains historical evidence of the initial implementation.

| Frame | Correction to inspect |
| --- | --- |
| [Week](week-light-390x844.png) | Tuesday's range is **Wed to Sun**. |
| [Moved task](moved-light-390x844.png) | Monday's range is **Tue to Sun**; **moved Tue** stays unchanged. |
| [Saturday](saturday-week-light-390x844.png) | The range is **Sun**. |
| [Offline](offline-light-390x844.png) | **Offline. Changes save when you're connected.** is above the date header, directly below the tabs. |

All content is synthetic, in the real Debug app on iPhone 13 / iOS 26.3.1, light appearance and standard large text. Dimensions are 390 x 844 points / 1170 x 2532 pixels. `source.json` binds images and changed source-file hashes to the app revision; `SHA256SUMS.txt` verifies the four PNGs. Local on-device text recognition checked the saved text as well as visual inspection.

These first viewports establish presentation only. The offline preview does not prove real network recovery. Physical scrolling, spoken VoiceOver, midnight/time-zone travel and hosted older-app behavior retain the original review's limits. No full matrix rerun or new design selection is claimed.
