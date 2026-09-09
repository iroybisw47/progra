# The App Review demo account

Apple's Guideline 2.1(a) rejection (2026-09-09) asked for credentials a reviewer
can type, on an account with **pre-populated content — Friends specifically**.
This is how that account is built and, more importantly, **reset before each
submission**.

_Placeholders below: fill in once and keep this file current._

| | |
|---|---|
| Reviewer email | `<REVIEWER EMAIL>` |
| Reviewer password | `<REVIEWER PASSWORD>` — also in ASC → App Review Information → Sign-In Information |
| Reviewer handle | `@<REVIEWER HANDLE>` |
| Demo friend A | `<A EMAIL>` / `@<A HANDLE>` |
| Demo friend B | `<B EMAIL>` / `@<B HANDLE>` |

---

## Why the data is built through the app, not SQL

The schema is not in the repo (see AGENTS.md), the database has real beta users
on it, and session photos go to a private bucket through a service-role upload
path that would have to be reproduced by hand. Driving the real UI writes every
row through the real code paths — right columns, right RLS, right revalidation,
nothing guessed.

Only two things genuinely cannot be done through the UI, and they are the SQL at
the bottom.

---

## Creating an account

Supabase → **Authentication → Users → Add user**:

- email + password
- **Auto Confirm User ticked** — without it `email_confirmed_at` stays null and
  sign-in fails with the deliberately vague "email and password don't match"
- the `zz_claim_beta_seat` trigger seats it automatically (3 seats of 250)

Email addresses need not be deliverable. Nothing is ever sent to them: there is
no confirmation mail, and no password-reset flow exists. Use a domain you own
anyway, so a setting flipped later bounces at your own domain.

**Practical tip:** now that email sign-in exists, build all of this in a desktop
browser using separate private windows — one account per window, all signed in
at once. That beats juggling Google and Apple identities on a phone.

---

## Build order (dependencies are real)

Friend-read RLS means A and B cannot see the reviewer's sessions until the
friendship is **accepted**, and cannot comment on sessions that do not exist yet.
So:

1. **Create A and B** in the dashboard.
2. **As A:** complete onboarding, clock 3–4 sessions across different days, add a
   goal, add habits and tick some days. Set a display name, bio and avatar — a
   blank profile in the feed looks broken.
3. **As B:** the same.
4. **As the reviewer:** complete onboarding, clock 3–4 sessions, attach a photo
   to at least one (this is also the only way photos get into the bucket).
5. **Friend requests:** from A → reviewer, B → reviewer, and from your own real
   account → reviewer. Accept all three as the reviewer.
6. *(Optional)* a 4th account sending a request left **unaccepted**, so the
   Friends tab shows the incoming-request state.
7. **As A and B:** react and comment on the reviewer's sessions, so Feed and the
   session detail screen both have content.

---

## Then the two SQL statements

Run in the Supabase SQL editor. Both scoped to the reviewer only.

```sql
-- 1. Send the reviewer back through onboarding.
--    RE-RUN THIS BEFORE EVERY SUBMISSION — see below.
update public.profiles
set onboarded_at = null
where username = '<REVIEWER HANDLE>';

-- 2. Backdate signup so the weekly recap unlocks.
--    lib/db/progress.ts:106 computes recapWeekExisted = recapWeekEndMs >= createdMs,
--    so an account created this week can never see last week's recap, no matter
--    how much data it has.
update auth.users
set created_at = now() - interval '30 days'
where email = '<REVIEWER EMAIL>';
```

You may also want to shift a few session timestamps into last week, so the recap
has something to summarise rather than unlocking onto an empty week.

---

## The reset, before every resubmission

Onboarding runs once. The first reviewer to complete it sets `onboarded_at`, and
the next reviewer skips straight into the app — so the "walk through onboarding"
experience is consumed by whoever looks first.

Re-run **statement 1** before each submission.

Note that each pass leaves behind the goal and habit onboarding creates, so
duplicates accumulate. Harmless, but tidy them occasionally:

```sql
-- Inspect first; delete only what onboarding duplicated.
select id, title, created_at from public.goals
where user_id = (select id from auth.users where email = '<REVIEWER EMAIL>')
order by created_at desc;
```

---

## App Store Connect

- **App Review Information → Sign-In Information**: tick "Sign-in required",
  fill Username and Password.
- Update the Notes: `docs/app-review-notes-paste.txt` still says no demo account
  is possible. That is now false, and leaving the contradiction is its own
  rejection.
- Say the account is pre-friended, so Feed and Friends are populated on arrival.
