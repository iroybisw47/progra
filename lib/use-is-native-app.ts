"use client";

import { useSyncExternalStore } from "react";

import { isNativeApp } from "@/lib/native";

// Never changes: whether we're in the shell is fixed for the document's life.
const subscribeNever = () => () => {};

// Reading isNativeApp() straight in render would be a HYDRATION MISMATCH. Pages
// are server-rendered (the shell loads progra.world), where isNativeApp() is
// false, so the server emits the web variant while the native client wants the
// other one — React 19 errors on that and re-renders the subtree.
//
// useSyncExternalStore is the fix React provides for exactly this: it uses the
// server snapshot during SSR *and* hydration, then swaps to the client snapshot
// immediately after. The alternative — useState(false) + useEffect(setTrue),
// the shape AddToHomeHint uses — works too but trips
// react-hooks/set-state-in-effect, and this repo's lint baseline of 10 must not
// grow.
export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribeNever, isNativeApp, () => false);
}
