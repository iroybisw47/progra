# Progra — Screen Inventory

Ground-truth enumeration of every screen, route-level state, overlay, and
whole-surface conditional state. Derived from the `app/` and `components/` trees;
every row cites `file:line`. Not derived from ARCHITECTURE.md.

## Flag context (governs which screens are reachable)
- `REDESIGN` (`lib/flags.ts:18`) is the master switch for the V2 information
  architecture. `SOCIAL_ENABLED` (`lib/flags.ts:26-27`) is `env || REDESIGN`, so
  **REDESIGN implies SOCIAL_ENABLED**.
- The bottom-nav has three layouts (`components/bottom-nav.tsx:41-63`): **V2
  (REDESIGN)** = Progress · Feed · [Clock] · Friends · You; **social** = Home ·
  You · [Clock] · Goals · Habits; **beta** = Home · Search · [Clock] · Goals ·
  Habits. This document treats the **V2 IA as primary** (the five tabs the task
  names); beta/social-only variants are called out where they differ.

---

## Flat screen table

Kinds: **route** (a `page.tsx`), **state** (route-level `loading`/`error`, or a
whole-surface conditional branch inside a client shell), **dialog** (Dialog /
Sheet / AlertDialog overlay).

### Routes

| Screen ID | Route | Kind | Entered from | Gate | File:line |
|---|---|---|---|---|---|
| R01 | `/` (Progress / home) | route | BottomNav "Progress"; post-login redirect | `getCurrentUser`; `!user`→SignedOutLanding; REDESIGN→`onboarded_at` redirect | app/page.tsx:19-56 |
| R02 | `/login` | route | any gated route when signed out | public; `getCurrentUser`→`redirect(next)` if authed | app/login/page.tsx:13-25 |
| R03 | `/onboarding` | route | `/` redirect when `onboarded_at` null; replay button | `requireUser`; REDESIGN→v2 wizard else legacy | app/onboarding/page.tsx:32-48 |
| R04 | `/feed` | route | BottomNav "Feed"; `/session/[id]` back-link | `!REDESIGN`→`notFound`; `requireUser` | app/feed/page.tsx:9-12 |
| R05 | `/friends` | route | BottomNav "Friends"; feed/dashboard/profile links | `!SOCIAL_ENABLED`→`notFound`; `requireUser` | app/friends/page.tsx:18-20 |
| R06 | `/me` (You) | route | BottomNav "You" | `!SOCIAL_ENABLED`→`notFound`; `requireUser`; REDESIGN inline profile, else Dashboard | app/me/page.tsx:36-44 |
| R07 | `/search` | route | beta nav "Search" only (no V2 inbound) | ungated placeholder (no auth/flag call) | app/search/page.tsx:4-23 |
| R08 | `/goals` | route | Settings "Your data"; Progress goal cards | ungated in page; RLS in loaders | app/goals/page.tsx:9-14 |
| R09 | `/habits` | route | Settings "Your data" | ungated in page; RLS in loaders | app/habits/page.tsx:10-22 |
| R10 | `/categories` | route | Settings "Your data"; clock category tools | `!REDESIGN`→`notFound`; `requireUser` | app/categories/page.tsx:12-14 |
| R11 | `/history` | route | Settings "Your data"; Dashboard; Progress "History" | ungated in page; RLS in loaders | app/history/page.tsx:26-31 |
| R12 | `/sessions` | route | Settings "Your data"; clock-client link | ungated in page; RLS in loaders | app/sessions/page.tsx:7-15 |
| R13 | `/recap` | route | History scrubber; Dashboard | ungated in page; RLS in loaders | app/recap/page.tsx:14-19 |
| R24 | `/recap/[weekStart]` | route | Full-screen weekly recap **story** (5 panels: The number · Where it went · Goals · Your rank · Shareable card) | `requireUser`; `force-dynamic`; window via `weekWindow`; `getWeekLeaderboard` | app/recap/[weekStart]/page.tsx · recap-story.tsx (motion) |
| R25 | `/recap/[weekStart]/card` | route (OG) | 1080×1080 recap PNG (`next/og` ImageResponse) — shared as a File by the story's Share button | `getCurrentUser` (401 if none); `force-dynamic`; Node runtime | app/recap/[weekStart]/card/route.tsx |
| R14 | `/clock` | route | BottomNav center "Clock"; Progress goal cards; live-timer back | ungated in page; RLS in loaders | app/clock/page.tsx:10-17 |
| R15 | `/clock/finish` | route | live-timer clock-out redirect | `!REDESIGN`→`notFound`; `requireUser`; own-row + ended checks | app/clock/finish/page.tsx:25-46 |
| R16 | `/clock/live` | route | clock strip; nav center while tracking | `!REDESIGN`→`notFound`; `requireUser`; `!active`→`/clock` | app/clock/live/page.tsx:15-20 |
| R17 | `/session/[id]` | route | feed cards; notifications panel | `!REDESIGN`→`notFound`; `requireUser`; `!detail`→`notFound` (RLS) | app/session/[id]/page.tsx:22-32 |
| R18 | `/profile/[username]` | route | author links in feed/friends/session/clocked-in/admin | `!SOCIAL_ENABLED`→`notFound`; `requireUser`; `!target`/blocked→`notFound` | app/profile/[username]/page.tsx:35-52 |
| R19 | `/settings` | route | `/me` settings icon | `!REDESIGN`→`notFound`; `requireUser` | app/settings/page.tsx:13-24 |
| R20 | `/admin` | route | Settings "Moderation" (admins); Dashboard | `!SOCIAL_ENABLED`→`notFound`; `requireUser`; `is_admin!==true`→`notFound` | app/admin/page.tsx:43-49 |
| R21 | `/privacy` | route | footer links (`/`, `/terms`, login) | public | app/privacy/page.tsx:8 |
| R22 | `/terms` | route | footer links (`/`, `/privacy`) | public | app/terms/page.tsx:8 |
| R23 | `/i/[username]` | route | shared invite link (external) | `!SOCIAL_ENABLED`→`notFound`; else **public** (`getOptionalUser`) | app/i/[username]/page.tsx:17-25 |

R23 states: signed-out + valid handle → invite landing (avatar/name/bio + Continue with Google, carries `?ref=`); signed-in **other** user → `claim_invite` then `redirect(/profile/{username})`; signed-in **self** → `redirect(/me)`; unknown handle → inline "Invite not found" card (not `notFound()`). Loader: `app/i/[username]/loading.tsx` (`PrograLoader`).

### Route-level states (loading)

No `error.tsx` or `not-found.tsx` boundaries exist anywhere in `app/` — `notFound()`
falls through to the Next.js default.

| Screen ID | Route | Kind | Renders | File:line |
|---|---|---|---|---|
| L01 | `/` (root) | state | `<PrograLoader />` branded clock loader | app/loading.tsx:6 |
| L02 | `/clock` | state | `<PageSkeleton title="Clock" blocks={3} />` | app/clock/loading.tsx:4-10 |
| L03 | `/habits` | state | `<PageSkeleton title="Habits" />` | app/habits/loading.tsx:4-10 |
| L04 | `/feed` | state | `<PageSkeleton title="Feed" />` | app/feed/loading.tsx:4-10 |
| L05 | `/goals` | state | `<PageSkeleton title="Goals" />` | app/goals/loading.tsx:4-10 |
| L06 | `/recap` | state | `<PageSkeleton title="Recap" />` | app/recap/loading.tsx:4-10 |
| L07 | `/me` | state | `<PageSkeleton title="You" />` | app/me/loading.tsx:4-10 |
| L08 | `/friends` | state | `<PageSkeleton title="Friends" />` | app/friends/loading.tsx:4-10 |
| L09 | `/history` | state | `<PageSkeleton title="History" />` | app/history/loading.tsx:4-10 |
| L10 | `/sessions` | state | `<PageSkeleton title="Session history" />` | app/sessions/loading.tsx:4-10 |
| L11 | `/categories` | state | `<PageSkeleton title="Categories" />` | app/categories/loading.tsx:4-10 |

### Dialogs / sheets / overlays

| Screen ID | Overlay | Kind | Mounted by | Reachable from | File:line (overlay) |
|---|---|---|---|---|---|
| D01 | New/Edit category | dialog | categories-client | /categories | app/categories/categories-client.tsx:164 |
| D02 | Delete category confirm | alert | categories-client | /categories | app/categories/categories-client.tsx:238 |
| D03 | Edit goal | dialog | goals-client | /goals | app/goals/goals-client.tsx:384 |
| D04 | Archive goal confirm | dialog | goals-client | /goals | app/goals/goals-client.tsx:440 |
| D05 | Edit habit | dialog | habits-client | /habits | app/habits/habits-client.tsx:264 |
| D06 | Delete session / remove event confirm | dialog | history-client | /history | app/history/history-client.tsx:433 |
| D07 | Edit profile (identity) | dialog | settings-client | /settings | app/settings/settings-client.tsx:309 |
| D08 | Time-zone picker | dialog | settings-client | /settings | app/settings/settings-client.tsx:361 |
| D09 | Edit profile | dialog | profile-actions | /profile/[username] (self) | app/profile/[username]/profile-actions.tsx:148 |
| D10 | Edit category | dialog | clock-client | /clock | app/clock/clock-client.tsx:1026 |
| D11 | Delete category confirm | dialog | clock-client | /clock | app/clock/clock-client.tsx:1079 |
| D12 | Edit session | dialog | live-timer-client | /clock/live | app/clock/live/live-timer-client.tsx:415 |
| D13 | Session notes | dialog | live-timer-client | /clock/live | app/clock/live/live-timer-client.tsx:527 |
| D14 | Report action | alert | admin-reports | /admin | app/admin/admin-reports.tsx:268 |
| D15 | New/Edit session log | dialog | SessionDialog (dynamic) | /clock | components/session-dialog.tsx:73 (mount clock-client.tsx:1104) |
| D16 | Delete session confirm (nested) | alert | SessionDialog | /clock | components/session-dialog.tsx:389 |
| D17 | Categorize event | dialog | EventCategoryDialog (dynamic) | /clock | components/event-category-dialog.tsx:41 (mount clock-client.tsx:1117) |
| D18 | Add a photo | dialog | SessionPhotoStep (dynamic) | /clock, /clock/live | components/session-photo-step.tsx:82 (mounts clock-client.tsx:1126, live-timer-client.tsx:555) |
| D19 | Categorization review | dialog | CategorizationReviewDialog (dynamic) | /history | components/categorization-review-dialog.tsx:116 (mount categorize-period-button.tsx:104) |
| D20 | Frame your photo (crop) | dialog | AvatarCropDialog (dynamic) | /settings, /onboarding | components/avatar-crop-dialog.tsx:41 (mount avatar-picker.tsx:140) |
| D21 | Manage habits | dialog | ManageHabits (dynamic) | `/` (Progress) | components/v2/manage-habits.tsx:199 (mount progress-client.tsx:117) |
| D22 | Delete habit confirm (nested) | alert | ManageHabits | `/` (Progress) | components/v2/manage-habits.tsx:349 |
| D23 | Edit habit (nested) | dialog | ManageHabits | `/` (Progress) | components/v2/manage-habits.tsx:421 |
| D24 | Report content | dialog | ReportButton | /profile/[username], /session/[id], feed cards | components/report-button.tsx:79 |
| D25 | Delete account confirm | alert | DeleteAccountButton | Dashboard only (beta/social `/`, `/me`) — legacy | components/delete-account-button.tsx:49 (mount dashboard.tsx:233) |
| D26 | Notifications panel | sheet | NotificationsBell | /friends | components/notifications-bell.tsx:69 (mount friends-client.tsx:163) |

### Whole-surface conditional states

Grouped by surface. Only branches that swap the whole surface or a major section.

| Screen ID | Surface | State kind | What it shows | Trigger | File:line |
|---|---|---|---|---|---|
| S01 | clock-client | status | active-session surface vs. clock-in form | `activeSession` truthy | app/clock/clock-client.tsx:500 |
| S02 | clock-client | status | active: compact live strip (REDESIGN) vs. full "Clocked in" card | `REDESIGN ?` | app/clock/clock-client.tsx:501 |
| S03 | clock-client | status | paused vs. running (badge, Resume/Pause) | `isPaused(activeSession)` | app/clock/clock-client.tsx:515,645 |
| S04 | clock-client | mode | day-mode vs. week-mode header/body | `inDayMode` | app/clock/clock-client.tsx:840,864 |
| S05 | clock-client | empty | "No sessions logged" (day) | `day.rows.length === 0` | app/clock/clock-client.tsx:870 |
| S06 | clock-client | empty | "No sessions logged yet this week." | `categoryBreakdown.length === 0` | app/clock/clock-client.tsx:964 |
| S07 | finish-client | pending | "Saving…" vs "Save session" | `pending` | app/clock/finish/finish-client.tsx:121 |
| S08 | finish-client | other | photo section only when photo exists | `photoUrl &&` | app/clock/finish/finish-client.tsx:82 |
| S09 | live-timer-client | status | "Paused" vs "Tracking" (timer color, Resume/Pause, glow) | `paused = pausedSince != null` | app/clock/live/live-timer-client.tsx:282-288,401 |
| S10 | live-timer-client | other | "Photo attached" chip vs "Add photo" | `hasPhoto ?` | app/clock/live/live-timer-client.tsx:375 |
| S11 | live-timer-client | edit sub-state | edit sheet: "Ended at" + "Finish session" vs "Save" | `!stillRunning &&` | app/clock/live/live-timer-client.tsx:504,520 |
| S12 | onboarding-client-v2 (REDESIGN) | step | 10-step machine (9 on web): welcome→**how**→goal→clock→*notify*→post→habit→friends→invite→go. `notify` is native-only; `clock` and `post` are deliberate simulations, the goal and habits are created for real; calendar connect lives in History/Settings | `useState<Step>` | app/onboarding/onboarding-client-v2.tsx |
| S13 | onboarding-client-v2 | phase (per step) | conversational typing→streaming→ready reveal | `Conversation` engine | app/onboarding/onboarding-client-v2.tsx:19-23 |
| S14 | conversation.tsx | phase | typing indicator vs. streamed text vs. controls | `state.phase` typing/streaming/ready | components/onboarding/conversation.tsx:90,164,215 |
| S15 | conversation.tsx | other | reduced-motion mounts straight to "ready" | `instant` | components/onboarding/conversation.tsx:89,93 |
| S16 | onboarding-client (legacy, !REDESIGN) | step | 9-step machine incl. tour-home/history/habits early-returns | `useState<Step>("welcome")` | app/onboarding/onboarding-client.tsx:151; :262,280,292,315,330,367,392,442,531 |
| S17 | onboarding-client (legacy) | sub-machine | practice: idle / running / done | `practicePhase` | app/onboarding/onboarding-client.tsx:168,461,485,516 |
| S18 | onboarding-client (legacy) | sub-machine | tour spotlights (home recap/history, history sync/categorize) | `homeTour`,`historyTour` | app/onboarding/onboarding-client.tsx:152,735,755,840,881,892 |
| S19 | friends-client | search | "Searching…" / "No users found." / results, when query≥2 | `searching`; `results.length===0` | app/friends/friends-client.tsx:181-193 |
| S20 | friends-client | empty | people-on-Progra empty ("added everyone 🎉" vs "No one else") | `people.length === 0` | app/friends/friends-client.tsx:209-211 |
| S21 | friends-client | empty | "No friends yet — search above…" | `friends.length === 0` | app/friends/friends-client.tsx:296 |
| S22 | friends-client | section toggles | Requests / Sent / Blocked cards only when non-empty | `incoming/outgoing/blocked.length>0` | app/friends/friends-client.tsx:228,268,328 |
| S23 | friends-client | relationship (per-row) | action: Friends / Requested / Accept / Add | `renderAction` branches | app/friends/friends-client.tsx:116,123,131,142 |
| S24 | goals-client | empty | "No active goals yet. Add one below." | `goals.length === 0` | app/goals/goals-client.tsx:202 |
| S25 | goals-client | empty | per-goal "No sessions yet…" | `goalSessions.length === 0` | app/goals/goals-client.tsx:283 |
| S26 | habits-client | empty | "No habits yet. Add one below." | `optimisticItems.length === 0` | app/habits/habits-client.tsx:159 |
| S27 | categories-client | empty | "No categories yet…" vs. list | `categories.length === 0` | app/categories/categories-client.tsx:115 |
| S28 | categories-client | mode | dialog "Edit category" vs "New category" | `editing.mode` | app/categories/categories-client.tsx:167,237 |
| S29 | history-client | view | week summary vs. month/year rollup | `props.view === "week"` | app/history/history-client.tsx:182 |
| S30 | history-client | nav | scrubber "Next" vs. current-period label | `isCurrentPeriod || isFuturePeriod` | app/history/history-client.tsx:167 |
| S31 | history-client | empty | "Nothing logged in {label}." | `categoryCount > 0` else | app/history/history-client.tsx:364 |
| S32 | sessions-client | empty | "No past sessions[ in this category] yet." | `groups.length === 0` | app/sessions/sessions-client.tsx:158 |
| S33 | sessions-client | paging | "Load older" / "Loading…" | `hasMore`; `loading` | app/sessions/sessions-client.tsx:258,265 |
| S34 | recap-client | nav | scrubber "Next" vs "This week" (RecapCard always renders) | `isCurrentWeek || isFutureWeek` | app/recap/recap-client.tsx:110 |
| S35 | settings-client | connection | calendar "Disconnect" vs "Connect" (+ unverified warning) | `calendarConnected ?`; `SHOW_UNVERIFIED_WARNING` | app/settings/settings-client.tsx:207,227 |
| S36 | settings-client | role | Moderation section only for admins | `isAdmin &&` | app/settings/settings-client.tsx:281 |
| S37 | progress-client (home) | tabs | Today / Week / History views | `useState<Tab>("today")` | components/v2/progress-client.tsx:82,112-114 |
| S50 | progress-client (home) | nudge | "Your week is ready" recap banner (above the tabs) → opens `/recap/{weekStart}` | `props.recapNudge` (set in `loadProgressData` when the week unlocked Sun 6pm local & is unopened) | components/v2/recap-nudge.tsx · components/v2/progress-client.tsx |
| S38 | progress-client | empty | "Nothing tracked yet today." | `sessionsToday.length === 0` | components/v2/progress-client.tsx:209 |
| S39 | progress-client | empty | "No goals yet — tap to add one." | `goals.length === 0` | components/v2/progress-client.tsx:259 |
| S40 | progress-client | empty | "No habits yet — tap to add one." | `optimisticHabits.length === 0` | components/v2/progress-client.tsx:326 |
| S41 | feed-v2 (server) | empty | "Your feed's quiet…" + **InviteShare** (share/copy invite link) + "find people already on Progra" link | `entries.length===0 && clockedIn.length===0` | components/v2/feed-v2.tsx |
| S42 | feed-v2 | entry kind | join-announcement card vs. session card | `entry.kind === "join"` | components/v2/feed-v2.tsx:95 |
| S51 | feed-v2 | entry kind | **recap post** card ("{name} uploaded their weekly recap!" + navy summary) | `entry.kind === "recap"` | components/v2/recap-feed-card.tsx · feed-v2.tsx |
| S52 | recap-story (final panel) | post | caption box + "Post to feed" → `postRecap`; button flips to "Posted ✓" | `posted` state | app/recap/[weekStart]/recap-story.tsx (ShareableCardPanel) |
| S43 | feed-v2 | other | comment preview vs. "Add a comment" | `preview ?` | components/v2/feed-v2.tsx:258 |
| S44 | /me (You, server) | empty | "Your finished sessions show up here." | `pastSessions.length === 0` | app/me/page.tsx:177 |
| S45 | /me (You) | role | REDESIGN inline profile vs. Dashboard vs. 404 | `SOCIAL_ENABLED`, `REDESIGN` | app/me/page.tsx:37,40 |
| S46 | profile/[username] (server) | relationship | notFound: flag off / no user / blocked | `!SOCIAL_ENABLED`,`!target`,`blocked` | app/profile/[username]/page.tsx:40,45,52 |
| S47 | profile/[username] | relationship | full content vs. "Add @X as a friend…" private card | `canSeeContent` (self/friends) | app/profile/[username]/page.tsx:78,83 |
| S48 | profile/[username] | empty | "No shared sessions yet." | `pastSessions.length === 0` | app/profile/[username]/page.tsx:180 |
| S49 | profile-actions | relationship | none→Add / outgoing→Cancel / incoming→Accept+Decline / friends→Remove+Block / self→Edit | `relationship.kind` | app/profile/[username]/profile-actions.tsx:59,63,74,84,106,132 |

---

## Flowcharts (per bottom-nav tab, plus auth/onboarding and settings/admin)

### Auth + Onboarding

```mermaid
flowchart TD
  landing["SignedOutLanding (/)"] -->|Sign in| login["/login"]
  login -->|Google OAuth| root["/"]
  login -->|already authed| root
  root -->|"onboarded_at null (REDESIGN/SOCIAL)"| onb["/onboarding"]
  onb -->|REDESIGN| v2["OnboardingClientV2: welcome→how→goal→clock→notify→post→habit→friends→invite→go"]
  onb -->|legacy| lg["OnboardingClient: 9-step + practice + tours"]
  v2 -->|complete| root
  lg -->|complete| root
  settings["/settings"] -->|Replay onboarding| onb
```

### Progress tab (`/`)

```mermaid
flowchart TD
  prog["/ ProgressClient"] --> today["Today view (default)"]
  prog --> week["Week view"]
  prog --> hist["History view"]
  today -->|empty| e1["Nothing tracked yet today"]
  today -->|goal card tap| clockgoal["/clock?goal=ID"]
  today -->|"no goals"| e2["No goals yet — tap to add"]
  today -->|"Manage habits"| mh["ManageHabits dialog: edit / delete-confirm"]
  prog -->|Goals link| goals["/goals?from=progress"]
  prog -->|History link| history["/history"]
  root_note["Home also renders Feed (social) or Dashboard (beta) by flag"] -.-> prog
```

### Feed tab (`/feed`)

```mermaid
flowchart TD
  feed["/feed FeedV2"] -->|empty| eq["Feed quiet + Find friends CTA"]
  eq --> friends["/friends"]
  feed -->|session card| sess["/session/[id]"]
  feed -->|join card| join["join announcement"]
  feed -->|author avatar| prof["/profile/[username]"]
  feed -->|comment preview| sess
  sess -->|back| feed
  sess -->|author| prof
  sess -->|"non-owner"| rep["Report dialog"]
  sess --> comp["Comment composer / reactions"]
```

### Clock tab (`/clock`)

```mermaid
flowchart TD
  clock["/clock ClockClient"] -->|idle| form["Clock-in form"]
  clock -->|active + REDESIGN| strip["Compact live strip"]
  strip --> live["/clock/live LiveTimerClient"]
  clock -->|nav center while tracking| live
  live -->|running or paused| lt["Stopwatch: pause/resume"]
  live -->|clock out| finish["/clock/finish"]
  live -->|back| clock
  live --> photo["Add photo dialog"]
  live --> editsheet["Edit session / notes dialog"]
  finish -->|save| root["/"]
  clock --> sd["New/Edit session dialog"]
  clock --> ecd["Categorize event dialog"]
  clock --> catd["Edit / delete category dialog"]
  clock --> pastlink["/sessions"]
```

### Friends tab (`/friends`)

```mermaid
flowchart TD
  fr["/friends FriendsClient"] --> search["Search (Searching / No users / results)"]
  fr --> people["People on Progra (empty variants)"]
  fr --> req["Requests card (if incoming)"]
  fr --> sent["Sent card (if outgoing)"]
  fr --> flist["Your friends (empty: none yet)"]
  fr --> blocked["Blocked card (if blocked)"]
  fr -->|bell| notif["Notifications panel (Sheet)"]
  notif -->|like/comment row| sess["/session/[id]"]
  fr -->|user row| prof["/profile/[username]"]
  prof --> pa["ProfileActions: none/outgoing/incoming/friends/self"]
  pa -->|block| fr
  pa -->|self| editp["Edit profile dialog"]
```

### You tab (`/me`)

```mermaid
flowchart TD
  me["/me"] -->|REDESIGN| you["Inline profile: identity + goal quotas + habits + sessions"]
  me -->|social, not REDESIGN| dash["Dashboard"]
  me -->|beta| x404["notFound()"]
  you -->|empty| es["Your finished sessions show up here"]
  you -->|Settings icon / Edit| settings["/settings"]
  dash --> recap["/recap"]
  dash --> history["/history"]
  dash --> friends["/friends"]
  dash --> admin["/admin"]
  dash --> delacct["Delete account confirm (legacy)"]
```

### Settings + Admin

```mermaid
flowchart TD
  settings["/settings SettingsClient"] --> cal["Calendar: Connect / Disconnect"]
  cal --> gcal["/auth/google-calendar?from=settings"]
  settings --> goals["/goals"]
  settings --> categories["/categories"]
  settings --> habits["/habits"]
  settings --> sessions["/sessions"]
  settings -->|admins only| admin["/admin"]
  settings --> replay["Replay onboarding → /onboarding"]
  settings --> editid["Edit identity dialog"]
  settings --> tz["Time-zone dialog"]
  settings --> hold["HoldToDelete → /login?deleted=1"]
  settings --> signout["POST /auth/signout"]
  admin --> queue["Report queue"]
  admin --> repaction["Report action alert"]
  admin --> prof["/profile/[username]"]
```

---

## Unreachable or orphaned

**Routes with no inbound link under the V2 (REDESIGN) IA:**
- **`/search`** (R07) — not a tab in the V2 nav (only the **beta** nav references
  `/search`, `components/bottom-nav.tsx:59`) and nothing links to it. It is an
  ungated placeholder (`app/search/page.tsx:4-23`). Reachable only by typing the
  URL while REDESIGN is on.

**Reachable only when flags are OFF (dark/legacy under REDESIGN):**
- **`Dashboard`** and therefore **`DeleteAccountButton` (D25)** render only on the
  `!REDESIGN` path (`app/me/page.tsx:40-43`, home `app/page.tsx:55`,
  `components/dashboard.tsx:233`). Under REDESIGN, account deletion is instead the
  `HoldToDelete` control in Settings (`app/settings/settings-client.tsx:304` →
  `/login?deleted=1`, `components/v2/hold-to-delete.tsx:41`).
- **`OnboardingClient` (legacy, S16-S18)** and its practice/tour sub-screens render
  only when `!REDESIGN` (`app/onboarding/page.tsx:46-108`). Under REDESIGN the v2
  wizard (S12) is used instead.
- **Beta/social nav tabs** `/goals` and `/habits` as *top-level tabs*
  (`bottom-nav.tsx:54-62`) — under REDESIGN these are reached via Settings, not the
  nav.

**Dialog components imported nowhere:** none. Every Dialog/Sheet/AlertDialog
consumer in `components/` has a confirmed mount site (D01-D26).

**Listed-but-not-overlays (no Dialog/Sheet/AlertDialog rendered):**
- `components/delete-comment-button.tsx` — inline confirm control; mounts at
  `components/feed.tsx:6` and `app/session/[id]/page.tsx:7`.
- `components/v2/hold-to-delete.tsx` — press-and-hold control; mounts at
  `app/settings/settings-client.tsx:304`.

**No `<Drawer>` usage** anywhere; the only `<Sheet>` consumer is the Notifications
panel (D26).

**No custom `error.tsx` / `not-found.tsx`** boundaries exist in `app/` — every
`notFound()` renders the framework default.
