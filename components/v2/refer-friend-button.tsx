import Link from "next/link";
import { ChevronRightIcon, UserPlusIcon } from "lucide-react";

// The "Refer a friend" CTA on Progress → Today, sitting between the day donut
// and Sessions today. Opens /refer, the share screen — deliberately NOT
// /i/{username}, which is the public landing the *recipient* sees (and which
// bounces you to /me when it's your own handle).
//
// Same navy fill as RecapNudge: brand is the app's one "noticeable CTA"
// treatment. Placement below the hero card keeps the two from ever sitting
// adjacent. Purely a link — no client directive, no state, nothing to dismiss.
export function ReferFriendButton() {
  return (
    <Link
      href="/refer"
      className="bg-brand text-primary-foreground flex w-full items-center gap-3 rounded-[18px] px-4 py-4 text-left shadow-[0_10px_24px_rgba(28,58,94,.3)] transition-transform active:scale-[.98]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
        <UserPlusIcon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">Refer a friend</span>
        <span className="text-primary-foreground/70 text-xs">
          Share your invite link
        </span>
      </span>
      <ChevronRightIcon className="text-primary-foreground/70 size-5 shrink-0" />
    </Link>
  );
}
