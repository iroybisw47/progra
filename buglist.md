# Bug list

Running list of known bugs to fix. Newest first. Not yet triaged or worked on
unless noted.

---

## 2026-09-13 — See everyone's goals, not just friends

**Status:** open — feature request, needs a scope decision before any code

**Ask:** Be able to see every user's goals on login, without being friends
with them.

**Two readings, very different work:**
1. *Admin-only visibility* — you (and only you) can see all goals, via the
   existing admin surface. Fits the sanctioned pattern: an `is_admin()`-gated
   `SECURITY DEFINER` RPC alongside the ones in `app/actions/admin.ts`. No
   change to what other users can see.
2. *Product change* — goals become public to all signed-in users. This
   rewrites the RLS policy behind `lib/db/goals.ts` for everyone.

**Flag before building #2:** there are ~5 real beta users whose goals are
currently private-by-default under `auth.uid()` scoping. Making them visible
to all logged-in users is a user-facing privacy change to other people's
data, not just a feature toggle — it wants a heads-up to those users (or an
opt-in/visibility setting) rather than a silent policy swap. Per AGENTS.md,
any RLS edit here is a production change and has to be proven on a branch
with the adversarial JWT test first.

**Recommendation:** if the goal is "I want to see what people are up to,"
#1 gets you that today with no privacy blast radius. #2 is the real product
decision.

---

## 2026-09-13 — Share-invite link points at the website, not the app

**Status:** open, not investigated

**Repro:** Use the share/invite flow. The link it hands out goes to the
progra.world website.

**Expected:** It should send the recipient to the app.

**Open question:** "App link" could mean the App Store listing (so a new
person installs) or a universal/deep link that opens the installed app and
falls back to the store. Confirm which before implementing — it may need to
be both, branching on whether the app is installed.

---

## 2026-09-13 — Pinch-zoom is possible inside the app

**Status:** open, not investigated

**Repro:** Pinch or double-tap anywhere in the app — the whole page scales in
and out like a web page.

**Expected:** The app should feel native — no user zoom at all.

**Notes:** Almost certainly the viewport meta / Capacitor webview config
allowing user scaling. Check both the web and native shells.

---

## 2026-09-13 — Flash of "page doesn't load" on first app open

**Status:** open, not investigated

**Repro:** Cold-open the Progra app. For roughly one second an error /
"page doesn't load" state shows, then the app resolves to the normal screen.

**Expected:** No error state should ever flash — it should go straight to a
loading state (or the real screen) and never render the failure UI.

**Notes:** Only on first load in; subsequent navigation looks fine. Likely an
error/empty state rendering before auth or the initial server read settles.
