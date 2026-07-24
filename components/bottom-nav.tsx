"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquareIcon,
  ClockIcon,
  FlagIcon,
  HomeIcon,
  NewspaperIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  BarChart3Icon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Ticking } from "@/components/ticking";
import { sessionWorkedMs, isPaused, type SessionTiming } from "@/lib/session";
import { REDESIGN, SOCIAL_ENABLED } from "@/lib/flags";

// 5 tabs; Clock is the raised center FAB. Three layouts:
//  • V2 (REDESIGN): Progress · Feed · [Clock] · Friends · You — the new IA.
//  • social: Home(feed) · You · [Clock] · Goals · Habits.
//  • beta:   Home · Search · [Clock] · Goals · Habits.
// The V2 center button ticks the live worked time while a session runs and (for
// now) routes to the existing /clock; it will point at /clock/live once the
// full-page clock flow lands.
const TABS = REDESIGN
  ? ([
      { href: "/", label: "Progress", icon: BarChart3Icon, center: false, match: (p: string) => p === "/" },
      { href: "/feed", label: "Feed", icon: NewspaperIcon, center: false, match: (p: string) => p.startsWith("/feed") },
      { href: "/clock", label: "Clock", icon: ClockIcon, center: true, match: (p: string) => p.startsWith("/clock") },
      { href: "/friends", label: "Friends", icon: UsersIcon, center: false, match: (p: string) => p.startsWith("/friends") },
      { href: "/me", label: "You", icon: UserIcon, center: false, match: (p: string) => p.startsWith("/me") },
    ] as const)
  : SOCIAL_ENABLED
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

const INACTIVE = "text-faint";

// Compact live timer for the center button: H:MM when past an hour, else M:SS.
function formatTick(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function BottomNav({
  activePath,
  activeSession = null,
}: {
  activePath?: string;
  activeSession?: SessionTiming | null;
} = {}) {
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

  // Only the V2 nav shows the live tick; compute once here.
  const tracking = REDESIGN && activeSession != null;
  const paused = tracking && isPaused(activeSession);
  // While tracking, the center button reopens the full-screen live timer.
  const centerHref = tracking ? "/clock/live" : "/clock";

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-[rgba(255,255,255,0.88)] backdrop-blur-[18px] pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-[rgba(20,24,31,0.9)]"
    >
      <ul className="mx-auto flex h-[64px] w-full max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;

          if (tab.center) {
            // The FAB is the only subtree that needs the 1s tick, and only
            // while tracking — idle pages mount no tick subscriber at all, so
            // no interval runs and the nav never re-renders on a timer.
            const renderCenter = (now: number) => {
              const tickLabel =
                tracking && now > 0
                  ? formatTick(sessionWorkedMs(activeSession, now))
                  : null;
              return (
                <Link
                  href={centerHref}
                  // Full prefetch (data incl.) — first tap is instant, and
                  // fully-prefetched pages get the 5-min static staleTime
                  // instead of 30s. Production-only, like all prefetching.
                  prefetch={true}
                  aria-current={active ? "page" : undefined}
                  aria-label={tickLabel ? `Tracking ${tickLabel}` : tab.label}
                  className="flex h-full flex-col items-center justify-end gap-1 pb-3.5"
                >
                  <span
                    className={cn(
                      "flex size-14 -translate-y-4 items-center justify-center rounded-full text-primary-foreground shadow-[0_10px_24px_-6px_rgba(28,58,94,.5)] ring-4 ring-[var(--screen)] transition-transform active:scale-95",
                      paused ? "bg-faint" : "bg-brand",
                      tracking && !paused && "animate-pulse"
                    )}
                  >
                    {tickLabel ? (
                      <span className="font-mono text-[11px] font-bold tabular-nums leading-none">
                        {tickLabel}
                      </span>
                    ) : (
                      <Icon className="size-6" strokeWidth={1.9} />
                    )}
                  </span>
                  <span
                    className={cn(
                      "-mt-3 text-[10px]",
                      active ? "text-brand font-semibold" : INACTIVE + " font-medium"
                    )}
                  >
                    {tracking ? (paused ? "Paused" : "Tracking") : tab.label}
                  </span>
                </Link>
              );
            };
            return (
              <li key={tab.href} className="flex-1">
                {tracking ? <Ticking>{renderCenter}</Ticking> : renderCenter(0)}
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                prefetch={true}
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
