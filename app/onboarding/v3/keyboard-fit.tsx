"use client";

import { useEffect, useLayoutEffect, useReducer, useRef } from "react";

import { useKeyboardInset } from "@/lib/hooks";
import { ctaLift } from "@/lib/keyboard";

import { CTA_REST_BOTTOM } from "./frame";

// Where the CTA's top edge is with the keyboard as it is now, for a screen
// whose own field has to stay clear of it. The CTA, and anything riding up
// with it, is laid out for the handoff's 852pt frame (R:20, R:94), where the
// keyboard leaves plenty of room. On a shorter phone (an iPhone SE is 667pt)
// the lifted CTA and Screen 2's example chips land on the field being typed
// into, and iOS won't pan to reveal it, because it's still inside the visual
// viewport (P4 review). The screens use this to move out of the way.
export type CtaEdge = {
  // px from the top of the screen's section, keyboard included. With no
  // keyboard up it's the CTA's resting top with `atRest`, and Infinity
  // without, when nothing is measured.
  top: number;
  // How far the keyboard has lifted it: 0 with the keyboard down.
  lift: number;
};

// Render inside a screen's section (at the top level of the screen, so the
// section is its offsetParent). It measures an invisible stand-in for the
// CTA's resting box, positioned exactly as the CTA is (onboarding-cta.tsx),
// and reports the edge after every render: when the keyboard opens, closes or
// pans, and whenever the screen re-renders, so a field that moved (a goal
// added) is measured again. Layout offsets ignore transforms, so the lift's
// own transition and anything the screen moves in response never feed back
// into the numbers. With no keyboard up it reads nothing (unless `atRest`),
// so a screen re-rendering every 20ms (an example typing itself in) forces
// no layout.
//
// `atRest` measures with the keyboard down as well, for a screen whose
// layout can run into the resting CTA on a very short screen (Screen 2's
// example chips, on an SE in Safari), at the cost of a layout read on each
// of its renders. It then also measures again when the window is resized,
// which with no keyboard up changes nothing useKeyboardInset reports. A
// screen passes it only while it's in front, so the five behind it read no
// layout.
//
// A leaf because useKeyboardInset re-renders whatever calls it on every
// keyboard change (lib/hooks.ts). Only this re-renders, and `onMeasure` only
// sets state that changed, so the screen re-renders only when its layout has
// to.
export function KeyboardFit({
  onMeasure,
  atRest = false,
}: {
  onMeasure: (cta: CtaEdge) => void;
  atRest?: boolean;
}) {
  const inset = useKeyboardInset();
  const probe = useRef<HTMLSpanElement>(null);
  const [, remeasure] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!atRest) return;
    window.addEventListener("resize", remeasure);
    return () => window.removeEventListener("resize", remeasure);
  }, [atRest]);
  useLayoutEffect(() => {
    if (inset === 0 && !atRest) {
      onMeasure({ top: Number.POSITIVE_INFINITY, lift: 0 });
      return;
    }
    const el = probe.current;
    const section = el?.offsetParent;
    if (!el || !(section instanceof HTMLElement)) return;
    const restTop = el.offsetTop;
    const lift = ctaLift(inset, section.clientHeight - restTop - el.offsetHeight);
    onMeasure({ top: restTop - lift, lift });
  });
  return (
    <span
      ref={probe}
      aria-hidden
      className="pointer-events-none invisible absolute inset-x-0 h-[52px]"
      style={{ bottom: CTA_REST_BOTTOM }}
    />
  );
}

// `el`'s layout top in `root`'s coordinates, transforms ignored, or NaN if
// `root` isn't among its offset parents.
export function layoutTopWithin(el: HTMLElement, root: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    y += node.offsetTop;
    const parent: Element | null = node.offsetParent;
    node = parent instanceof HTMLElement ? parent : null;
  }
  return node === root ? y : Number.NaN;
}
