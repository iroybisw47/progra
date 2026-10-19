import { describe, expect, it, vi } from "vitest";

import {
  STAMP_ATTEMPTS,
  clockHandoffHref,
  finishesOnboarding,
  onboardingStamper,
  stampOnboarding,
} from "@/lib/clock-handoff";

describe("clockHandoffHref", () => {
  it("opens the Clock tab on the goal, asking for the stamp", () => {
    expect(clockHandoffHref("3f2a9c1e-0b7d-4e55-9a10-2c4b6d8e0f12")).toBe(
      "/clock?goal=3f2a9c1e-0b7d-4e55-9a10-2c4b6d8e0f12&welcome=1"
    );
  });

  it("still finishes onboarding without a goal", () => {
    expect(clockHandoffHref(null)).toBe("/clock?welcome=1");
    expect(clockHandoffHref(undefined)).toBe("/clock?welcome=1");
    expect(clockHandoffHref("")).toBe("/clock?welcome=1");
    expect(clockHandoffHref("   ")).toBe("/clock?welcome=1");
  });

  it("can't be led into another param by the id", () => {
    expect(clockHandoffHref("a&welcome=0")).toBe("/clock?goal=a%26welcome%3D0&welcome=1");
  });
});

describe("finishesOnboarding", () => {
  const on = { enabled: true, onboarded: false };

  it("stamps only for ?welcome=1, with the flag on, on an account not yet onboarded", () => {
    expect(finishesOnboarding({ ...on, welcome: "1" })).toBe(true);
    expect(finishesOnboarding({ ...on, enabled: false, welcome: "1" })).toBe(false);
    expect(finishesOnboarding({ ...on, onboarded: true, welcome: "1" })).toBe(false);
  });

  it("is the plain Clock tab for anything but welcome=1", () => {
    for (const welcome of [undefined, "", "0", "true", "yes", " 1"]) {
      expect(finishesOnboarding({ ...on, welcome })).toBe(false);
    }
  });

  it("reads a repeated param by its first value", () => {
    expect(finishesOnboarding({ ...on, welcome: ["1", "0"] })).toBe(true);
    expect(finishesOnboarding({ ...on, welcome: ["0", "1"] })).toBe(false);
    expect(finishesOnboarding({ ...on, welcome: [] })).toBe(false);
  });
});

describe("stampOnboarding", () => {
  it("stamps once when the first try lands", async () => {
    const complete = vi.fn(async () => ({ ok: true as const }));
    await expect(stampOnboarding(complete)).resolves.toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("tries once more after an error answer", async () => {
    const complete = vi
      .fn<() => Promise<{ ok: true } | { error: string }>>()
      .mockResolvedValueOnce({ error: "Couldn't finish onboarding. Try again." })
      .mockResolvedValueOnce({ ok: true });
    await expect(stampOnboarding(complete)).resolves.toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("tries once more after a throw", async () => {
    const complete = vi
      .fn<() => Promise<{ ok: true } | { error: string }>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true });
    await expect(stampOnboarding(complete)).resolves.toBe(true);
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("gives up quietly after the retry, never more", async () => {
    const complete = vi.fn(async () => ({ error: "nope" }));
    await expect(stampOnboarding(complete)).resolves.toBe(false);
    expect(complete).toHaveBeenCalledTimes(STAMP_ATTEMPTS);
    expect(STAMP_ATTEMPTS).toBe(2);

    const throws = vi.fn(async (): Promise<{ ok: true }> => {
      throw new Error("offline");
    });
    await expect(stampOnboarding(throws)).resolves.toBe(false);
    expect(throws).toHaveBeenCalledTimes(2);
  });
});

describe("onboardingStamper", () => {
  type Answer = { ok: true } | { error: string };

  it("joins a stamp in flight and counts it once", async () => {
    let answer: (r: Answer) => void = () => {};
    const complete = vi.fn(
      () => new Promise<Answer>((resolve) => (answer = resolve))
    );
    const landed = vi.fn();
    const stamp = onboardingStamper(complete, landed);

    const mount = stamp();
    const tap = stamp();
    answer({ ok: true });
    await expect(Promise.all([mount, tap])).resolves.toEqual([true, true]);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it("doesn't write again once one landed", async () => {
    const complete = vi.fn(async (): Promise<Answer> => ({ ok: true }));
    const landed = vi.fn();
    const stamp = onboardingStamper(complete, landed);

    await stamp();
    await expect(stamp()).resolves.toBe(true);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it("tries again on the tap after the mount's tries failed", async () => {
    const complete = vi
      .fn<() => Promise<Answer>>()
      .mockResolvedValueOnce({ error: "nope" })
      .mockResolvedValueOnce({ error: "nope" })
      .mockResolvedValueOnce({ ok: true });
    const landed = vi.fn();
    const stamp = onboardingStamper(complete, landed);

    await expect(stamp()).resolves.toBe(false);
    expect(landed).not.toHaveBeenCalled();
    await expect(stamp()).resolves.toBe(true);
    expect(complete).toHaveBeenCalledTimes(3);
    expect(landed).toHaveBeenCalledTimes(1);
  });
});
