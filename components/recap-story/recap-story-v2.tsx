"use client";

import { useEffect, useReducer, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { markRecapOpened, postWeeklyReview } from "@/app/actions/recap";
import { track } from "@/lib/analytics";
import { usePrefersReducedMotion } from "@/lib/hooks";
import {
  INTRO_MS,
  initialStoryState,
  statusBarFor,
  storyStep,
  tapMove,
  type StoryAction,
} from "@/lib/recap-story-nav";
import type { RecapStoryView, SlideId } from "@/lib/recap-story";
import { setStatusBarText, type StatusBarText } from "@/lib/status-bar";
import { appStatusBarText } from "@/lib/appearance";
import { DARK_MODE } from "@/lib/flags";
import { useTakeover } from "@/lib/takeover";
import { normalizeCaption } from "@/lib/weekly-review";

import { ClosingSlide } from "./closing-slide";
import { FriendsSlide } from "./friends-slide";
import { GoalsSlide } from "./goals-slide";
import { HabitsSlide } from "./habits-slide";
import { HoursSlide } from "./hours-slide";
import { IntroCurtain, LoadingSlide } from "./loading-slide";
import { RankSlide } from "./rank-slide";
import { ShareSlide } from "./share-slide";
import { StoryHeader } from "./story-header";
import { WelcomeSlide } from "./welcome-slide";
import { WhereSlide } from "./where-slide";

// The status-bar text for the slides on the screen ground, and for leaving.
// With DARK_MODE off, exactly what it always was: dark on white, then the
// app's "default".
const screenBarText = (): StatusBarText => (DARK_MODE ? appStatusBarText() : "dark");
const exitBarText = (): StatusBarText => (DARK_MODE ? appStatusBarText() : "default");

const TITLES: Record<SlideId, string> = {
  loading: "Your week in review",
  welcome: "Welcome",
  hours: "Hours tracked",
  where: "Where it went",
  goals: "Weekly goals",
  habits: "Habits",
  friends: "Friends",
  rank: "Your rank",
  share: "Share your week",
  closing: "A new week",
};

// Everything the story does to the outside world, so the dev preview can swap
// in fakes that never write, navigate or log (the FRIENDS_V3 services seam).
export type RecapStoryServices = {
  markOpened: (weekStartISO: string) => Promise<{ ok: true } | { error: string }>;
  post: (
    weekStartISO: string,
    caption: string
  ) => Promise<{ ok: true; recapId: string; edited: boolean } | { error: string }>;
  go: (href: string, opts?: { replace?: boolean }) => void;
  track: typeof track;
};

// The weekly review (RECAP_V2, design_handoff_weekly_recap): a full-screen,
// tap-through story. Right half or a swipe left goes on, left half or a swipe
// right goes back, ←/→ and Esc on a keyboard; nothing advances by itself but
// the Loading screen. Every move re-keys the slide, so its choreography plays
// again on entry. The rules live in lib/recap-story-nav.ts; this is wiring.
//
// Leaving it RECORDS THE WEEK AS SEEN (recap_views), not opening it — so
// quitting the app mid-story brings it back on the next load. `entry`:
//   - "auto": drawn in place of Progress at "/" because the review was due.
//     Close marks the week, and markRecapOpened's revalidation re-renders "/"
//     in the same response — as Progress now — so there's nowhere to go.
//   - "link": the /recap/[weekStart] page. Close goes to Progress.
// Either way the CTA goes to the Clock tab. `markOnExit` is false where marking
// would be wrong (a week opened by URL before its Monday-6am unlock, or already
// marked). A failed mark still lets the user out: to "/?review=later", which
// shows Progress this once.
export function RecapStoryV2({
  view: initialView,
  entry,
  markOnExit,
  services,
  startAt = 0,
  still = false,
  insets,
}: {
  view: RecapStoryView;
  entry: "auto" | "link";
  markOnExit: boolean;
  services?: RecapStoryServices;
  // Dev preview only: open on a slide, settle every animation, and stand in
  // for the device's safe areas so frames line up with the handoff's.
  startAt?: number;
  still?: boolean;
  insets?: { top: number; bottom: number };
}) {
  const router = useRouter();
  // Frozen on mount: at "/" anything that re-renders the page (an action's
  // revalidation, a refresh) re-runs the loader and hands down a new view, and
  // a story must not change under the person reading it.
  const [view] = useState(initialView);
  const svc: RecapStoryServices = services ?? {
    markOpened: markRecapOpened,
    post: postWeeklyReview,
    go: (href, opts) => (opts?.replace ? router.replace(href) : router.push(href)),
    track,
  };
  const reduced = usePrefersReducedMotion();
  const count = view.slides.length;
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialStoryState>, a: StoryAction) => storyStep(s, a, count),
    startAt,
    initialStoryState
  );
  const [pending, startExit] = useTransition();
  // The Share slide's state lives HERE: the slide remounts on every move, and
  // a post must survive leaving and coming back.
  const [posted, setPosted] = useState(view.share?.posted ?? null);
  const [draft, setDraft] = useState(view.share?.posted?.caption ?? "");
  const [posting, startPost] = useTransition();
  const [advanceAfterPost, setAdvanceAfterPost] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number; id: number } | null>(null);
  const slide = view.slides[state.pos];

  useTakeover();

  // Focus the story so the keyboard and VoiceOver start here.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    svc.track("recap_viewed", { entry, slides: count });
    // Once per mount; svc is stable in behaviour if not identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    svc.track("recap_slide_viewed", { slide, index: state.pos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.navKey]);

  // Loading hands off once its logo has filled. Not in still mode (the
  // preview's settled frames).
  useEffect(() => {
    if (state.pos !== 0 || still) return;
    const t = setTimeout(() => dispatch("intro"), INTRO_MS);
    return () => clearTimeout(t);
  }, [state.pos, still]);

  // Light status-bar text on navy, the app's own on the screen-ground slides
  // (dark on white, light in dark mode), flipped in time with the curtain and
  // the flood; the app's own style comes back on the way out.
  useEffect(() => {
    const { text: navyOrScreen, delayMs } = statusBarFor(slide, state.fromIntro);
    const text: StatusBarText =
      navyOrScreen === "dark" ? screenBarText() : navyOrScreen;
    if (delayMs === 0 || reduced || still) {
      setStatusBarText(text);
      return;
    }
    const t = setTimeout(() => setStatusBarText(text), delayMs);
    return () => clearTimeout(t);
  }, [slide, state.fromIntro, state.navKey, reduced, still]);
  useEffect(() => () => setStatusBarText(exitBarText()), []);

  function move(action: StoryAction) {
    if (!pending) dispatch(action);
  }

  function post() {
    if (posting || !view.share) return;
    const text = draft;
    startPost(async () => {
      const r = await svc.post(view.weekStartISO, text);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      const normalized = normalizeCaption(text);
      const caption = "caption" in normalized ? normalized.caption : null;
      const first = posted === null;
      setPosted({ id: r.recapId, caption });
      setDraft(caption ?? "");
      svc.track("recap_posted", { recap_ref: r.recapId, edited: r.edited, has_caption: caption !== null });
      // A first post moves on to Closing after a beat; a caption edit stays.
      if (first && !still) setAdvanceAfterPost((n) => n + 1);
    });
  }

  // "✓ Posted" holds for a moment, then Closing — unless they've moved on
  // already, or are typing again.
  useEffect(() => {
    if (advanceAfterPost === 0 || slide !== "share") return;
    const t = setTimeout(() => {
      if (document.activeElement?.tagName !== "TEXTAREA") dispatch("next");
    }, 900);
    return () => clearTimeout(t);
    // Only a new post arms it; leaving Share clears it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advanceAfterPost]);

  function exit(via: "close" | "start") {
    if (pending) return;
    svc.track("recap_closed", { slide, via });
    // The screen-ground cover goes up at once (the write and the re-render
    // behind it take a moment), so the app's status-bar text goes with it.
    setStatusBarText(screenBarText());
    startExit(async () => {
      if (markOnExit) {
        const r = await svc.markOpened(view.weekStartISO);
        if ("error" in r) {
          svc.go(via === "start" ? "/clock" : "/?review=later", { replace: true });
          return;
        }
      }
      if (via === "start") svc.go("/clock");
      else if (entry === "link") svc.go("/");
      else if (!markOnExit) svc.go("/?review=later", { replace: true });
      // entry "auto" with the week marked: "/" is already re-rendering as Progress.
    });
  }

  // Re-attached every render (one listener) so it always sees this slide.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "ArrowRight") move("next");
      else if (e.key === "ArrowLeft") move("prev");
      else if (e.key === "Escape") exit("close");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const style = {
    "--rs-top": insets ? `${insets.top}px` : "max(env(safe-area-inset-top), 12px)",
    "--rs-bottom": insets ? `${insets.bottom}px` : "max(env(safe-area-inset-bottom), 12px)",
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      data-recap=""
      data-recap-still={still ? "" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Your week in review"
      tabIndex={-1}
      className="text-body fixed inset-0 z-50 touch-pan-y overflow-hidden bg-screen font-sans antialiased outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
      style={style}
      onPointerDown={(e) => {
        if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
        // A press on a control (the X, the invite, the CTA) is never a page turn.
        if ((e.target as Element).closest("button, a, input, textarea")) return;
        // With the caption's keyboard up, a tap elsewhere just puts it away.
        const active = document.activeElement;
        if (active instanceof HTMLTextAreaElement && rootRef.current?.contains(active)) {
          active.blur();
          return;
        }
        down.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || d.id !== e.pointerId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const m = tapMove({
          dx: e.clientX - d.x,
          dy: e.clientY - d.y,
          x: e.clientX - rect.left,
          width: rect.width,
        });
        if (m) move(m);
      }}
      onPointerCancel={() => {
        down.current = null;
      }}
      onContextMenu={(e) => {
        // The caption keeps its paste menu; everywhere else, no long-press menu.
        if (!(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
      }}
    >
      <div key={state.navKey} className="absolute inset-0">
        {slide === "loading" && <LoadingSlide weekOfLabel={view.weekOfLabel} />}
        {slide === "welcome" && view.welcome && (
          <WelcomeSlide welcome={view.welcome} weekSpanLabel={view.weekSpanLabel} />
        )}
        {slide === "hours" && (
          <HoursSlide hours={view.hours} weekSpanLabel={view.weekSpanLabel} still={still} />
        )}
        {slide === "where" && view.where && <WhereSlide where={view.where} />}
        {slide === "goals" && view.goals && <GoalsSlide goals={view.goals} still={still} />}
        {slide === "habits" && view.habits && <HabitsSlide habits={view.habits} still={still} />}
        {slide === "friends" && <FriendsSlide friends={view.friends} still={still} />}
        {slide === "rank" && view.rank && <RankSlide rank={view.rank} />}
        {slide === "share" && view.share && (
          <ShareSlide
            share={view.share}
            weekSpanLabel={view.weekSpanLabel}
            draft={draft}
            onDraft={setDraft}
            posted={posted}
            posting={posting}
            onPost={post}
            onSkip={() => move("next")}
          />
        )}
        {slide === "closing" && (
          <ClosingSlide closing={view.closing} onStart={() => exit("start")} pending={pending} />
        )}
        {/* The Loading screen lifting off the first slide (Hours, or the
            first review's Welcome) — only on the way in. */}
        {state.fromIntro && !reduced && !still && (
          <IntroCurtain weekOfLabel={view.weekOfLabel} />
        )}
      </div>
      {state.pos > 0 && (
        <StoryHeader
          count={count - 1}
          current={state.pos - 1}
          dark={slide === "closing"}
          onClose={() => exit("close")}
          onPrev={() => move("prev")}
          onNext={() => move("next")}
          label={`Slide ${state.pos} of ${count - 1}: ${TITLES[slide]}`}
        />
      )}
      {/* Leaving: a white cover fades up over everything and takes the input,
          so a second tap can't turn a page while the week is recorded. */}
      {pending && (
        <div
          aria-hidden
          className="bg-screen absolute inset-0 z-50"
          style={{ animation: "rc-fade .2s ease both" }}
        />
      )}
    </div>
  );
}
