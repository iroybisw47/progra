"use client";

import { useEffect, useRef } from "react";
import { ShareIcon, UsersIcon } from "lucide-react";

import { INVITE_COPY, shouldBreathe } from "@/lib/find-friends";
import { motion, play } from "@/lib/motion";
import { cn } from "@/lib/utils";

// "Invite your friends" (R:133), the main event on onboarding v3's Screen 5
// and, at 68px, at the top of the v3 Friends tab (R:165, P:420). A navy tile
// with a users icon in a 42px circle, the title over one line, and a share
// icon at the end. The caller does the sharing (lib/invite-share.ts) and says
// what the line reads (lib/find-friends.ts's inviteTileSub).
//
// It breathes, scale 1 → 1.045 → 1 over 1500ms, forever, after 700ms
// (MOTION.invitePulse). The pulse runs on a wrapper, not the button, so the
// button's own :active scale(.98) still answers a press mid-breath. WAAPI's
// transform would otherwise replace the CSS one. It runs only while
// shouldBreathe says so: the caller's `pulse` (on the screen in front, not
// searching), never under reduced motion (R:54), and only while the tile is
// on screen (an IntersectionObserver) and the page is visible. It stops on
// unmount. Each restart waits the 700ms again, as the prototype's does
// (P:1169-1173).
const SIZES = {
  // Screen 5 (R:133): 76px, a 42px circle, 16/700.
  screen: { tile: "h-[76px]", circle: "size-[42px]", users: "size-5", share: "size-5", title: "text-[16px]" },
  // The Friends tab (R:165, P:420-423): 68px, a 38px circle, 15/700.
  tab: { tile: "h-[68px]", circle: "size-[38px]", users: "size-[18px]", share: "size-[19px]", title: "text-[15px]" },
} as const;

export function InviteTile({
  sub,
  onPress,
  pulse,
  reduced,
  size = "screen",
}: {
  sub: string;
  onPress: () => void;
  pulse: boolean;
  reduced: boolean;
  size?: keyof typeof SIZES;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const s = SIZES[size];

  useEffect(() => {
    const el = wrapRef.current;
    const effect = motion("invitePulse", reduced);
    // No effect under reduced motion, so nothing to run.
    if (!el || !effect || !pulse) return;
    // Without IntersectionObserver, assume it's on screen. With it, wait for
    // its first report, which comes within a frame.
    const observes = typeof IntersectionObserver !== "undefined";
    let inView = !observes;
    let anim: Animation | null = null;
    const sync = () => {
      const run = shouldBreathe({
        on: pulse,
        reduced,
        inView,
        hidden: document.visibilityState === "hidden",
      });
      if (run && !anim) anim = play(el, effect);
      else if (!run && anim) {
        anim.cancel();
        anim = null;
      }
    };
    const io = observes
      ? new IntersectionObserver((entries) => {
          inView = entries[entries.length - 1]?.isIntersecting ?? inView;
          sync();
        })
      : null;
    io?.observe(el);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      anim?.cancel();
    };
  }, [pulse, reduced]);

  return (
    <div ref={wrapRef}>
      <button
        type="button"
        onClick={onPress}
        className={cn(
          "bg-brand flex w-full items-center gap-3 rounded-[18px] px-4 text-left text-white shadow-[0_10px_24px_rgba(28,58,94,.3)] transition-transform active:scale-[.98]",
          s.tile
        )}
      >
        <span
          aria-hidden
          className={cn("flex shrink-0 items-center justify-center rounded-full bg-white/15", s.circle)}
        >
          <UsersIcon className={s.users} strokeWidth={2} />
        </span>
        {/* Both lines keep the body's 1.5 line height, as the prototype's do
            (P:294): 24 + 3 + 18 centres the title at y=211.5 in the 76px tile. */}
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className={cn("font-bold", s.title)}>{INVITE_COPY.title}</span>
          <span className="truncate text-[12px] text-white/75">{sub}</span>
        </span>
        <ShareIcon aria-hidden className={cn("shrink-0 text-white/75", s.share)} strokeWidth={2} />
      </button>
    </div>
  );
}
