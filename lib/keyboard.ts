// How far the on-screen keyboard covers the bottom of the page, from the
// VisualViewport API. Pure, so the arithmetic is unit-tested. The listener is
// useKeyboardInset() in lib/hooks.ts.
//
// Why not a plugin: there is no @capacitor/keyboard in this app, and adding
// one is a native build (plan §6). The shell's WKWebView behaves like Safari.
// The keyboard leaves the LAYOUT viewport (window.innerHeight) alone and
// shrinks the VISUAL viewport, sometimes scrolling it down as well. So the
// strip the keyboard covers is whatever lies between the bottom of the visual
// viewport and the bottom of the layout viewport:
//
//     inset = innerHeight − (visualViewport.offsetTop + visualViewport.height)
//
// That is exactly how far a `position: fixed; bottom: 0` element must rise to
// sit on top of the keyboard, which is the only thing onboarding v3 uses it
// for. Where the browser resizes the layout viewport instead (Android Chrome's
// default), innerHeight shrinks with it, the difference is 0, and the fixed
// shell already fits.
//
// Pinch zoom shrinks the visual viewport too, so on its own the arithmetic
// can't tell "zoomed in" from "a keyboard is up". The root layout's
// maximum-scale=1 rules zoom out in the app shell only: WKWebView honours it,
// but iOS Safari (progra.world in a tab, and the home-screen PWA) has ignored
// it for user pinch since iOS 10 (app/layout.tsx says the same). So any
// visual-viewport scale other than 1 reads as no keyboard, and the CTA stays
// at the bottom rather than rising for a keyboard that isn't there. The same
// maximum-scale=1 still stops Safari's own zoom-on-focus, so opening the
// keyboard from a field doesn't change the scale. All of this stays
// unconfirmed on a device until the P0 spike, which is why the inset is
// clamped and rounded rather than trusted raw.

export type ViewportMetrics = {
  // window.innerHeight: the layout viewport.
  layoutHeight: number;
  // visualViewport.height and .offsetTop: the part the user actually sees.
  visualHeight: number;
  visualOffsetTop: number;
  // visualViewport.scale: 1 unless the page is pinch-zoomed.
  scale: number;
};

// How far from 1 the scale may drift (float noise) and still count as unzoomed.
const SCALE_EPSILON = 0.01;

// The keyboard's cover in whole CSS px, and never negative: iOS's rubber-band
// overscroll can briefly put the visual viewport past the layout one.
// Anything that isn't a number, and any pinch-zoomed page, reads as no
// keyboard (see the header).
export function keyboardInset(m: ViewportMetrics): number {
  if (!(Math.abs(m.scale - 1) <= SCALE_EPSILON)) return 0;
  const gap = m.layoutHeight - (m.visualOffsetTop + m.visualHeight);
  if (!Number.isFinite(gap) || gap <= 0) return 0;
  return Math.round(gap);
}

// The metrics from a window-shaped object, or null where there is no
// VisualViewport (old browsers, and the server, where the caller never gets
// this far). Takes a structural type rather than `Window` so the test can
// pass a plain object.
export function readViewportMetrics(win: {
  innerHeight: number;
  visualViewport?: { height: number; offsetTop: number; scale?: number } | null;
}): ViewportMetrics | null {
  const vv = win.visualViewport;
  if (!vv) return null;
  return {
    layoutHeight: win.innerHeight,
    visualHeight: vv.height,
    visualOffsetTop: vv.offsetTop,
    scale: vv.scale ?? 1,
  };
}

// How far above the keyboard the CTA rests (R:38: "~12px above"). The CTA
// sits at max(safe-area inset, keyboard inset + this) from the bottom
// (plan §6).
export const KEYBOARD_CTA_GAP_PX = 12;

// How far the CTA rises for a keyboard covering `inset` px, when it rests
// `restGap` px above the bottom of the frame: frame.ts's KEYBOARD_LIFT in
// numbers, for a screen that has to know where the CTA ends up so it can
// keep its own field clear of it (onboarding v3 Screens 2 and 3).
export function ctaLift(inset: number, restGap: number): number {
  if (!Number.isFinite(inset) || !Number.isFinite(restGap)) return 0;
  return Math.max(0, Math.round(inset + KEYBOARD_CTA_GAP_PX - restGap));
}

// How far something whose bottom edge is at `bottom` runs into something
// whose top edge is at `top`, keeping `gap` between them: 0 when it clears,
// otherwise whole px, rounded up so the gap is never short.
export function overlapPx(bottom: number, top: number, gap = 0): number {
  if (!Number.isFinite(bottom) || !Number.isFinite(top)) return 0;
  return Math.max(0, Math.ceil(bottom + gap - top));
}

// Whether a keydown belongs to an IME composition (Japanese, Chinese,
// Korean). WebKit, so Safari and the app's WKWebView, fires the keydown for
// the Return that confirms a conversion AFTER compositionend, with
// isComposing false and keyCode 229. Checking isComposing alone lets that
// Return through as "add this" or "continue" with the text half-converted.
// Takes the native event's two fields, so the test can pass a plain object.
export function isImeKeyDown(e: { isComposing?: boolean; keyCode?: number }): boolean {
  return e.isComposing === true || e.keyCode === 229;
}
