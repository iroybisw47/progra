# App Privacy nutrition label — Progra

Draft of the App Store Connect **App Privacy** declaration. Written alongside
the interview-consent feature rather than at submission time, because the label
has to match what the app actually collects and the in-app consent copy has to
match the label — reconstructing that later is how the two drift apart.

_Last updated: 2026-08-20. Re-check before every submission._

---

## How to use this

App Store Connect asks, per data type: **do you collect it**, **is it linked to
the user's identity**, **is it used for tracking**, and **what are the
purposes**. "Tracking" has a specific meaning — linking this app's data with
third-party data for advertising or sharing with a data broker. Progra does
neither, so **every answer to "used for tracking" is No.**

---

## Data collected

### Contact Info → Email Address
- **Collected:** Yes
- **Linked to identity:** Yes
- **Used for tracking:** No
- **Purposes:** App Functionality; Other Purposes

Comes from Google or Apple sign-in. App Functionality covers authentication.
**"Other Purposes" is the interview outreach** — it is opt-in, off by default,
revocable in Settings, and disclosed under "Research and product interviews" in
the privacy policy. Do not claim Customer Support: that means responding to a
user who contacted you, not you contacting them.

Note: Sign in with Apple users may be on Hide My Email relay addresses. To send
to those at all, the sending domain must be registered in the Apple Developer
portal — otherwise mail is dropped silently.

### Contact Info → Name
- **Collected:** Yes · **Linked:** Yes · **Tracking:** No
- **Purposes:** App Functionality

Display name and profile picture from the OAuth provider, plus anything the
user edits. Shown to friends on their profile and in the feed.

### User Content → Photos or Videos
- **Collected:** Yes · **Linked:** Yes · **Tracking:** No
- **Purposes:** App Functionality

Session before/after photos. Stored in a private bucket, served by 1-hour signed
URL, visible only to accepted friends when the session isn't private. EXIF and
GPS are stripped server-side by the `sharp` re-encode in `uploadSessionPhoto`.

### User Content → Other User Content
- **Collected:** Yes · **Linked:** Yes · **Tracking:** No
- **Purposes:** App Functionality

Sessions, goals, habits, comments, bios, weekly recaps, and bug-report text.

### Identifiers → User ID
- **Collected:** Yes · **Linked:** Yes · **Tracking:** No
- **Purposes:** App Functionality; Analytics

The Supabase `auth.users` UUID. Analytics because PostHog identifies events with
it.

### Usage Data → Product Interaction
- **Collected:** Yes · **Linked:** Yes · **Tracking:** No
- **Purposes:** Analytics

PostHog events — the closed union in `lib/analytics.ts`. Session completions,
habit checks, friend adds, invites sent, onboarding completion, notification
permission outcomes, bug reports, interview consent.

### Diagnostics → Crash Data / Performance Data
- **Collected:** No

No crash reporter is integrated. Note that the **bug-report form** collects a
user agent, viewport, route and build SHA — but only when a user deliberately
files a report, and it's declared under User Content above, not Diagnostics.
If you ever add automatic crash reporting, this answer changes.

---

## Data NOT collected

Declare these as not collected, and be ready to say why:

| Category | Why not |
|---|---|
| Health & Fitness | Study time isn't health data |
| Financial Info | No payments |
| Precise / Coarse Location | Never requested; no location permission in `Info.plist` |
| Contacts | Friends are found by username search, never by address book |
| Browsing History | None |
| Search History | In-app user search isn't stored |
| Sensitive Info | None |
| Purchases | No IAP |
| Advertising Data | No ad SDK |

---

## Calendar data — read the fine print

Progra reads Google Calendar event **titles and times** with a read-only scope,
to show them beside tracked time. Titles are sent to Anthropic for
categorization (not used for training, disclosed in the policy).

Apple's form has no "Calendar" data type. This falls under **User Content →
Other User Content**, already declared above. The Google side is governed
separately by the **Google API Services User Data Policy** and its Limited Use
requirements, which the privacy policy commits to explicitly.

---

## Third parties

| Service | Data | Role |
|---|---|---|
| Supabase | everything | database, auth, storage |
| Vercel | request data | hosting |
| Google | OAuth identity, Calendar (read-only) | sign-in, calendar |
| Apple | OAuth identity, APNs tokens | sign-in, push |
| Anthropic | calendar event titles | event categorization |
| PostHog | product analytics | analytics |

All are service providers operating the app. **None is a data broker, none
receives data for its own purposes, and nothing is sold** — which is what keeps
every "used for tracking" answer No.

---

## Pre-submission checklist

- [ ] Privacy policy URL in App Store Connect resolves to `/privacy`
- [ ] Effective date in `app/privacy/page.tsx` **and** `app/terms/page.tsx` match each other and reality
- [ ] Every purpose claimed above appears in the privacy policy text
- [ ] `lib/analytics.ts` event union hasn't grown a category not declared here
- [ ] No new third-party SDK since the table above
- [x] `UIRequiredDeviceCapabilities` is `arm64`, not the stale `armv7` template default
- [ ] Review notes state there is NO demo account — Google / Sign in with Apple only
- [ ] Review notes name the native functionality (push, scheduled local notifications, camera, Sign in with Apple) against a Guideline 4.2 read of `server.url`
- [ ] Account deletion still reachable in-app (Guideline 5.1.1(v))
- [x] Report / block / moderation queue plus a published 24-hour response commitment (Guideline 1.2) — `/terms` § Reporting and moderation
