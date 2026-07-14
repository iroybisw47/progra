"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquareIcon,
  ClockIcon,
  FlagIcon,
  HomeIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SOCIAL_ENABLED } from "@/lib/flags";

// 5 tabs; Clock is the raised center FAB. With social on, Home becomes the feed
// and the Search slot becomes the "You" tab (the personal dashboard at /me);
// the beta keeps its original Home/Search layout.
const TABS = SOCIAL_ENABLED
  ? ([
      { href: "/", label: "Home", icon: HomeIcon, center: false, match: (p: string) => p === "/" },
      { href: "/me", label: "You", icon: UserIcon, center: false, match: (p: string) => p.startsWith("/me") },
      { href: "/clock", label: "Clock", icon: ClockIcon, center: true, match: (p: string) => p.startsWith("/clock") },
      { href: "/goals", label: "Goals", icon: FlagIcon, center: false, match: (p: string) => p.startsWith("/goals") },
      { href: "/habits", label: "Habits", icon: CheckSquareIcon, center: false, match: (p: string) => p.startsWith("/habits") },
    ] as const)
  : ([
      { href: "/", label: "Home", icon: HomeIcon, center: false, match: (p: string) => p === "/" },
      { href: "/search", label: "Search", icon: SearchIcon, center: false, match: (p: string) => p.startsWith("/search") },
      { href: "/clock", label: "Clock", icon: ClockIcon, center: true, match: (p: string) => p.startsWith("/clock") },
      { href: "/goals", label: "Goals", icon: FlagIcon, center: false, match: (p: string) => p.startsWith("/goals") },
      { href: "/habits", label: "Habits", icon: CheckSquareIcon, center: false, match: (p: string) => p.startsWith("/habits") },
    ] as const);

const INACTIVE = "text-[#aba293] dark:text-[#837c6e]";

export function BottomNav({ activePath }: { activePath?: string } = {}) {
  // Nullish outside a Next router (e.g. standalone previews) — match against
  // an empty path instead of crashing in the tab matchers.
  const realPathname = usePathname() ?? "";
  // The onboarding wizard owns the whole viewport (steps have a bottom-pinned
  // CTA where the nav would sit). Its tour screens opt back in by passing the
  // path they're recreating, which also drives the active-tab highlight.
  if (realPathname.startsWith("/onboarding") && activePath === undefined) {
    return null;
  }
  const pathname = activePath ?? realPathname;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebe6dd] bg-[rgba(248,246,241,0.94)] backdrop-blur-md pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-[rgba(26,33,29,0.92)]"
    >
      <ul className="mx-auto flex h-[64px] w-full max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;

          if (tab.center) {
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-end gap-1 pb-3.5"
                >
                  <span className="bg-brand flex size-14 -translate-y-4 items-center justify-center rounded-full text-[#fcf6ef] shadow-[0_8px_18px_-6px_rgba(53,90,82,.6)] ring-4 ring-[var(--screen)] transition-transform active:scale-95">
                    <Icon className="size-6" strokeWidth={1.9} />
                  </span>
                  <span
                    className={cn(
                      "-mt-3 text-[10px]",
                      active ? "text-brand font-semibold" : INACTIVE + " font-medium"
                    )}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-end gap-1 pb-2 transition-colors",
                  active ? "text-brand" : INACTIVE
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 1.9 : 1.75} />
                <span className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
