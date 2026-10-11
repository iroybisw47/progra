"use client";

import { useState } from "react";
import { BellIcon } from "lucide-react";

import { FriendsClientV3 } from "@/app/friends/friends-client-v3";
import {
  PREVIEW_INVITE_GOAL,
  applyPreviewWrite,
  createFriendsPreviewServices,
  friendsPreviewData,
  friendsPreviewStart,
  type FriendsPreviewFixture,
} from "@/lib/friends-v3-preview";

// The client half of the v3 Friends tab's dev preview (page.tsx says what
// it's for). The preview's copy of the reads lives here, standing in for the
// server: the fake services write to it, and the tab gets it as props, as a
// real action's revalidation hands the page fresh reads. The services are
// made once per mount, so they're a stable object (the search's debounce
// depends on its function staying the same). The page keys this by fixture,
// so a new fixture starts from its own data.
//
// The bell is a picture of the real one (NotificationsBell: a 32px ghost icon
// button). The real one would open the signed-in developer's own
// notifications and mark them seen, a write this preview mustn't make.
export function FriendsV3PreviewClient({ fixture }: { fixture: FriendsPreviewFixture }) {
  const [data, setData] = useState(() => friendsPreviewData(fixture));
  const [services] = useState(() =>
    createFriendsPreviewServices((write) => setData((now) => applyPreviewWrite(now, write)))
  );
  const start = friendsPreviewStart(fixture);
  return (
    <FriendsClientV3
      {...data}
      initialUnseen={false}
      inviteGoal={PREVIEW_INVITE_GOAL}
      services={services}
      initialQuery={start.query}
      initialSheetOpen={start.sheetOpen}
      bell={<PreviewBell />}
    />
  );
}

function PreviewBell() {
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center">
      <BellIcon className="size-5" />
    </span>
  );
}
