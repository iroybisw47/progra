import type { PointerEvent } from "react";

// Two focus helpers the wizard's screens share (they lived on the old
// Screen 1, identity-screen.tsx, until OWNER-FIX-3 replaced it with the
// welcome).

// Focus without scrolling the fixed shell, caret at the end (P:727).
export function focusField(el: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
    const n = el.value.length;
    el.setSelectionRange(n, n);
  } catch {
    // Some input types refuse setSelectionRange. Focus is what matters.
  }
}

// A tap on a chip keeps the keyboard up, as the CTA does (plan §6). Screens 2
// and 3 put it on their chips and remove buttons.
export const keepFocus = (e: PointerEvent) => e.preventDefault();
