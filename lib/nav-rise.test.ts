import { describe, expect, it } from "vitest";

import {
  NAV_RISE_KEY,
  NAV_RISE_TTL_MS,
  isFreshNavRise,
  markNavRise,
  navRiseElapsed,
  takeNavRise,
  type FlagStore,
} from "@/lib/nav-rise";

// An in-memory sessionStorage, optionally throwing on one method.
function fakeStore(throwOn?: keyof FlagStore): FlagStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  const guard = (method: keyof FlagStore) => {
    if (method === throwOn) throw new Error("SecurityError");
  };
  return {
    data,
    getItem: (k) => {
      guard("getItem");
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      guard("setItem");
      data.set(k, v);
    },
    removeItem: (k) => {
      guard("removeItem");
      data.delete(k);
    },
  };
}

describe("isFreshNavRise", () => {
  it("is fresh within the TTL, either side of now", () => {
    expect(isFreshNavRise("1000", 1000)).toBe(true);
    expect(isFreshNavRise("1000", 1000 + NAV_RISE_TTL_MS)).toBe(true);
    expect(isFreshNavRise("1000", 1000 - 500)).toBe(true);
  });

  it("is stale past the TTL", () => {
    expect(isFreshNavRise("1000", 1001 + NAV_RISE_TTL_MS)).toBe(false);
  });

  it("ignores no flag and garbage", () => {
    expect(isFreshNavRise(null, 1000)).toBe(false);
    expect(isFreshNavRise("", 0)).toBe(false);
    expect(isFreshNavRise("  ", 0)).toBe(false);
    expect(isFreshNavRise("yes", 1000)).toBe(false);
    expect(isFreshNavRise("NaN", 1000)).toBe(false);
  });
});

describe("markNavRise / takeNavRise", () => {
  it("rises once per mark, giving the tap's time: the take consumes the flag", () => {
    const store = fakeStore();
    markNavRise(store, 5000);
    expect(store.data.get(NAV_RISE_KEY)).toBe("5000");
    expect(takeNavRise(store, 5200)).toBe(5000);
    expect(store.data.has(NAV_RISE_KEY)).toBe(false);
    expect(takeNavRise(store, 5300)).toBeNull();
  });

  it("doesn't rise without a mark, and changes nothing", () => {
    const store = fakeStore();
    expect(takeNavRise(store, 5000)).toBeNull();
    expect(store.data.size).toBe(0);
  });

  it("clears a stale flag without rising", () => {
    const store = fakeStore();
    markNavRise(store, 0);
    expect(takeNavRise(store, NAV_RISE_TTL_MS + 1)).toBeNull();
    expect(store.data.has(NAV_RISE_KEY)).toBe(false);
  });

  it("does nothing at all without a store", () => {
    expect(() => markNavRise(null, 1)).not.toThrow();
    expect(takeNavRise(null, 1)).toBeNull();
  });

  it("never throws when the store does", () => {
    expect(() => markNavRise(fakeStore("setItem"), 1)).not.toThrow();
    expect(takeNavRise(fakeStore("getItem"), 1)).toBeNull();

    // A flag that can be read but not removed still rises, once the TTL
    // allows.
    const sticky = fakeStore("removeItem");
    sticky.data.set(NAV_RISE_KEY, "10");
    expect(takeNavRise(sticky, 20)).toBe(10);
  });
});

describe("navRiseElapsed", () => {
  it("is the time since the tap for a document loaded before it", () => {
    expect(navRiseElapsed(5000, 5240, 100)).toBe(240);
    expect(navRiseElapsed(5000, 6500, 100)).toBe(1500);
  });

  it("never goes negative when the clock moved back", () => {
    expect(navRiseElapsed(5000, 4900, 100)).toBe(0);
  });

  it("doesn't rise a nav the server painted: the document loaded after the tap", () => {
    expect(navRiseElapsed(5000, 7000, 5600)).toBeNull();
  });
});
