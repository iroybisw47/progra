import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { REDESIGN } from "@/lib/flags";

// Back-to-Settings affordance for the "Your data" pages (Goals, Categories,
// Habits, Past sessions). In the redesign these are only reachable via
// Settings → Your data — there are no Goals/Habits nav tabs — so a top-left back
// link is the way home. Renders nothing outside the redesign, where these pages
// are top-level tabs and need no back button.
export function BackLink({
  href = "/settings",
  label = "Settings",
}: {
  href?: string;
  label?: string;
}) {
  if (!REDESIGN) return null;
  return (
    <Link
      href={href}
      className="text-caption hover:text-ink -ml-1 inline-flex w-fit items-center gap-1 text-sm font-medium"
    >
      <ChevronLeftIcon className="size-4" />
      {label}
    </Link>
  );
}
