"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, HomeIcon, ListChecksIcon, TargetIcon, TimerIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/clock", label: "Clock", icon: TimerIcon, match: (p: string) => p.startsWith("/clock") },
  { href: "/goals", label: "Goals", icon: TargetIcon, match: (p: string) => p.startsWith("/goals") },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon, match: (p: string) => p.startsWith("/calendar") },
  { href: "/habits", label: "Habits", icon: ListChecksIcon, match: (p: string) => p.startsWith("/habits") },
] as const;

const TAB_CLASS =
  "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-md">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  TAB_CLASS,
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-5" />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
