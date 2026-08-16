# PostHog Self-driving Setup Report

_Generated: 2026-08-15_

## Summary

PostHog Self-driving is now configured for Progra. Six native signal sources were enabled (health checks, error tracking ×3, session replay, and support), a 7-scout troop was tuned to the project's most-used surfaces, two custom scouts were created for the session loop and social funnel, and two Replay Vision scanners were armed on the clock completion flow and rage-click sessions. Findings will start appearing in the [Self-driving inbox](https://us.posthog.com/project/560043/inbox) within ~30 minutes.

---

## AI data processing

**Status:** Approved — the organization-level AI data processing consent was granted before this run.

---

## GitHub

**Status:** Connected during this run (integration id `223674`, account `iroybisw47`).

---

## Products enabled

The `products-enable` tool was not available on this deploy. The server-side product toggles were not changed programmatically; see follow-ups below for manual enablement steps.

| Product | Status | Notes |
|---|---|---|
| Session Replay | **Inert (manual step needed)** | `posthog.init` in `components/posthog-init.tsx:62` has `disable_session_recording: true` — an intentional privacy decision (the app shows other users' social content). Enabling replay requires a policy decision; see follow-up. |
| Error Tracking | **Not enabled (manual step needed)** | No existing issues. Enable via PostHog Settings → Error tracking → "Enable exception autocapture". |
| Support / Conversations | **Not enabled (manual step needed)** | Enable via the product sidebar, then connect an inbound channel (email / inbox / Slack) to start receiving tickets. |

---

## Signal sources

| `source_product` | `source_type` | Action | Source config id |
|---|---|---|---|
| `signals_scout` | `cross_source_issue` | **Default on** — no row needed; scout findings reach the inbox by default | — |
| `health_checks` | `health_issue` | **Enabled** | `01a007ce-f403-7ca6-9674-07d8999ef347` |
| `error_tracking` | `issue_created` | **Enabled** | `01a007ce-f53d-7923-ba26-31d2bcf9106a` |
| `error_tracking` | `issue_reopened` | **Enabled** | `01a007ce-f7e0-76a8-8d14-0a02d21e8ab6` |
| `error_tracking` | `issue_spiking` | **Enabled** | `01a007ce-fb22-7ac0-bc85-fc296aa11f99` |
| `session_replay` | `session_analysis_cluster` | **Enabled** (sample rate 0.1) | `01a007ce-fdd2-78dd-87fd-9924fb6f14d2` |
| `conversations` | `ticket` | **Enabled** (dormant until a Conversations channel is connected) | `01a007cf-0069-7439-9449-0aa98707196f` |
| `replay_vision` | — | **Self-authorizing** — `emits_signals` on each scanner is the per-source config; no row needed | — |

---

## Connected tools

No external issue trackers, error trackers, or support tools were selected.

| Tool | Status |
|---|---|
| GitHub Issues | Not used (not selected) |
| Linear, Jira, Sentry, Zendesk, others | Not used (not selected) |

---

## Scout troop

**Run budget:** 100 runs/day (early-access default). 0 runs used today. Max 3 per tick. Banner: _"Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."_

**Enabled (5):**

| Scout | Watches |
|---|---|
| `signals-scout-general` | Cross-product correlations and surfaces no specialist covers |
| `signals-scout-product-analytics` | Funnels, retention, and lifecycle for conversion/retention regressions on saved insights |
| `signals-scout-health-checks` | PostHog instrumentation health — missing events, proxy gaps, outdated SDKs |
| `signals-scout-web-analytics` | Per-channel session volume, attribution breakage, and landing-page health |
| `signals-scout-observability-gaps` | Significant event volumes with no insight, dashboard, or alert coverage |

**Disabled (22):** All other canonical scouts. Key re-enable follow-ups:

| Scout | Re-enable when |
|---|---|
| `signals-scout-error-tracking` | **Covered by the native source** — intentionally off |
| `signals-scout-session-replay` | **Covered by the native source** — intentionally off |
| `signals-scout-feature-flags` | PostHog feature flags are used (current flags are env-var based, not PostHog SDK flags) |
| `signals-scout-ai-observability` | `$ai_*` LLM events are instrumented (Anthropic SDK is present but not yet tracked) |
| `signals-scout-experiments` | A/B experiments are created in PostHog |
| `signals-scout-surveys` | PostHog surveys are created and active |
| `signals-scout-revenue-analytics` | Revenue / payment data is connected |
| `signals-scout-logs` | PostHog logs product is in use |
| Others | Enable as needed from the inbox |

---

## Custom scouts

Two custom scouts created, both enabled and emitting (daily interval):

### `signals-scout-session-loop-health`

- **Watches:** `session_completed` event volume, week-over-week, per active user
- **Discriminator:** Rolling 7-day session count drops >30% vs prior 7 days, or distinct active users decline
- **Why no built-in covers it:** `signals-scout-product-analytics` only watches saved funnel/retention insights — no such insights exist yet. This scout reads raw event health directly.
- **Config id:** `01a007db-2cab-79d2-824e-adb6a3a2be4f`

### `signals-scout-social-activation`

- **Watches:** `invite_sent` → `friend_added` conversion rate and invite volume silence
- **Discriminator:** Conversion rate below 30% with ≥2 invites, or sudden volume drop from ≥3/week to 0
- **Why no built-in covers it:** No built-in scout watches this product-specific funnel. The social layer is live with ~5 real beta users.
- **Config id:** `01a007db-3ae7-76aa-9590-68aca8474961`

**Surfaces considered and ruled out:**

| Surface | Ruled out by |
|---|---|
| Habit consistency (`habit_checked` per user) | Too noisy at 5-user scale — individual absences look like trends |
| Google Calendar integration health | No calendar error events captured — not watchable from PostHog data |
| Onboarding completion rate | 5 total users — not statistically meaningful |
| Weekly recap engagement | No recap engagement events captured |

**Noise escape hatch:** set `emit: false` on a scout's config in PostHog (inbox → scout settings) to switch it to dry-run mode — it runs and logs but writes nothing to the inbox.

---

## Replay Vision scanners

Replay Vision scanners are LLMs that watch individual session recordings on a schedule and push what they find into the Self-driving inbox. Findings arrive at half weight and need corroboration before being promoted into a full report. These scanners are the only part of this setup that spends Replay Vision quota.

**Note:** `disable_session_recording: true` is currently set in `posthog-init.tsx`, so no recordings are being created. Both scanners are armed and will start working the day recordings begin. The credit estimation tool was not available on this deploy — spend was not verified but these are conservatively scoped.

| Scanner | Query scope | Sampling | Model | Status | Monthly credits (est.) |
|---|---|---|---|---|---|
| Broken experiences | `$current_url` icontains `/clock` (full clock module: `/clock`, `/clock/live`, `/clock/finish`) | 0.5 | gemini-3.7-flash | **Created** — id `01a007dc-33ee-7312-8ea0-c1cf61865fee` | 0 (no recordings yet) |
| User frustration | Sessions containing a `$rageclick` event (anywhere in the app) | 1.0 | gemini-3.7-flash | **Created** — id `01a007dc-44a5-7242-b7e2-84d2825606dd` | 0 (no recordings yet) |

**Why `/clock` is the key completion flow:** The clock module (`/clock/live` = session in progress, `/clock/finish` = session completed) is where `session_completed` fires — Progra's primary product action. A defect here means users fail to record work time, the app's core value.

**Query independence:** Scanner 1 filters by URL (`/clock` icontains); Scanner 2 filters by the `$rageclick` event across all URLs. They are disjoint by design — a session with rage clicks inside the clock flow will be matched by both, but that narrow overlap (rage clicks are a small slice) is acceptable at these sampling rates.

---

## Follow-ups

- [ ] **Enable Session Replay** — Go to PostHog Settings → Session replay → "Record user sessions". Then decide whether to remove `disable_session_recording: true` from `components/posthog-init.tsx:62`. **Note:** this flag was set intentionally because the app shows other users' social content (friends' names, habit lists, session notes). Enabling replay is a privacy-policy decision, not just a config flip.
- [ ] **Enable Error Tracking** — PostHog Settings → Error tracking → "Enable exception autocapture".
- [ ] **Enable Support / Conversations** — product sidebar → Conversations, then connect an inbound channel (email / inbox / Slack). The `conversations/ticket` source row is already enabled and will start receiving tickets automatically once a channel exists.
- [ ] **Connect an issue tracker** — if you adopt Linear, Jira, or GitHub Issues, connect it via the [data warehouse pipeline](https://us.posthog.com/project/560043/pipeline/new/source) and enable its responder row in the inbox.
- [ ] **Instrument `$ai_*` events** — the `@anthropic-ai/sdk` package is present. Once LLM calls are instrumented with PostHog's AI analytics, enable `signals-scout-ai-observability`.
- [ ] **Enable PostHog feature flags** — currently `SOCIAL_ENABLED` is an env-var flag, not a PostHog flag. Moving it (or new flags) to PostHog unlocks `signals-scout-feature-flags`.
- [ ] **Build saved insights** — the `signals-scout-product-analytics` scout watches saved funnel/retention/lifecycle insights. Create a session-completion funnel and a weekly retention insight in PostHog to give it something to watch.

---

## What happens next

- The scout coordinator picks up fresh configs within ~30 minutes. First scans fire on the next tick.
- Each scout run draws from the project's daily budget (100 runs/day, 3 per tick).
- Findings cluster into reports in the inbox; immediately-actionable ones can start coding tasks automatically (Self-driving opens a draft PR, $15 each — you approved the troop, which controls what gets surfaced).
- Replay Vision scanners start working the day recordings begin.

[View your Self-driving inbox →](https://us.posthog.com/project/560043/inbox)
