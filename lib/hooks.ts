import { useSyncExternalStore } from "react";

// useNow: ticks once a second so the live clock-in timer stays current.
// Returns 0 during SSR; treat 0 as "not hydrated yet" in components.

let cachedNow: number | null = null;

function subscribeNow(cb: () => void): () => void {
  cachedNow = Date.now();
  cb();
  const id = setInterval(() => {
    cachedNow = Date.now();
    cb();
  }, 1000);
  return () => clearInterval(id);
}

function getNowSnap(): number {
  if (cachedNow === null) cachedNow = Date.now();
  return cachedNow;
}

function getNowServerSnap(): number {
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(subscribeNow, getNowSnap, getNowServerSnap);
}
