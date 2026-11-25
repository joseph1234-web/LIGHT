# Church autoposter research and implementation

Reviewed November 25, 2026. Primary product documentation was used for features; vendor statements are descriptions, not independent reliability benchmarks. No pricing estimates are required for this update.

| Product or source | Useful pattern | Applied in ekklo. |
| --- | --- | --- |
| [Buffer Publish](https://buffer.com/publish) and [calendar guidance](https://support.buffer.com/en-us/articles/how-to-use-buffers-calendar-feature-FSSKbH32DN) | Recurring posting times, clear queue/calendar views, status filters and timezone context | Week navigation, date selection, list view, queue search, status filters and visible Asia/Manila times |
| [Later scheduler](https://later.com/social-media-scheduler/) and [automatic versus notification publishing](https://help.later.com/hc/en-us/articles/360043360553-Auto-Publish-vs-Notification-Publishing-How-to-Switch) | Visual planning, reusable media, and explicit publishing capability | Image thumbnails and readiness labels; real connection requirements instead of claiming every platform is automatically supported |
| [SocialPilot features](https://www.socialpilot.co/features) | Post previews, content libraries, repeated posts and approval workflows | Existing review safeguards retained; recurring Bible verse, Sunday invitation and Christmas series brought into the dashboard |
| [Church of England scheduling guide](https://www.churchofengland.org/resources/parishes/communications/digital-support-guides/social-media-strategy/guide-scheduling) | A simple weekly church rhythm, reusable designs and planning around church events | Church-first navigation, quick access to saved Canva templates and an overview of recurring messages |
| [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) | Real scheduled server invocations are distinct from page timers | Uses an independently linked cloud task; persists cloud receipts separately from page checks. A native Worker cron is a future hosting option, not falsely described as deployed |
| [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | GitHub Pages is static hosting | Source moved to GitHub while retaining the server that handles authentication, storage and publishing |

## Reliability changes

- Automatic queue filling no longer depends on Canva generation being enabled. Uploaded and built-in image paths can prepare independently.
- Cloud checks persist their own receipt, including when publishing is paused. Browser refreshes cannot forge scheduler health.
- Setup warnings identify the missing Facebook connection, paused publishing/preparation, and unfinished Canva setup.
- Preparation pause/resume is authenticated, scoped to the signed-in owner and protected against cross-origin writes.
- Cancelled schedules, provider job receipts, ambiguous uploads, and the existing 75-minute posting window remain protected. No expired backlog is sent automatically.
- An optional explicit Site-admin preparation request is account-bound, expires, applies once, and cannot override a later user pause.
- Original church photos and videos may be local and in the church language. Media rights, audio rights and approval are still required. Imported discovery clips retain their source checks.

## Design changes

The supplied cross-and-send mark, ekklo. wordmark and exact tagline define the new identity. A forest-green sidebar, light workspace and mint accents organize the dashboard. Subtle entrance, card-hover and floating-art animations respect reduced-motion preferences. The key daily tasks are scheduling, checking image readiness, seeing the authorized Page, and understanding whether the cloud runner has checked recently.

## Further improvements

These are research findings, not implemented promises: team drafting/approval roles, per-channel post variants, bulk scheduling with validation, a reusable church media bank, platform-confirmed engagement reporting, and a native hosted cron for tighter timing. Instagram and TikTok support must follow their actual account/API capabilities; a marketing tagline does not imply unsupported automatic delivery.
