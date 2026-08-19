import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// `server-only` throws on import outside a React Server Component graph, which
// is the whole point of it — stub it so the loader itself can be unit-tested.
vi.mock("server-only", () => ({}));

const { loadSharp } = await import("@/lib/images/sharp");

describe("loadSharp", () => {
  it("returns the module's default export when the import resolves", async () => {
    const fake = (() => {}) as unknown as typeof import("sharp").default;
    const out = await loadSharp(async () => ({ default: fake }) as never);
    expect(out).toEqual({ ok: true, sharp: fake });
  });

  // The bug this file exists for: on 2026-08-19 the deployed bundle was missing
  // libvips, so importing sharp threw — and because Next puts every server
  // action for a route in one module, that 500'd clock-in and the whole
  // onboarding wizard. A rejected import must come back as a value.
  it("returns an error instead of throwing when the import fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await loadSharp(async () => {
      throw new Error("ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3");
    });
    expect(out).toEqual({ error: "Photo uploads are temporarily unavailable." });
    // Loud in the server log — an infrastructure fault has to be findable.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("treats a module with no callable default as unavailable", async () => {
    const out = await loadSharp(async () => ({}) as never);
    expect(out).toEqual({ error: "Photo uploads are temporarily unavailable." });
  });

  it("keeps the load failure distinct from a bad image file", async () => {
    const out = await loadSharp(async () => {
      throw new Error("nope");
    });
    // "Couldn't process that image." is the actions' message for a broken
    // upload; saying it when the server is what's broken sends people off
    // retrying with other photos.
    expect(out).not.toEqual({ error: "Couldn't process that image." });
  });
});

// Nothing at a call site reveals this invariant, and no lint rule covers it, so
// it's asserted here: a module-scope `import sharp from "sharp"` in an action
// file re-creates the outage, because the throw happens while the route's
// shared actions module is being evaluated — before any action body runs.
describe("the image actions never import sharp at module scope", () => {
  const root = path.join(import.meta.dirname, "..", "..");
  const files = ["app/actions/avatar.ts", "app/actions/session-photos.ts"];

  for (const file of files) {
    it(file, () => {
      const src = readFileSync(path.join(root, file), "utf8");
      expect(src).not.toMatch(/^\s*import\s+.*\bfrom\s+["']sharp["']/m);
      expect(src).toContain("loadSharp");
    });
  }
});
