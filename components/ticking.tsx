"use client";

import type { ReactNode } from "react";

import { useNow } from "@/lib/hooks";

// The per-second render surface. Wrap only the JSX that displays seconds in
// <Ticking> and keep the parent off useNow — then the 1s tick re-renders just
// this leaf, not the whole screen. `now` is 0 during SSR (useNow convention);
// call sites keep their own fallback handling inside the closure.
export function Ticking({
  children,
}: {
  children: (now: number) => ReactNode;
}) {
  const now = useNow();
  return <>{children(now)}</>;
}
