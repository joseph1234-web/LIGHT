# Automatic church images with Canva

The church planner can generate a separate Canva design for each enabled saved
series, export one PNG page, and check confirmed provider results automatically. It does
not change the source design or use a built-in image as a replacement.

## One-time setup

1. Create a Canva developer app with REST APIs enabled. Configure the scopes
   `design:meta:read`, `design:content:read`, and `design:content:write`.
2. Register the exact `/api/canva/callback` URL displayed in the Site's Canva
   settings. Save the app Client ID and secret in that private form, then use
   **Connect Canva** to authorize the account. The ChatGPT Canva connection is
   separate from this website authorization.

   **Connect Canva** uses a normal top-level navigation to `/api/canva/start`.
   An expired Site session can complete sign-in before a new Canva authorization
   starts. The form APIs accept JSON; HTML/sign-in and temporary server responses
   produce a clear recovery notice instead of a JSON parser error. No failed
   action is automatically replayed. Refresh the current status before retrying.
   Callback failures retain a safe, owner-scoped result under **Connection
   details** and `studio_status.canvaAutomation.lastAuthorizationResult`. It
   identifies the failed step, response status and provider error code without
   storing or returning sign-in codes, state, verifiers, credentials, raw
   provider responses or exception messages. Provider redirects are not
   followed. HTML and malformed JSON at the token or user endpoint produce a
   specific error. The callback remains single-use even after a failed exchange.
3. Open each saved design in Canva. Label all changing text with the canonical
   labels shown for its series using **Apps → Bulk Create → Labels**. A plan
   that supports Autofill is required. Choose the correct single page in the
   Site and use **Check template**. Missing or unrecognized text fields block
   generation. The Site never silently changes the saved source selection.

   Current templates require only the labels already prepared by the owner:

   | Series | Required labels | Optional when a template is updated |
   | --- | --- | --- |
   | Daily Bible verse | `verseCardText` | `churchName` is accepted but cleared |
   | Sunday invitation | `sundayDate`, `serviceTime`, `location`, `churchName`, `serviceMessage` | `date` / `postDate`, `verseBlock` |
   | Christmas countdown | `daysRemaining`, `verseBlock` | `heading`, `countdownText` |

   `verseBlock` and `verseCardText` are interchangeable for these three series;
   separate `verse` and `reference` text labels also satisfy a combined verse
   block. Both contain the exact verse and book/chapter/verse reference, with no
   Bible version. Daily date, heading and church name fields remain blank in
   the image. The full verse and reference remain in saved captions. Bible version names are omitted.

   Extra recognized labels are filled only when present. Optional labels never
   appear as missing requirements. `daysRemaining` is a number; optional
   `countdownText` is the wording without that number. Sunday `date` means the
   posting date and `sundayDate` means the following service Sunday. Special-event
   requirements are unchanged. Existing richer templates remain compatible.

   Automatic renders capture their text labels before the one-time create.
   Automatic validation uses those captured labels, or the matching checked template,
   and falls back to the series minimum for an unchecked manual template. This
   keeps a five-field invitation's Bible verse available in the caption without
   requiring it in the PNG. Existing confirmed render IDs are never recreated.

   Image policy version 3 updates only current/future, unstarted drafts for these
   three series. Existing claimed or confirmed Canva renders are held for review;
   captions, expired posts and started/completed Facebook deliveries are preserved.

   Choose **Page order → Rotate all pages: 1 → last → 1** to cycle through the
   saved design. Every page needs the same supported changing-text labels. A
   checked single-page choice is also supported. The planner accepts an explicit
   working-copy URL without changing an existing selection automatically.
4. Enable automatic Canva generation. An active linked background task calls
   `run_publishing_queue`; **Run queue now** performs an explicit on-demand run.
   The existing task's paused/enabled setting is independent and preserved.

Official references:
- https://www.canva.com/help/autofill/
- https://www.canva.dev/docs/apps/rest-apis/authentication/
- https://www.canva.dev/docs/apps/rest-apis/reference/autofills/create-design-autofill-job/
- https://www.canva.dev/docs/apps/rest-apis/reference/exports/create-design-export-job/

## Page rotation and daily image format

Rotation state is durable in `canva_page_rotations`, scoped to the studio, series,
event and exact source URL. A D1 batch reserves the page in the claimed render
and advances its cursor together. Repeated checks or resumes retain that page;
confirmed rollback advances neither. The last page wraps to 1. New source URLs
start independent cycles. A later page-order choice applies to new renders;
confirmed output/export jobs continue with their saved page.

Daily pending renders adopt the caption-only date/version format without
changing captions. Older claimed or confirmed Canva renders are held for review;
published, uncertain and expired deliveries are preserved. No ambiguous create,
export or photo upload is replayed to apply the layout change.

The setup panel shows the authenticated ekklo. email. Developer app keys,
Canva tokens and template bindings remain isolated per signed-in profile.

## Generation and recovery

`lib/church/canva-automation.ts` uses Canva's `create_from_design` mode and an
explicit `pages: [page]` PNG export. It inspects the exact saved source and its
dataset before claiming a post. An updated source needs another template check.
Two jobs can advance per queue run. Manually saving a custom or daily schedule
also starts preparation for those exact post IDs, without filling unrelated dates.
The generation switch and saved connection still apply. A preparation failure
never rolls back a successfully saved schedule.

Before either create or export, the render records a durable start marker.
Confirmed autofill, design and export IDs are checkpointed immediately. Reads
resume only those IDs. An uncertain create/export without a confirmed job ID
stays pending for review. Refresh tokens use a durable one-use claim as well;
an interrupted rotation requires reconnection rather than replay.

Direct-API renders no longer require an owner review click. Before the one-time
create, the render stores a hash of the exact source, source revision, connected
Canva account, assigned page, and autofill text. Completion verifies that hash,
rechecks the source fields/revision, confirms the original autofill job produced
the saved separate output design, and compares the output's update time and page
count against the provider result. It then downloads exactly one confirmed PNG,
validates its format/size, and stores it with an atomic owner/render snapshot
check. It records `verifiedBy=canva_autofill` and retains all provider IDs.

Existing direct-API jobs can pass these checks without recreating anything when
their captured source, field labels, autofill, design and export IDs are complete.
Uncertain or changed results remain held. This is provider and input validation,
not a claim that a person visually inspected the layout. Owner-uploaded PNGs and
external agent-created renders keep their existing content/right confirmations.

Facebook delivery still requires the saved series and church publishing to be
enabled, matching saved and authorized Page IDs, and the current posting window.
Expired posts, uncertain uploads, and completed deliveries are never restarted.
Video approval/copyright rules and TikTok manual export remain unchanged.

## Validation limits

Integration tests mock all provider writes, exercise OAuth/PKCE and encrypted
tokens, exact fields and source, export selection, durable checkpoints, missing
fields, interruption recovery, owner isolation and posting guards. They do not
prove live Canva authorization, account entitlements or template layout. Those
require the owner's app setup and inspecting a real exported PNG.

## Custom dates and minute times

Recurring church and media posting times accept `HH:mm`. In Prepared posts,
**Custom schedule** chooses a series, local date, hour and minute in the saved
planner timezone. It creates or updates that series' one post for the date;
**Change time** keeps the post's existing date, caption, PNG and render identity.
Saturday invitations remain Saturday-only for the following Sunday. Countdown
dates remain inside the saved series/event period. Series preparation must be
enabled, and auto-publishing remains a separate switch.

The `church/schedule` writer rejects past target times, expired existing posts,
started deliveries and in-progress renders. Concurrent changes cannot restart
those records. Custom times survive later planner regeneration. Queue runs
select only posts that are due and inside the existing 75-minute window,
including a valid window that crosses local midnight. They never publish early
or backfill expired posts. Canva source, Page, approval and copyright checks
remain in force.

The linked cloud task is hourly and its paused state is preserved. A minute
value is a requested due time, not a promise of exact-minute delivery. The UI
explains that an active task delivers on the first eligible check after that
time. This update does not create, resume or increase the frequency of tasks.

## Rescheduling cancelled church drafts

Cancelled posts are never revived by Prepare 7 days or a background queue run.
An eligible card now exposes **Reschedule**. Custom schedule also recognizes a
cancelled post for its chosen series/date and explains the restore before Save.
The writer requires explicit `restoreCancelled: true` and a future target time.
Only unexpired posts without any social upload/claim/remote ID can be restored.
In-progress, ambiguous, review-origin or expired records remain blocked. New
cancellations record their previous status and use a conditional update so a
racing upload cannot be overwritten as cancelled.

Restoration reuses the same post row. Untouched image work uses the current
planner and keeps user-edited captions; an unchanged verified PNG and its Canva
IDs remain attached. A changed verified template/image needs review rather than
a replacement create. Compare-and-swap checks the complete prior payload, image
key and status, preventing simultaneous restores or provider checkpoints from
being overwritten. Auto-publishing and series switches stay under user control.

## Removing pending schedules and uploads

Prepared posts has **Delete** on every unpublished card, including cancelled,
Needs review, pending Canva, uploading, and confirming records. **Clear pending
schedules & uploads** applies the same operation to all pending church posts.
Published posts are preserved. Both operations are scoped to the signed-in owner.

Pristine drafts are deleted only after a private owner-scoped R2 snapshot is saved.
Started or uncertain uploads and Canva renders move to the terminal `removed`
state. They disappear from the active planner and are available under **Removed
history**, with their original claims, provider IDs and PNG keys retained.
Removal never sends a provider request or removes an already-published social
post. An active publisher must finish before a removal can acquire its lock.

**Undo removal** restores the latest snapshot without replacing a new schedule.
**Restore for review** in Removed history returns an individual record as
`needs_review`; it cannot restart a render or delivery. A removed social upload still blocks another delivery for the same series/date.
A removed Canva-only render can receive an explicitly confirmed new schedule.
The old render remains stopped in history. The new post reuses an exact unchanged
verified PNG when available; otherwise it requires an owner-verified PNG and
automatic Canva tools cannot create a replacement for that ambiguous render.

Late provider responses may checkpoint confirmed design, export or upload IDs
into Removed history, but cannot return the item to the active queue. A removed
render cannot claim, generate, complete, export again, or publish. Conditional
writes prevent a racing caption edit from restoring a removed record.

Removal sets `manualQueue` so background checks and settings saves cannot refill
the cleared dates. Custom schedule still creates one requested post. Only the
explicit Prepare 7 days action resumes automatic preparation. Existing publishing,
series switches, video approvals, copyright checks and manual TikTok exports are
unchanged. Repeating Clear on an empty queue preserves the latest Undo receipt.

The `church_clear_pending` MCP action requires an expected verified account email,
compares it to the authenticated Sites header, and refuses another profile. It
never accepts an owner ID from a caller. `studio_status` returns the verified
current account email for checking the intended profile before any clear.

## Daily dates and image readiness

Prepared posts lists today's and tomorrow's daily verse status separately from
image readiness. **Schedule today & tomorrow** saves one or two explicit dates
with hours and minutes, using the saved timezone. The form displays the verified
account email and the server rejects a mismatching intended account. It can
explicitly enable daily preparation and optionally change the recurring time; it
never enables publishing or starts Canva/social uploads. Results are per date,
so a past first date does not falsely report success or prevent the future date.

A `scheduleDaily` date and `scheduleTime` query prefill the review form;
`expectedAccount` prevents a prepared link from applying in another profile.
Opening a link does not save anything. The signed-in visitor submits the form.

The church uniqueness index applies only to active (non-removed) records.
Preparation skips all removed dates; only explicit scheduling may create a new
post for a removed Canva-only date. Old IDs, render claims and export jobs remain
on the original history row. Undo/Restore cannot overwrite its new active post.
Every social-attempt guard still blocks an ambiguous or confirmed duplicate.

Queue cards show **Schedule saved**, **Draft saved**, or **Window passed**
independently of their PNG state. A preview without a verified PNG no longer
implies that a connected Canva account needs to reconnect.

## Export checks and unattended church processing

The signed-in Church planner checks `POST /api/canva/advance` every 15 seconds
while visible. Checks run independently of unsaved local planner edits and refresh
queue data without discarding those edits. The endpoint acquires the same owner
runner lock as publishing. With `publishReady=true`, page checks advance images
and publish only ready, due church posts under the saved publishing switches.
Calls without that flag prepare images only. Confirmed export IDs are polled
until success; `awaiting_verification` is an automatic validation stage, not a
manual approval queue. Ambiguous create/export markers
are still held and never replayed. Progress retains provider status and check time.

The scoped `church_background_run` tool is restricted to the verified email in
`CHURCH_AUTOMATION_OWNER_EMAIL`. It resolves `expectedAccountEmail` only through
identity captured from that visitor's trusted Sites headers, never a caller's
owner ID. Browser-supplied identity fields are ignored. The tool processes only
that account's enabled settings and stored OAuth connections. It returns counters
and status, never private posts, credentials or claims. An unknown target waits
for an authenticated account visit instead of falling back to the operator's
profile. `publishVerified=false` advances images only; `true` also uses existing
church Page/series/publishing/window guards. Video queues are never processed.

The existing linked cloud task can call this tool for the intended account at its
saved hourly cadence. Pause state must be visible in the actual task settings;
page refresh is not an unattended scheduler. Keep normal checks, unchanged missing
setup and intentionally paused account switches quiet. No routine run republishes
the Site. Verify the native tool after deployment before enabling a repaired task.

## Uploaded Christmas countdown pack

`public/christmas-countdown/v2` contains the 52 reuploaded PNGs from
Canva design 1 (1).zip, including three separately supplied corrections. Their
original source names and hashes are recorded in `christmas-pack-manifest.json`.
All 50 countdown days and Christmas Day have a verified exact-number match.
The 23-day and 26-day corrections explicitly show 2026 and are held for other
years. There is no generated or unrelated fallback. Verses remain in captions.

The target verified email in `CHRISTMAS_PACK_DEFAULT_EMAIL` adopts this pack on
its next authenticated church visit. Other accounts keep their source until they
explicitly choose the uploaded pack. Daily Bible/Sunday Canva links are preserved.
Eligible unstarted Christmas posts switch to the matching uploaded PNG, retaining
old Canva IDs under `retiredCanva`. Started social uploads and expired posts do
not switch. Late confirmed Canva IDs can checkpoint into that history but cannot
restart it. PNG delivery uses the Workers ASSETS binding, verifies its source
hash, and caches the exact PNG privately in R2. A missing or altered asset blocks
delivery. Updating this pack requires a new version and an inspected mapping.

## Bible versions and caption labels

The planner offers World English Bible Classic (WEB), King James Version (KJV)
and Berean Standard Bible (BSB). Each version includes the same 39 curated verse
references; a daily rotation uses the existing first 34, with seasonal selections
for Christmas. Choice changes the actual verse text, with its source retained in
the saved specification. Unknown versions are rejected, never relabelled as WEB.
The default remains WEB. A changed selection follows the existing planner-change
rules: untouched drafts need regeneration and confirmed renders stay for review.

KJV text was retrieved from the exact chapter links recorded in `translations/kjv.json`.
KJV is public domain outside the UK; territorial UK print rights are disclosed in
the selected source link. BSB text was extracted verbatim from the publisher's
https://bereanbible.com/bsb.txt (current third printing); its public-domain dedication
is at https://berean.bible/terms.htm. Dataset source references remain internal.
The paragraph symbol used for KJV typesetting is omitted from verse text.

Generated captions show the verse and reference without translation names.
A one-time owner-scoped policy removes only known generated translation suffixes
beside the stored verse reference on current/future unstarted posts. Captions,
claims and image IDs of published, expired, removed and started deliveries stay
unchanged. Caption-only cleanup never starts a Canva render or invalidates a PNG.

## Monthly morning inspiration and scheduling removed dates

Daily scripture is chosen from the sourced WEB/KJV/BSB collection with a focus
for each month. A themed set is interleaved with encouragement, retaining at
least 31 distinct references per month. November focuses on gratitude; December
on Christmas hope, joy and peace. A morning encouragement and monthly focus
appear in the caption. Daily images still contain only exact verse text and
reference, with no date, church name or version label. Personal caption edits
are preserved. For confirmed Canva designs, the existing verse and provider IDs
remain intact while only the surrounding generated caption adopts the theme.
Published, removed, expired and started social deliveries are never rewritten.

Prepared posts now exposes individual Today/Tomorrow actions plus date cards
for the next missing Christmas and Saturday invitation slots. Removed dates
require an explicit new-schedule checkbox. A Christmas replacement can use the
uploaded PNG pack even when its stopped predecessor used Canva; no predecessor
claim, design, export or photo upload is restarted. An elapsed posting time
suggests a future time in the saved timezone, and the owner confirms that time
when saving. Sunday invitations remain Saturday-only for the following Sunday.

An existing confirmed Canva PNG awaiting automatic validation may change its
posting time on the same date. Its content, render, claim, design and export IDs
stay unchanged. A conditional write prevents racing checkpoints or deletions
from being overwritten. The action never approves the image or publishes it.
In-progress or ambiguous creation/exports and all prior social attempts remain
blocked. A blocked second daily date no longer prevents saving the eligible
first date; the API reports each date separately.

## Connected destinations

One authorized Facebook Page is sufficient for church images; Instagram, YouTube
and TikTok connections are not prerequisites. General-media manual scheduling
queues only the selected connected destinations, reports disconnected choices
as skipped, and leaves the approved draft unchanged. Automatic media filling
also intersects selected destinations with the saved allowed channels. Rights,
video approval, target-account snapshots, duplicate guards and TikTok manual
export remain enforced. No disconnected delivery is fabricated.

Caption policy v2 keeps monthly verse selection and morning encouragement, but
omits the visible month/theme heading (for example, “November · Gratitude and
thanksgiving”). Current and future safe pending captions adopt this format;
custom captions retain their wording with only that exact generated line removed.
Expired or already-started social deliveries are preserved.

An explicit replacement of a removed, unstarted Canva post may generate a fresh
image normally. A claim, assigned page, started phase, confirmed provider ID,
uncertainty marker or social attempt in its history still prevents replay.

## Explicit schedule restart and the main queue

`church_restart_schedule` uses the same verified Site operator and enrolled-email
lookup as the background runner. A required stable `requestId` makes a retry
return the completed receipt without another reset. A per-owner lock and private
backup precede the atomic queue/rotation change. Pending records move to Removed
history with provider IDs intact; published and uncertain social deliveries are
not recreated. Unknown Canva create/export results block their dates. Confirmed
provider jobs are retired untouched; an explicitly requested new cycle gets new
render IDs and never replays a prior request. Checked sources retain their IDs
and fields while rotation resets to page 1. Seven days of saved enabled series
start today, preserving a future custom time for today or suggesting a future
time if its recurring slot passed. Generation and publishing switches stay as
saved. This operation creates schedules, not social posts or Canva requests.

The main Publishing queue receives a separate owner-scoped `churchJobs` view so
church PNG preparation is visible alongside regular media jobs. Removed records
stay in church history. Church cards link to their own manager and never use the
regular-media cancel or video-publishing endpoints.

When a chat has not refreshed a newly published reset tool, native Site
administration may enqueue `CHURCH_SCHEDULE_RESET_REQUEST` as a private runtime
JSON value containing `action: restart_from_today`, the exact
`expectedAccountEmail`, a stable `requestId`, and an `expiresAt` timestamp. The
existing background tool consumes this request only after its normal configured
operator and enrolled-account checks. Client bodies cannot supply it. The stored
reset receipt makes repetition inert, and expiry prevents stale commands. Remove
the runtime request after verified completion and deploy that environment revision.

Before claiming a pending render, ekklo. inspects its exact saved source again.
If the same design has a new revision and still exposes the required supported
fields, its checked binding refreshes atomically and that new render captures
the fresh source/input fingerprint. A different resolved design or missing fields
stays pending with an explicit setup message. Started renders retain their
captured source revision and never receive a replacement create. A blocked
series is checked once per run so other enabled series can continue. The scoped
runner reports aggregate outcome states without provider IDs.

Completed reset receipts remain keyed by request ID, so a delayed older request
cannot rewind a later explicit cycle. The previous latest-only receipt migrates
into this ledger when resumed.

## Optional post review and Canva edit sync

Prepared posts offers **Review post** for ready images. It shows the current PNG,
caption and posting time. Captions save separately. **Edit image in Canva** obtains
a fresh Canva-provided editing URL for that post's confirmed output copy and
identifies the assigned page; it never opens or modifies the saved source design.
The website's authorized Canva account must match the account captured for the
original render. Published, uploading, uncertain, removed and expired deliveries
cannot be edited through this action. Provider IDs, edit correlation state and
temporary editing tokens are not included in the normal browser state.

Opening the editor enrolls that output for saved-revision checks during page and
cloud runs. Returning focus to ekklo. triggers a check. A changed revision must
remain stable for at least 15 seconds before a one-page PNG export starts. Its
durable start marker precedes the request; the confirmed export job ID is recorded
immediately. Poll only that ID. A missing response/ID never causes another export.
Revisions changed during export/download supersede that export and cannot replace
the image. Valid PNGs replace the ready image atomically only while the delivery
is still unclaimed; prior image keys and every export receipt remain in history.
All operations stay within the owner, source, output design, account and page.

Review is optional and is never a publishing gate. The last confirmed PNG remains
available throughout editing, export, errors and uncertain requests. If no review
or edit occurs, normal automatic delivery uses the ready PNG in its current window.
The generation switch, automatic church publishing, enabled series, saved Page,
delivery deduplication and paused cloud task settings retain their meaning.

For Canva's **Return to ekklo.** button, enable Return navigation in the app's
Outside Canva configuration and register this site's `/api/canva/return` URL.
This differs from the OAuth `/api/canva/callback` URL. Fresh output edit links
include a short random correlation state. The return handler verifies Canva's
Ed25519 signature against `/rest/v1/connect/keys`, audience, expiry, account/team,
design, type, owner-bound state and return receipt before navigating to the post.
Unverified callbacks never initiate exports or accept image content. Without
return-navigation setup, the owner can return to the ekklo. tab and the same
saved-revision checks run. Canva saves edits automatically; the platform cannot
infer that a person has finished editing before the saved revision is stable.

New Canva image date fields use compact English month names (for example,
`Nov. 8, 2026`), without a weekday. Full caption dates remain available. Daily
images still contain only verse text and reference. Canva REST Autofill accepts
text values but does not expose text-box positioning/font fitting. Text-box widths,
centering and overlaps must be corrected in the actual Canva output or in an
explicitly saved/checked working-copy template. No raster replacement or unrelated
template is substituted to imitate such a fix. An existing confirmed output is
not silently regenerated merely to change the date format.

Official return-navigation reference:
https://www.canva.dev/docs/apps/rest-apis/return-navigation-guide/
