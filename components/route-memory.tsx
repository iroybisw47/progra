"use client";

import { usePathname } from "next/navigation";

import { recordRoute } from "@/lib/last-route";

// Records the current path into the lib/last-route singleton, so a bug report
// filed from /settings can name the screen the user actually came from.
//
// Writes during render rather than in an effect: the target is a module
// variable, not state, so there is nothing to re-render and nothing for
// react-hooks/set-state-in-effect to flag. Strict Mode's double render is
// harmless — recordRoute ignores a repeat of the path it already holds.
//
// Renders nothing.
export function RouteMemory() {
  recordRoute(usePathname());
  return null;
}
