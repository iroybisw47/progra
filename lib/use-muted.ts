"use client";

import { useSyncExternalStore } from "react";

import {
  isTimerSoundMuted,
  subscribeTimerSoundMuted,
} from "@/lib/timer-sound";

// Whether timer cues are muted on THIS device.
//
// useSyncExternalStore, not useState + useEffect, for two reasons that have
// each already bitten this codebase once:
//
//   1. The server can't know a localStorage value, so rendering the icon from
//      it directly is a hydration mismatch — the same class of bug as calling
//      isNativeApp() during render.
//   2. The useState + useEffect alternative trips
//      react-hooks/set-state-in-effect, and the lint baseline of 10 is a gate.
//
// The server snapshot is `false` (un-muted), which is also the first client
// render, so hydration matches and the real value swaps in immediately after.
export function useTimerSoundMuted(): boolean {
  return useSyncExternalStore(
    subscribeTimerSoundMuted,
    isTimerSoundMuted,
    () => false
  );
}
