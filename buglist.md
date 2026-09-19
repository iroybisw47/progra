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

**Status:** FIXED 2026-09-17

**Repro:** Use the share/invite flow. The link it hands out goes to the
progra.world website.

**Expected:** It should send the recipient to the app.

**Resolution — answering this entry's own open question:** the **App Store
listing**, not a universal link. All three invite surfaces now share
`https://apps.apple.com/app/progra/id6798377328` (countryless, so it resolves to
the recipient's own storefront).

**The price, accepted deliberately:** `/i/{username}` was the entire referral
mechanism — it carries the inviter's handle into `claim_invite`, directly when
signed in and via `?ref=` through OAuth when signed out. An App Store URL carries
no handle, so new installs are **not** auto-friended with the inviter and
`profiles.referred_by` stops filling from shares. `/i/{username}` itself is
unchanged, so links already sent keep working and keep attributing; it also
gained a secondary App Store button.

**Still open as a future migration:** universal links — open the installed app,
fall back to the store, keep attribution. Needs an associated-domains
entitlement, an `apple-app-site-association` file, a new binary and App Review,
none of which exist today.

---

## 2026-09-13 — Pinch-zoom is possible inside the app

**Status:** FIXED 2026-09-18

**Repro:** Pinch or double-tap anywhere in the app — the whole page scales in
and out like a web page. The worse version, reported later: you zoom IN and then
cannot zoom back OUT, permanently, until the app is force-quit.

**Expected:** The app should feel native — no user zoom at all.

**This entry's original guess was wrong, and backwards.** It assumed the config
was *allowing* user scaling. In fact the setting meant to PREVENT zoom is what
caused the stuck zoom:

1. `capacitor.config.ts` never set `ios.zoomEnabled`, so Capacitor's default
   stood — `CAPInstanceDescriptor.m:40`, `_zoomingEnabled = NO`.
2. *Because* zooming was "disabled", `CAPBridgeViewController.swift:322-324`
   installed Capacitor as the webview scroll view's delegate.
3. That delegate's entire zoom handling is
   `WebViewDelegationHandler.swift:337-340`:
   `scrollViewWillBeginZooming { scrollView.pinchGestureRecognizer?.isEnabled = false }`
4. That callback fires AFTER zooming has begun, so a scale > 1 is already
   applied; disabling an in-flight recognizer cancels it and freezes `zoomScale`
   there. `pinchGestureRecognizer` appears exactly ONCE in all of Capacitor iOS,
   so nothing ever re-enables it — the recognizer is dead for the webview's
   lifetime. "Sometimes" is how much scale accumulated before the callback fired.

**Likely dominant trigger:** `UIScrollView` fires the same
`scrollViewWillBeginZooming` for PROGRAMMATIC zoom, including iOS auto-zooming a
sub-16px input on focus. The app has 14 such inputs, so a small field may have
been killing the recognizer before anyone pinched at all.

**Fix, in two layers.** `app/layout.tsx`'s viewport gained
`maximumScale: 1, userScalable: false` — with no pinch possible the broken
handler never runs, and this ships to every installed app on a normal deploy
because the shell is a thin webview over progra.world. Then
`ios.zoomEnabled: true` in `capacitor.config.ts` for the next binary: not a
request for zoom, but it stops Capacitor stealing the scroll view delegate, so
any zoom that slips through stays *recoverable* instead of stuck.

**Accepted cost:** no user zoom inside the native app — an accessibility loss,
taken deliberately per this entry's "Expected". iOS Safari ignores
`user-scalable=no`, so progra.world in a browser tab stays zoomable. Whether a
standalone Home Screen PWA also ignores it is **unverified** — reports differ by
iOS version, and it needs a device check.

**Note:** a webview already stuck zoomed is not un-stuck by the deploy — that
recognizer is dead in the running process. Force-quit and reopen once.

---

## 2026-09-13 — Flash of "page doesn't load" on first app open

**Status:** open, not investigated

**Repro:** Cold-open the Progra app. For roughly one second an error /
"page doesn't load" state shows, then the app resolves to the normal screen.

**Expected:** No error state should ever flash — it should go straight to a
loading state (or the real screen) and never render the failure UI.

**Notes:** Only on first load in; subsequent navigation looks fine. Likely an
error/empty state rendering before auth or the initial server read settles.
