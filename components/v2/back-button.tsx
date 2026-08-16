"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

// The bordered back chevron the overlay screens (a friend's profile, Settings)
// open with. Goes back rather than to a fixed route, because these screens are
// reached from several places — the friends list, a leaderboard row, a feed
// post — and each should return where it came from.
export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => router.back()}
      className="border-hairline text-caption hover:border-brand flex size-8 shrink-0 items-center justify-center rounded-[11px] border-[1.5px]"
    >
      <ChevronLeftIcon className="size-[15px]" strokeWidth={2} />
    </button>
  );
}
