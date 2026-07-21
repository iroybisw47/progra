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

function getMinuteSnap(): number {
  return Math.floor(getNowSnap() / 60_000) * 60_000;
}

// useNowMinute: same shared 1s store, but the snapshot is floored to the
// minute — useSyncExternalStore bails out of re-rendering while the snapshot
// is unchanged, so subscribers re-render at most once per minute. For surfaces
// that only need minute/day granularity (totals, day labels, week boundaries);
// keep second-precision timers on useNow in small leaf components.
// Returns 0 during SSR, same "not hydrated yet" convention as useNow.
export function useNowMinute(): number {
  return useSyncExternalStore(subscribeNow, getMinuteSnap, getNowServerSnap);
}
