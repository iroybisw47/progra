import { describe, expect, it } from "vitest";

import { runAction } from "@/lib/run-action";

describe("runAction", () => {
  it("passes a resolved success result straight through", async () => {
    const r = await runAction(Promise.resolve({ ok: true, sessionId: "s1" }));
    expect(r).toEqual({ ok: true, sessionId: "s1" });
  });

  it("passes a resolved `{ error }` result straight through", async () => {
    const r = await runAction(Promise.resolve({ error: "Not authenticated" }));
    expect(r).toEqual({ error: "Not authenticated" });
  });

  it("turns a rejected action into an `{ error }` result", async () => {
    const r = await runAction(Promise.reject(new Error("bad response")));
    expect("error" in r).toBe(true);
  });
});
