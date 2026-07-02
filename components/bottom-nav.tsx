"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  CheckSquareIcon,
  ClockIcon,
  FlagIcon,
  HomeIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// 5 tabs; Clock is the raised center FAB.
const TABS = [
  { href: "/", label: "Home", icon: HomeIcon, center: false, match: (p: string) => p === "/" },
  { href: "/plan", label: "Plan", icon: CalendarIcon, center: false, match: (p: string) => p.startsWith("/plan") },
  { href: "/clock", label: "Clock", icon: ClockIcon, center: true, match: (p: string) => p.startsWith("/clock") },
  { href: "/goals", label: "Goals", icon: FlagIcon, center: false, match: (p: string) => p.startsWith("/goals") },
  { href: "/habits", label: "Habits", icon: CheckSquareIcon, center: false, match: (p: string) => p.startsWith("/habits") },
] as const;

const INACTIVE = "text-[#aba293] dark:text-[#837c6e]";

export function BottomNav() {
  const pathname = usePathname();
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
