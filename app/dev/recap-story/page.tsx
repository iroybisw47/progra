import { notFound } from "next/navigation";

import { buildRecapStory } from "@/lib/recap-story";
import { parseRecapPreviewParams, recapPreviewInput } from "@/lib/recap-story-preview";

import { RecapStoryPreviewClient } from "./recap-story-preview-client";

// Dev-only preview of the weekly review (RECAP_V2) on fixture data — the
// handoff prototype's own sample week — so every frame of its board can be
// photographed beside design_handoff_weekly_recap/screenshots/. Nothing here
// reads or writes your account: the services are fakes, and closing or
// "Start your next session" just plays the story again from the top.
//
//   /dev/recap-story                              the full story, live
//   ?fixture=above|lighter|goals-100|goals-62|best-partial|outside|few
//           |first-week|no-goals|no-habits|solo|quiet|crowd
//   &slide=loading|welcome|hours|where|goals|habits|friends|rank|closing
//   &welcome=1                                    a first review (opens with Welcome)
//   &slide=share&posted=1                         Share on a week already posted
//   &fail=1                                       the post fails (error toast)
//   &still=1                                      the settled frame
//   &inset=59                                     the iPhone 16 Pro's safe area
//
// The board, frame by frame (all with &still=1&inset=59):
//   00 loading        ?slide=loading             01 hours           ?slide=hours
//   01 lighter week   ?fixture=lighter&slide=hours
//   02 where it went  ?slide=where               03 goals 86%       ?slide=goals
//   03 goals 100%     ?fixture=goals-100&slide=goals
//   03 goals 62%      ?fixture=goals-62&slide=goals
//   04 every habit    ?slide=habits              04 partial         ?fixture=best-partial&slide=habits
//   05 top three      ?slide=friends             05 outside         ?fixture=outside&slide=friends
//   05 few friends    ?fixture=few&slide=friends 06 your rank       ?slide=rank
//   07 closing        ?slide=closing
//
// Not linked anywhere. NODE_ENV is "production" on Vercel, so it 404s there
// before doing anything.
export default async function RecapStoryPreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { fixture, slide, still, welcome, posted, fail, insets } = parseRecapPreviewParams(
    await searchParams
  );
  const view = buildRecapStory({
    ...recapPreviewInput(fixture),
    firstReview: welcome,
    share: {
      postable: true,
      posted: posted ? { id: "preview-post", caption: "Thesis chapter two is done." } : null,
    },
  });
  // A slide this fixture skips opens the story from the top instead.
  const startAt = Math.max(0, view.slides.indexOf(slide));
  return (
    <RecapStoryPreviewClient
      key={`${fixture}:${slide}:${still}:${welcome}:${posted}:${fail}`}
      view={view}
      startAt={startAt}
      still={still}
      fail={fail}
      insets={insets}
    />
  );
}
