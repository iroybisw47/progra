"use client";

import { useState } from "react";

import { RecapStoryV2, type RecapStoryServices } from "@/components/recap-story/recap-story-v2";
import type { RecapStoryView } from "@/lib/recap-story";

// The client half of /dev/recap-story (page.tsx says what it's for). Fake
// services: nothing is recorded, logged or navigated to — leaving the story
// (the X, Esc, "Start your next session") plays it again from Loading.
export function RecapStoryPreviewClient({
  view,
  startAt,
  still,
  fail,
  insets,
}: {
  view: RecapStoryView;
  startAt: number;
  still: boolean;
  fail: boolean;
  insets: { top: number; bottom: number } | undefined;
}) {
  const [run, setRun] = useState(0);
  const [services] = useState<RecapStoryServices>(() => ({
    markOpened: () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 150)),
    post: () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve(
              fail
                ? { error: "Couldn't post your week. Try again." }
                : { ok: true, recapId: "preview-post", edited: false }
            ),
          400
        )
      ),
    go: () => setRun((n) => n + 1),
    track: () => {},
  }));
  return (
    <RecapStoryV2
      key={run}
      view={view}
      entry="link"
      markOnExit
      services={services}
      startAt={run === 0 ? startAt : 0}
      still={still && run === 0}
      insets={insets}
    />
  );
}
