import { beforeEach, describe, expect, it } from "vitest";

import {
  getReportRoute,
  recordRoute,
  resetRouteMemoryForTest,
} from "@/lib/last-route";

describe("getReportRoute", () => {
  beforeEach(() => {
    resetRouteMemoryForTest();
  });

  it("is null before any navigation", () => {
    expect(getReportRoute()).toBeNull();
  });

  // The whole reason this module exists: filing happens on /settings, but the
  // bug happened on the screen before it.
  it("reports the previous screen when filing from /settings", () => {
    recordRoute("/clock");
    recordRoute("/settings");
    expect(getReportRoute()).toBe("/clock");
  });

  it("reports the current screen when filing from anywhere else", () => {
    recordRoute("/settings");
    recordRoute("/clock");
    expect(getReportRoute()).toBe("/clock");
  });

  // A re-render of the same route must not shift history, or arriving at
  // /settings and re-rendering would report /settings as the previous screen.
  it("ignores repeated identical paths", () => {
    recordRoute("/clock");
    recordRoute("/settings");
    recordRoute("/settings");
    recordRoute("/settings");
    expect(getReportRoute()).toBe("/clock");
  });

  it("is null when /settings is the very first screen seen", () => {
    recordRoute("/settings");
    expect(getReportRoute()).toBeNull();
  });

  it("follows a multi-step path back to the immediately previous screen", () => {
    recordRoute("/");
    recordRoute("/clock");
    recordRoute("/goals");
    recordRoute("/settings");
    expect(getReportRoute()).toBe("/goals");
  });
});
