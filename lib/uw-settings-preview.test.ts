import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_LATENCY_MS } from "@/lib/onboarding-v3-preview";
import { uwBlockSaveInput, uwBlockState } from "@/lib/uw-fields";
import {
  PREVIEW_SAVE_ERROR,
  UW_SETTINGS_FIXTURES,
  createUwSettingsPreviewSave,
  parseUwSettingsParams,
  previewStoredRow,
  uwSettingsSaved,
} from "@/lib/uw-settings-preview";

describe("parseUwSettingsParams", () => {
  it("reads a known fixture and falls back to member", () => {
    expect(parseUwSettingsParams({ fixture: "new" })).toEqual({ fixture: "new", fail: false });
    expect(parseUwSettingsParams({ fixture: "nope" }).fixture).toBe("member");
    expect(parseUwSettingsParams({}).fixture).toBe("member");
    expect(parseUwSettingsParams({ fixture: ["unlisted", "new"] }).fixture).toBe("unlisted");
  });

  it("fails saves only for save=fail", () => {
    expect(parseUwSettingsParams({ save: "fail" }).fail).toBe(true);
    expect(parseUwSettingsParams({ save: "ok" }).fail).toBe(false);
  });
});

describe("the fixtures", () => {
  it("are the three the harness promises", () => {
    expect(UW_SETTINGS_FIXTURES).toEqual(["member", "unlisted", "new"]);
    expect(uwSettingsSaved("member")).toMatchObject({ isUw: true, listed: true });
    expect(uwSettingsSaved("member").majors).toHaveLength(2);
    expect(uwSettingsSaved("member").interests).toHaveLength(3);
    expect(uwSettingsSaved("unlisted")).toMatchObject({ isUw: true, listed: false });
    expect(uwSettingsSaved("new")).toEqual({ isUw: false, majors: [], interests: [], listed: false });
  });

  it("hold only what the real cleaners would have stored", () => {
    for (const f of UW_SETTINGS_FIXTURES) {
      const saved = uwSettingsSaved(f);
      expect(previewStoredRow(uwBlockSaveInput(uwBlockState(saved)))?.saved).toEqual(saved);
    }
  });
});

describe("previewStoredRow", () => {
  it("reads a leave back as out of the cohort, with nothing kept", () => {
    expect(previewStoredRow({ isUw: false })?.saved).toEqual({
      isUw: false,
      majors: [],
      interests: [],
      listed: false,
    });
  });

  it("is null for an input the action refuses", () => {
    expect(previewStoredRow({} as never)).toBeNull();
  });
});

describe("createUwSettingsPreviewSave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("answers ok after the latency", async () => {
    const save = createUwSettingsPreviewSave();
    const answer = save({ isUw: false });
    await vi.advanceTimersByTimeAsync(PREVIEW_LATENCY_MS);
    await expect(answer).resolves.toEqual({ ok: true });
  });

  it("answers the action's error when told to fail", async () => {
    const save = createUwSettingsPreviewSave({ fail: true, latencyMs: 0 });
    const answer = save({ isUw: true, majors: [], interests: [], listed: false });
    await vi.advanceTimersByTimeAsync(0);
    await expect(answer).resolves.toEqual({ error: PREVIEW_SAVE_ERROR });
  });
});
