# App Review notes — Progra

Paste-ready answers for **App Store Connect → App Review Information → Notes**,
plus the shot list for the demo recording Apple asked for.

Apple's request (2026-08-24) is the standard "Information Needed" set: a device
screen recording, the test matrix, what the app is, how to get in, the external
services, regional differences, and regulated-industry documentation. Nothing in
it says the binary is wrong — this is answered by **replying in Resolution
Center**, not by uploading a new build.

_Last updated: 2026-08-24. Re-check every submission, alongside
`docs/app-privacy-label.md`._

**`docs/app-review-notes-paste.txt` is the file you actually paste.** The App
Review Information → Notes box is a plain-text field capped at roughly 4000
characters, so markdown tables do not render and the long-form answers below do
not fit. That file is the condensed items 2–7, measured at 3,998 characters with
both placeholders still in (filling them in makes it shorter). Verify the limit
in ASC — if the field takes more, prefer the fuller wording from this document.

---

## Before writing the reply — confirm these against the build in review

- [ ] **The reviewer can actually get in.** Progra is capped at 250 beta seats
      (`beta_config.seat_cap`); a signed-in user with `profiles.seat_no = null`
      sees the waitlist wall (`components/beta-full.tsx`) instead of the app, on
      every route. Confirm seats remain free so the `zz_claim_beta_seat` signup
      trigger seats the reviewer automatically. **An Apple reviewer who lands on
      a waitlist wall is an automatic rejection.**
- [ ] **Which flags the reviewed build was compiled with** (`lib/flags.ts` is
      inlined at build time). The notes below assume `REDESIGN` on (so
      `SOCIAL_ENABLED` on) and `CALENDAR_CONNECT` off. If push
      (`SOCIAL_PUSH`) or the reminder flags were dark in this build, do not
      describe them as user-visible features.
- [ ] **`aps-environment`** is `production` in the archived build's entitlements
      — the checked-in `ios/App/App/App.entitlements` says `development`, which
      would make every push silently fail for the reviewer.
- [ ] Privacy Policy URL (`https://progra.world/privacy`) and Support URL
      (`https://progra.world/support`) resolve signed-out.
- [ ] The recording is made against **the same build that is in review**.

---

## 1. Screen recording — shot list

Portrait, physical device, current public iOS, one continuous take, app not
running at the start. Roughly seven minutes.

### Two constraints that shape the whole take

**The recap story is unreachable on a new account.** `lib/db/progress.ts:106`
sets `recapWeekExisted = recapWeekEndMs >= createdMs`, and `RecapNudge` is the
only in-app route to `/recap/[weekStart]`, whose card panel is the only *file*
share in the app (`/recap`'s "Share this week" shares plain text). So a
same-day throwaway account can never reach the photo-library prompt.

**Therefore the take uses both accounts, in one recording:** a throwaway for
signup, the OS prompts, the clock loop, report/block and deletion; then the real
account for the feed and the recap card. Progra creates a separate user per auth
provider, so sign the throwaway in with whichever of Apple/Google you do *not*
use in real life — the deletion in beat 17 then destroys only that one, and the
freed `seat_no` returns to the allocator.

### Getting a fresh install without a cable

Permissions reset only on a fresh install, and installing *over* an existing app
preserves them. TestFlight needs no cable and delivers the exact binary under
review — a build being *in review* is still available for internal testing.

**App Store Connect:**

1. My Apps → Progra → **TestFlight** tab
2. **Builds → iOS**: if the build shows **Missing Compliance**, click it →
   Manage → "uses encryption" **Yes** → "qualifies for an exemption" **Yes**
   (Progra uses only OS-provided TLS). No CCATS needed
3. **Internal Testing** → **+** → name a group (e.g. `Recording`)
4. Group → **Testers** → **+** → add your Apple ID
5. Group → **Builds** → **+** → select the build. *This* sends the invite;
   adding a tester alone does nothing

**The Apple ID trap.** The invited Apple ID must be the one signed into the App
Store on the phone — Settings → [name] → **Media & Purchases**, often not the
same as the iCloud Apple ID. If it is not an ASC user: Users and Access → + →
invite it with the **Developer** role, accept, then return to step 4. Do not use
External Testing to dodge this — it requires Beta App Review.

Note that Sign in with Apple *inside Progra* uses the **iCloud** Apple ID, which
is why Phase A's throwaway works: it creates a new Progra account distinct from
the real Google-based one.

**On the phone:**

1. Install **TestFlight** from the App Store first
2. **Delete the existing build** — long-press → Remove App → **Delete App** (not
   "Remove from Home Screen", not Offload). This must precede the TestFlight
   install: same bundle ID means it would otherwise replace in place and keep the
   container and every permission
3. **Restart the phone** — iOS can briefly retain notification authorization
   after deletion, the most common reason the prompt still fails to fire
4. TestFlight → Progra → **Install**

**Verify before recording** — three checks:

1. Settings → app list → Progra shows no Camera / Photos / Notifications rows
2. Settings → Notifications → Progra is absent
3. Launching lands on the **signed-out** landing screen. Already signed in means
   the WKWebView container survived, so the permissions did too

TestFlight apps show a small orange dot beside the Home Screen name. Harmless —
it evidences that the recording is of the submitted build.

**Cable-free fallbacks:** Xcode → Devices and Simulators → **Connect via
network**, if the device was paired with that enabled. Otherwise **Settings →
General → Transfer or Reset iPhone → Reset → Reset Location & Privacy** restores
camera and photos for every app but **not** notifications — nothing does short of
reinstalling. In that case skip beat 6 and state in the notes that the
notification prompt fires during onboarding on first install.

**Do not rehearse on the install you record on** — a dry run consumes all three
prompts.

**Next build:** add `ITSAppUsesNonExemptEncryption` = `false` to
`ios/App/App/Info.plist` so ASC stops asking about compliance on every upload.
Correct for Progra, which uses only OS-provided TLS.

### Phase A — throwaway account

| # | Screen | Action |
|---|---|---|
| 1 | Home Screen | Tap the Progra icon, cold launch |
| 2 | Signed-out landing | Tap **Sign in with Apple** (top button) |
| 3 | Native Apple sheet | Continue → Face ID |
| 4 | Onboarding `welcome`→`how`→`goal` | Advance; type a real goal (it is created for real) |
| 5 | Onboarding `clock` | The simulated 25-minute clock-in; let it fast-forward |
| 6 | Onboarding `notify` | **iOS notification prompt fires here.** Hold a beat, tap Allow |
| 7 | `post`→`habit`→`recap`→`invite`→`go` | Advance; create a real habit at `habit` |
| 8 | Progress tab | Scroll once so the goal and habits are visible |
| 9 | Clock tab (center) | Pick a category → **Clock in** |
| 10 | Live timer | Run ~5s → **Pause** → **Resume** |
| 11 | Live timer → Add photo | **Take a photo** — `capture="environment"` opens the camera directly, so the **camera prompt fires here**. Allow, shoot, attach |
| 12 | Live timer | **Clock out** |
| 13 | Finish screen | Add a note → **Save session** |
| 14 | Friends tab | Search a username → open the result's profile |
| 15 | Profile | **gear** → **Report** → pick a reason → **Submit report** |
| 16 | Profile | gear → **Block** → confirm in the "Block @username?" alert |
| 17 | You → gear → Settings | Scroll to the bottom → hold **"Hold to delete account"** → confirm |
| 18 | Signed-out landing | Keep recording |

### Phase B — real account, same take, same install

| # | Screen | Action |
|---|---|---|
| 19 | Signed-out landing | **Sign in with Google** (the real account) |
| 20 | Progress tab | Tap **"Your week is ready"** if present — see the caveat below |
| 21 | Recap story | Swipe all five panels |
| 22 | Panel 5 (the card) | **Share** → share sheet → **Save Image**. The **photo-library prompt fires on Save Image**, not on Share. Allow |
| 23 | Feed tab | Open a session with real content → react → post a comment |
| 24 | Session detail | Flag icon → **Report this session** → reason → **Submit report** (clear it afterwards from Settings → Report queue) |

**Caveat on beat 20:** the nudge renders only while `recapOpened` is unset for the
most recent unlocked week. If last week's recap has already been opened, the
banner is gone and beats 20–22 are unreachable — clear that row first, or drop
them and state in the notes that `NSPhotoLibraryAddUsageDescription` is triggered
by the system share sheet's Save Image action rather than by an app-initiated
request.

## 2. Devices and operating systems tested

Derived from the project, so these two are not guesses: `TARGETED_DEVICE_FAMILY
= 1` and `IPHONEOS_DEPLOYMENT_TARGET = 15.0` in `ios/App/App.xcodeproj` — Progra
is **iPhone-only**, minimum **iOS 15.0**. No iPad testing is owed.

The device list itself has to be real; Apple checks it against the build's
compatibility and crash data. Fill in the model and OS version of the phone the
recording is made on, plus any second device actually used.

---

## 3. What the app does, and for whom

Progra is a productivity tracker built around a shared, social layer rather than
a private spreadsheet. A user clocks in to a category of work, the app times the
session, and the finished session — with an optional photo and note — appears in
a feed their accepted friends can see, react to, and comment on. Around that
core loop it keeps weekly goals, daily habits, a session history, and a weekly
recap that summarizes where the time went.

**Target audience:** students and self-directed knowledge workers who track their
own time and want accountability from people they know.

**Problem it solves:** solo time tracking is easy to abandon because nothing
happens when you stop. Progra makes the tracked time visible to a small,
mutual-consent friend group, so the accountability is social instead of
self-imposed.

**Value:** an honest record of where the week actually went, plus a peer group
that sees the work.

Free. No in-app purchases, no subscription, no advertising.

---

## 4. Setting up and accessing the main features

**There is no demo account, and none is possible:** Progra has no
username/password path. Sign-in is **Sign in with Apple** or **Sign in with
Google** only, so a reviewer signs in with their own Apple ID (Hide My Email is
fully supported) and gets a fresh account. No invite code, no promo code, no
sample files are needed.

1. Launch → tap **Sign in with Apple** on the landing screen.
2. Onboarding runs once and creates the first goal and habit. Notification
   permission is requested here and can be declined without blocking anything.
3. **Clock** (center tab) → pick a category → **Clock in**. The live timer
   supports pause/resume; clocking out opens the finish screen where a note and
   a photo can be attached.
4. **Progress** (first tab) → habits, goals, and the weekly recap.
5. **Friends** → search a username → send a request. Both sides must accept
   before either can see the other's sessions. To see the social surfaces with
   real content, add `@progra` (or the handle supplied in the reply) — that
   account will accept promptly and has visible sessions.
6. **Feed** → reactions and comments on friends' sessions.
7. **You → Settings** → profile, time zone, notification preferences,
   bug report, and **account deletion** at the bottom of the page.

Every social surface is friend-gated in the database (Postgres row-level
security on `auth.uid()`), so a brand-new account correctly sees an empty feed
until a friend request is accepted — that is the intended state, not a failure.

---

## 5. External services used

| Service | Role |
|---|---|
| **Supabase** (Postgres, Auth, Storage) | database, authentication, private photo storage |
| **Vercel** | web hosting for the app the native shell loads |
| **Sign in with Apple** | authentication |
| **Google Sign-In** | authentication |
| **Google Calendar API** (`calendar.events.readonly`) | optional, off by default in this build: reads event titles and times so calendar time can sit beside tracked time |
| **Anthropic (Claude API)** | categorizes calendar event titles into the user's own categories. Not used for advertising; data is not used for model training |
| **Apple Push Notification service (APNs)** | social notifications (likes, comments, friend requests) |
| **PostHog** | product analytics, keyed to the account's user ID; no advertising identifiers, no cross-app tracking, no data brokers |

No payment processor, no ad network, no data provider, no analytics SDK beyond
PostHog. Nothing is sold or shared for advertising, which is why every "used for
tracking" answer on the privacy nutrition label is No.

**On the native shell:** Progra is a Capacitor app whose web layer is served from
`https://progra.world`, and it uses native device capabilities directly — Sign in
with Apple, APNs push, on-device scheduled local notifications for clock-in and
habit reminders, the camera for session photos, and photo-library saving for the
weekly recap card. It is the same product on both surfaces by design; the account
and its data are the user's regardless of where they sign in.

---

## 6. Regional differences

None. Progra behaves identically in every region and every storefront. The
interface is English-only; there is no geofenced content, no region-specific
pricing (the app is free), and no feature that is enabled or disabled by
country. Times are displayed in the time zone the user selects in Settings,
which is the only locale-dependent behavior in the app.

---

## 7. Regulated industry / third-party material

Not applicable. Progra operates in no regulated industry — it is not a health,
medical, financial, gambling, or HIPAA/COPPA-covered product. Study and work
time is user-authored content, not health data. The app contains no licensed
third-party material: all copy, artwork, and iconography are original or used
under open-source licenses.

The only third-party user data the app touches is a user's own Google Calendar,
accessed with a read-only scope under explicit OAuth consent and governed by the
Google API Services User Data Policy, including its Limited Use requirements —
committed to verbatim at `https://progra.world/privacy`.

---

## The Resolution Center reply

Notes carries items 2–7. The reply carries the video and the argument — this is
where a 4.2 reading gets answered, and it has no tight character limit.

> Thank you. A screen recording made on a physical device is attached [or:
> available at <LINK>]. It begins with launching the app and covers account
> creation via Sign in with Apple, the notification, camera and photo-library
> permission prompts, the core clock-in / clock-out loop, user-generated content
> with its reporting and blocking flows, and in-app account deletion. The app has
> no paid content, subscriptions or in-app purchases, and presents no App
> Tracking Transparency prompt because it performs no tracking as Apple defines
> it. Answers to items 2–7 have been added to the Notes field in App Review
> Information.
>
> On the native implementation: Progra is a Capacitor app whose web layer is
> served from https://progra.world, and it uses native device capabilities
> directly — Sign in with Apple, APNs push notifications, on-device scheduled
> local notifications for clock-in and habit reminders, the camera for session
> photos, and photo-library saving for the weekly recap card.
>
> On Guideline 1.2: report and block are available on every profile, session and
> feed card; reports reach an in-app moderation queue; and a commitment to act on
> reports within 24 hours is published at https://progra.world/terms.
>
> On Guideline 5.1.1(v): account deletion is reachable in-app at Settings →
> "Hold to delete account", and deletes the account together with its data.
>
> On Guideline 4.8: Sign in with Apple is offered above Google at equal size and
> prominence.

