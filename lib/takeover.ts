import { useLayoutEffect, useSyncExternalStore } from "react";

// A full-screen takeover — the weekly review (RECAP_V2) rendered IN PLACE of
// Progress at "/" — tells the root layout's modals to wait.
//
// Why it's needed: WhatsNewModal shows on pathname "/" and PlanCompleteModal
// anywhere, and both live in the root layout, a tree the page can't pass props
// to. With the review drawn at "/", either would open on top of it. Deferring
// is all they need to do: each one is still owed, so it opens on the next
// render after the takeover is gone.
//
// Registered in a LAYOUT effect, which runs before the browser paints, and
// read through useSyncExternalStore, whose updates from a layout effect are
// flushed synchronously — so a modal never gets a frame on screen over it,
// even on the hydration pass where the server snapshot (false) is used first.

let active = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Hold the screen while mounted.
export function useTakeover(): void {
  useLayoutEffect(() => {
    active += 1;
    emit();
    return () => {
      active -= 1;
      emit();
    };
  }, []);
}

// Whether something is holding the screen.
export function useTakeoverActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active > 0,
    () => false
  );
}
