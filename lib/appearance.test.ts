import { describe, expect, it } from "vitest";

import {
  APPEARANCE_KEY,
  APPEARANCE_SCRIPT,
  THEME_COLOR,
  appearancePrefFor,
  resolveTheme,
  statusBarTextFor,
  type AppearancePref,
} from "@/lib/appearance";

describe("appearancePrefFor", () => {
  it("defaults to system when nothing, or nothing valid, is stored", () => {
    for (const stored of [null, "", "auto", "DARK", '{"dark":true}']) {
      expect(appearancePrefFor(stored)).toBe("system");
    }
  });

  it("reads an explicit choice", () => {
    expect(appearancePrefFor("light")).toBe("light");
    expect(appearancePrefFor("dark")).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("follows the phone only while the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("statusBarTextFor", () => {
  // "default" already follows the phone, which is what System follows too.
  it("leaves the status bar on default for system", () => {
    expect(statusBarTextFor("system", "dark")).toBe("default");
    expect(statusBarTextFor("system", "light")).toBe("default");
  });

  it("names the text when a manual choice may disagree with the phone", () => {
    expect(statusBarTextFor("dark", "dark")).toBe("light");
    expect(statusBarTextFor("light", "light")).toBe("dark");
  });
});

// The head script is a string that runs before any bundle, so it can't call
// the functions above. Run it against a fake page and hold it to the same
// decision for every stored value and both system appearances.
function runScript(stored: string | null, systemDark: boolean, storageThrows = false) {
  const classes = new Set<string>();
  const metas = [{ content: "" }, { content: "" }];
  const document = {
    documentElement: {
      classList: {
        toggle: (name: string, on: boolean) => {
          if (on) classes.add(name);
          else classes.delete(name);
        },
      },
    },
    querySelectorAll: () =>
      metas.map((m) => ({
        setAttribute: (_: string, v: string) => {
          m.content = v;
        },
      })),
  };
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error("private mode");
      return key === APPEARANCE_KEY ? stored : null;
    },
  };
  const matchMedia = () => ({ matches: systemDark });
  const window = { matchMedia };
  new Function("document", "localStorage", "matchMedia", "window", APPEARANCE_SCRIPT)(
    document,
    localStorage,
    matchMedia,
    window
  );
  return { dark: classes.has("dark"), metas: metas.map((m) => m.content) };
}

describe("APPEARANCE_SCRIPT", () => {
  for (const stored of [null, "system", "light", "dark", "junk"]) {
    for (const systemDark of [false, true]) {
      it(`matches resolveTheme for ${String(stored)} on a ${systemDark ? "dark" : "light"} phone`, () => {
        const theme = resolveTheme(appearancePrefFor(stored) as AppearancePref, systemDark);
        const out = runScript(stored, systemDark);
        expect(out.dark).toBe(theme === "dark");
        expect(out.metas).toEqual([THEME_COLOR[theme], THEME_COLOR[theme]]);
      });
    }
  }

  it("falls back to the phone when storage throws", () => {
    expect(runScript(null, true, true).dark).toBe(true);
    expect(runScript(null, false, true).dark).toBe(false);
  });
});
