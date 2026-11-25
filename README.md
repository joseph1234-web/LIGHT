# ekklo.

**ONE CHURCH. EVERY PLATFORM.**

A church publishing workspace for Bible verses, Sunday invitations, Christmas countdowns, events, and approved church photos and videos. Uses React, Vinext, Cloudflare Workers, D1, and R2. The existing hosted application and account data stay in place; this repository contains the editable source.

## Edit your website

| What you want to change | File |
| --- | --- |
| Main dashboard, calendar, search and filters | `app/components/church-dashboard.tsx` |
| Colors, spacing, responsive layout and animations | `app/ekklo.css` |
| Navigation and media composer | `app/page.tsx` |
| Browser title and description | `app/layout.tsx` |
| Your supplied logo | `public/ekklo-mark.png` |
| Church planner | `app/components/church-planner.tsx` |
| Background queue and cloud check receipts | `lib/church/automation-worker.ts` |
| Scheduling and Facebook delivery | `lib/church/server.ts` |

Open a file in GitHub and use Edit, or clone the repository in your editor. A GitHub commit saves source; making it live also requires a deployment to the current server host. The repository is not automatically linked to production deployment. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Run and verify

Use Node.js 24. Install the locked dependencies with `npm run install:ci`. Then run:

```sh
npx tsc --noEmit
node tests/integration.mjs
npm run build
```

`npm run dev` starts a local preview. Real authentication and production D1/R2 bindings require the hosted runtime; a local unauthenticated preview cannot access production records. Integration tests use an isolated SQLite database and simulated provider responses, and never send real posts.

## Publishing while you are offline

The linked cloud task checks the exact enrolled church account every hour. It does not need an open browser or an online phone. Saved settings, an authorized Facebook Page, a prepared image, and the posting window must all be ready. Delivery happens on the next successful check after the saved time; it is not a minute-exact service.

The original connected church account and Canva templates are retained. Queue filling can prepare seven days ahead independently of Canva. A disconnected Canva account or unfinished image is displayed as a blocker rather than silently replaced. The dashboard distinguishes verified cloud checks from page refreshes and flags checks older than 90 minutes. It never treats an old runner verification timestamp as proof that the recurring task is currently running.

See [SCHEDULED_PUBLISHING.md](SCHEDULED_PUBLISHING.md), [RESEARCH.md](RESEARCH.md), and [CANVA_AUTOMATION.md](CANVA_AUTOMATION.md). Keep production credentials in runtime settings, never in this public repository. Do not overwrite the existing encryption key or copy private database/media contents into GitHub.

## Existing platform capabilities

## What works immediately

Draft creation/editing, PNG/JPG picture uploads (10 MB; normalized to PNG) and MP4 uploads (25 MB; square or portrait; 3–180 seconds), editable caption templates, provenance and audio-rights records, draft approval, media/caption exports, persistent preferences, and activity history. No demo posts or invented analytics are seeded.

## Live services that require the owner's account setup

- YouTube: Google Web OAuth credentials and user authorization. Uploads use resumable media transfer and poll video processing. Set visibility and audience for each post.
- Facebook: reviewed Meta business app and Page permissions. The user selects the authorized Page. Reels use official uploads and platform processing checks.
- Instagram: direct professional account login using the separate Instagram app settings, or a Page-linked professional account through Facebook, with content publishing authorization. The exact approved media must also be hosted at a public HTTPS URL retrievable by Meta; this private studio's media URLs cannot be used for platform URL pulls.
- Discovery: YouTube Data API key. Searches Creative Commons-labeled short candidates by view count, then verifies declared English audio and matching foreign creator-country metadata. Philippine, unknown, non-English, and mismatched sources are excluded. A CC label is not an automated rights clearance.
- TikTok: video and caption export, followed by manual completion in TikTok. This personal studio does not assume approval for TikTok's Direct Post API or copy arbitrary third-party videos.
- Background posting: install/connect the Site's private plugin, verify the runner through its intended cloud path, and create a linked recurring queue-check task. Read SCHEDULED_PUBLISHING.md. Without that task, queue checks must be invoked manually; a browser timer does not provide unattended posting.

Configure secret key names shown in .env.example using Site environment settings. The production encryption key is generated during initial setup; never overwrite an existing key with connected accounts unless performing a deliberate token migration. No social API credentials have been supplied or invented.

## Integrity

Every request uses Site-scoped authenticated identity. Credentials are AES-GCM encrypted and are omitted from the browser. Queue payloads are reviewed snapshots. User-scoped locking, atomic claims, a per-draft/platform unique constraint, and repeated-video detection guard against duplicate delivery. Interrupted uploads require review rather than blind retries. A publish status is shown only after platform confirmation. Manual TikTok reports are labeled separately.

## Check and build

`node tests/integration.mjs` exercises real SQLite schema/migrations and mocked external API contracts without sending posts. `npx tsc --noEmit` checks types. Use the Sites build helper for production. See the retained starter README in the Sites skill for runtime operations.

## Facebook church planner

The Church content section adds daily scripture image posts, Saturday announcements for the following Sunday, a Christmas countdown, custom event countdowns, three saved Canva design links, and an editable image/caption queue. Images are generated as real 1080 × 1350 PNGs without an external AI key. Scripture comes from the public-domain World English Bible Classic, with source links stored in the included collection. Each post is owner-scoped and deduplicated by series/event/date. Configure the church name, location and service time before enabling Saturday posts. Automatic Page publishing requires the existing Meta setup, an authorized Page, and the church planner's separate publishing switch.

The linked hourly cloud task uses the same private publishing runner. Templates and fonts are retained in source or private storage as appropriate. Font licensing is provided under public/licenses/dejavu-fonts.txt. No production Facebook photo is sent during testing.

The flattened image gallery has been removed from the deployed Site. The owner's three Canva links are assigned to the daily verse, Saturday Sunday-service invitation, and Christmas countdown series; the assignments can be changed in Canva links. Existing image-template records are archived per owner outside schema migrations. Unstarted posts are prepared using their chosen Canva source. A requested Canva image never falls back to the built-in renderer.

The connected Canva app performs template inspection, autofill, and PNG export as part of the publishing workflow. ekklo. exposes `church_canva_jobs` with exact text/date/countdown values and `church_canva_render` for atomic claims, confirmed design/export job checkpoints, and verified PNG attachment. Each image is bound to one owner, post revision, and source template. Expired or changed requests cannot attach images, duplicate completions are idempotent, and uncertain Canva creation/export operations must be inspected rather than repeated. The saved Canva source is preserved; generation should create a separate output design. Actual template fields and Canva access must be verified using the provider before live use.

A complete exported Canva image and its caption can publish only after automatic church publishing is enabled and the Facebook Page matches the saved Page. Completed images survive pause/resume. Canva connection, editable template fields (or supported autofill capability), and Facebook app setup/authorization remain prerequisites. New visitors without a Canva selection can still use the original built-in renderer.

## Account and automation controls

Connections provides direct links to facebook.com, instagram.com and youtube.com for login, followed by a separate Allow ekklo. to publish action using official authorization redirects, cancellation/error notices, explicit Page/channel selection, reconnect/switch, individual disconnect, disconnect all, and ekklo. sign out. Missing app configuration returns a clear setup notice without simulating account authorization. Provider consent is mandatory; passwords are entered only on the provider. OAuth states are owner-scoped, expire after 10 minutes, and are consumed once. Pending Page/channel tokens remain encrypted.

The Autopilot screen independently enables pictures and videos, with up to four whole-hour slots and connected destinations. Enabling one type from a paused state does not enable the other. Only already approved drafts are selected, once per type per daily slot. Pictures publish to Facebook/Instagram; YouTube is video only. Instagram still needs a separately hosted public HTTPS copy of the exact approved media. Church image automation stays in its own planner; its three buttons save immediately and require the authorized Facebook Page. Saturday invitations always target the following Sunday.

Disconnecting or switching destinations pauses affected deliveries and media automation. Facebook changes also pause church publishing. Uploads whose outcome is uncertain remain in review, including across planner changes. Every new delivery records its intended social account; older jobs without that target must be reviewed. Expired posts are skipped after 75 minutes, with no backfill.
