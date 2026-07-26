"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  CheckIcon,
  ChevronLeftIcon,
  Share2Icon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import { CategoryDonut, type CatSeg } from "@/components/v2/category-donut";
import { GoalProgressBar } from "@/components/goal-progress";
import { RecapCard } from "@/components/recap-card";
import { markRecapOpened, postRecap } from "@/app/actions/recap";
import { formatDuration } from "@/lib/duration";
import { cn } from "@/lib/utils";
import type { LeaderboardRow } from "@/lib/db/leaderboard";
import type { WeekRecap } from "@/lib/db/recap";

const CHART_FALLBACK = "var(--chart-5)";
const HOUR_MS = 60 * 60 * 1000;
const SWIPE_DISTANCE = 45; // px of horizontal travel that counts as a swipe

// Web Share API isn't on every navigator at the TS lib level.
type ShareData = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
};
type ShareCapableNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

function formatWeekRange(startMs: number, endMs: number): string {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return `${fmt(startMs)} – ${fmt(endMs)}`;
}

// Five panels: The number · Where it went · Goals · Your rank · The card.
const PANEL_COUNT = 5;

export function RecapStory({
  recap,
  weekStartISO,
  leaderboard,
}: {
  recap: WeekRecap;
  weekStartISO: string;
  leaderboard: LeaderboardRow[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion() ?? false;

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const last = PANEL_COUNT - 1;

  // Opening the recap (however it was reached — nudge tap or a direct link)
  // marks this week seen, so the Progress nudge won't reappear on any device.
  // Fire-and-forget: a failure just means the nudge returns next load.
  useEffect(() => {
    void markRecapOpened(weekStartISO);
  }, [weekStartISO]);

  function close() {
    router.push("/");
  }
  function goTo(i: number) {
    const clamped = Math.min(last, Math.max(0, i));
    setDir(clamped >= index ? 1 : -1);
    setIndex(clamped);
  }
  function next() {
    if (index >= last) {
      close();
      return;
    }
    setDir(1);
    setIndex(index + 1);
  }
  function prev() {
    if (index <= 0) return;
    setDir(-1);
    setIndex(index - 1);
  }

  // Keyboard: arrows page, Escape closes. Re-attached per index so the handlers
  // read the current panel (cheap — one listener).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Horizontal swipe on the viewport → page. Vertical-dominant gestures are left
  // to the panel's own scroll.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e: React.PointerEvent) {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) next();
    else prev();
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d >= 0 ? 32 : -32 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d >= 0 ? -32 : 32 }),
  };

  return (
    <div className="bg-background text-foreground fixed inset-0 z-50 flex flex-col">
      {/* Progress pips + close */}
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(env(safe-area-inset-top),14px)]">
        <div className="flex flex-1 items-center gap-1.5">
          {Array.from({ length: PANEL_COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to panel ${i + 1}`}
              className="bg-track h-1 flex-1 overflow-hidden rounded-full"
            >
              <span
                className="bg-brand block h-full rounded-full transition-all duration-300"
                style={{ width: i <= index ? "100%" : "0%" }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close recap"
          className="text-caption hover:text-ink -mr-1 shrink-0 p-1"
        >
          <XIcon className="size-5" />
        </button>
      </header>

      {/* Panel viewport */}
      <div
        className="relative flex-1 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={index}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              reduce ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }
            }
            className="absolute inset-0 overflow-y-auto"
          >
            <Panel
              index={index}
              recap={recap}
              reduce={reduce}
              leaderboard={leaderboard}
              weekStartISO={weekStartISO}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <footer className="flex items-center justify-between gap-3 px-6 pb-[max(env(safe-area-inset-bottom),18px)] pt-2">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="text-caption hover:text-ink flex items-center gap-1 text-sm font-medium transition-opacity disabled:pointer-events-none disabled:opacity-0"
        >
          <ChevronLeftIcon className="size-4" /> Back
        </button>
        <button
          type="button"
          onClick={next}
          className="bg-brand rounded-full px-6 py-2.5 text-sm font-bold text-white transition-transform active:scale-[.97]"
        >
          {index === last ? "Done" : "Next"}
        </button>
      </footer>
    </div>
  );
}

// One panel, chosen by index. Each fills the viewport height so short panels
// center and long ones scroll.
function Panel({
  index,
  recap,
  reduce,
  leaderboard,
  weekStartISO,
}: {
  index: number;
  recap: WeekRecap;
  reduce: boolean;
  leaderboard: LeaderboardRow[];
  weekStartISO: string;
}) {
  const range = formatWeekRange(recap.weekStartMs, recap.weekEndMs);

  if (index === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-caption text-sm">Week of {range}</span>
        {recap.totalTrackedMs > 0 ? (
          <>
            <span className="text-ink text-[64px] font-bold leading-none tabular-nums">
              <CountUpDuration ms={recap.totalTrackedMs} reduce={reduce} />
            </span>
            <span className="text-body text-lg">tracked this week</span>
            <span className="text-caption text-sm">
              {recap.sessionCount}{" "}
              {recap.sessionCount === 1 ? "session" : "sessions"}
              {" · "}
              {recap.importedCount} imported
            </span>
          </>
        ) : (
          <>
            <span className="text-ink text-4xl font-bold leading-tight text-pretty">
              A quiet week
            </span>
            <span className="text-caption text-sm text-pretty">
              Nothing tracked this week — a fresh start begins Monday.
            </span>
          </>
        )}
      </div>
    );
  }

  if (index === 1) {
    const segs: CatSeg[] = recap.categoryRows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color ?? CHART_FALLBACK,
      ms: r.ms,
    }));
    return (
      <div className="flex min-h-full flex-col gap-6 px-6 pb-24 pt-6">
        <PanelHeading title="Where it went" />
        {recap.totalTrackedMs > 0 ? (
          <CategoryDonut segs={segs} totalMs={recap.totalTrackedMs} />
        ) : (
          <p className="text-caption pt-8 text-center text-sm">
            No tracked time this week.
          </p>
        )}
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="flex min-h-full flex-col gap-5 px-6 pb-24 pt-6">
        <PanelHeading title="Goals" />
        {recap.goalRows.length > 0 ? (
          <div className="flex flex-col gap-4">
            {recap.goalRows.map((g) => (
              <GoalProgressBar
                key={g.id}
                title={g.title}
                quotaHours={g.quotaHours}
                actualMs={g.actualMs}
              />
            ))}
          </div>
        ) : (
          <p className="text-caption pt-6 text-center text-sm text-pretty">
            No goals this week — set one and it&rsquo;ll show up here next Sunday.
          </p>
        )}
        {recap.highlights.length > 0 && (
          <div className="border-hairline text-body flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-4 text-center text-sm">
            {recap.highlights.map((h, i) => (
              <p key={i} className="flex items-center gap-1.5">
                <SparklesIcon className="text-brand size-4 shrink-0" /> {h}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (index === 3) {
    return <RankPanel rows={leaderboard} />;
  }

  // index === 4 — the shareable card (Phase 6 adds the feed post).
  return <ShareableCardPanel recap={recap} weekStartISO={weekStartISO} />;
}

// Circle leaderboard — the caller's rank among accepted friends by clocked focus
// time. Solo circles (no friends, or nobody else clocked in) get a nudge instead
// of a lonely "1 of 1". (Phase 4 refines the empty/edge copy further.)
function RankPanel({ rows }: { rows: LeaderboardRow[] }) {
  const me = rows.find((r) => r.isMe);
  const hasCircle = rows.some((r) => !r.isMe);

  if (!hasCircle || !me) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <PanelHeading title="Your rank" />
        <p className="text-body text-lg text-pretty">
          You&rsquo;re flying solo this week.
        </p>
        <p className="text-caption text-sm text-pretty">
          Invite friends and you&rsquo;ll see how your weeks stack up.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pb-24 pt-6">
      <PanelHeading title="Your rank" />
      <div className="text-center">
        {me.trackedMs > 0 ? (
          <>
            <div className="text-brand text-[56px] font-bold leading-none tabular-nums">
              #{me.rank}
            </div>
            <div className="text-caption text-sm">
              of {rows.length} in your circle
            </div>
          </>
        ) : (
          <>
            <div className="text-ink text-2xl font-bold">You sat this one out</div>
            <div className="text-caption text-sm text-pretty">
              Clock in next week to join the ranking.
            </div>
          </>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li
            key={r.userId}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5",
              r.isMe && "bg-brand/10"
            )}
          >
            <span className="text-caption w-5 shrink-0 text-center text-sm font-bold tabular-nums">
              {r.rank}
            </span>
            <AvatarInitials
              name={r.displayName}
              username={r.username}
              avatarUrl={r.avatarUrl}
              className="size-8 text-xs"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {r.isMe ? "You" : r.displayName || `@${r.username}`}
            </span>
            <span className="text-body shrink-0 font-mono text-sm tabular-nums">
              {formatDuration(r.trackedMs)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PanelHeading({ title }: { title: string }) {
  return <h2 className="text-ink text-center text-2xl font-bold">{title}</h2>;
}

function ShareableCardPanel({
  recap,
  weekStartISO,
}: {
  recap: WeekRecap;
  weekStartISO: string;
}) {
  async function handleShare() {
    const nav = navigator as ShareCapableNavigator;

    // Preferred path: share the generated recap PNG (the thing people post).
    try {
      const res = await fetch(`/recap/${weekStartISO}/card`);
      if (res.ok) {
        const file = new File(
          [await res.blob()],
          `progra-week-${weekStartISO}.png`,
          { type: "image/png" }
        );
        if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
          try {
            await nav.share({ files: [file], title: "My Progra week" });
            return;
          } catch (e) {
            if ((e as Error).name === "AbortError") return; // user dismissed
            // otherwise fall through to download / text
          }
        } else {
          // No file-share (desktop browsers): download the image instead.
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          toast.success("Recap image saved");
          return;
        }
      }
    } catch {
      // image generation/fetch failed — fall through to a plain text share
    }

    // Fallback: text share → clipboard.
    const text = buildShareText(recap);
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Progra week", text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't share. Try a screenshot.");
    }
  }

  const [caption, setCaption] = useState("");
  const [posted, setPosted] = useState(false);
  const [posting, startPost] = useTransition();

  function handlePost() {
    startPost(async () => {
      const r = await postRecap(weekStartISO, caption);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setPosted(true);
      toast.success("Posted to your feed");
    });
  }

  return (
    <div className="flex min-h-full flex-col items-center gap-6 px-6 pb-24 pt-6">
      <PanelHeading title="Your week, in a card" />
      <div className="w-full">
        <RecapCard recap={recap} />
      </div>

      {/* Post to the friends feed */}
      <div className="border-hairline flex w-full flex-col gap-3 rounded-2xl border p-4">
        <span className="text-ink text-sm font-bold">Post to your feed</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="Add a caption (optional)"
          disabled={posted}
          className="bg-track/40 text-body placeholder:text-faint resize-none rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-60"
        />
        <Button
          onClick={handlePost}
          disabled={posting || posted}
          className="h-10 w-full"
        >
          {posted ? (
            <>
              <CheckIcon className="size-4" /> Posted
            </>
          ) : (
            "Post to feed"
          )}
        </Button>
      </div>

      <Button variant="outline" className="h-11 w-full" onClick={handleShare}>
        <Share2Icon /> Share this week
      </Button>
    </div>
  );
}

// Human-format count-up (0 → total). With reduced motion it starts (and stays)
// at the final value via the lazy initial state — no animation. Otherwise it's
// driven by motion's animate() onUpdate — a frame subscription, not render-sync
// setState.
function CountUpDuration({ ms, reduce }: { ms: number; reduce: boolean }) {
  const [display, setDisplay] = useState(reduce ? ms : 0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, ms, {
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [ms, reduce]);
  return <>{formatDuration(display)}</>;
}

function buildShareText(recap: WeekRecap): string {
  const fmtH = (ms: number) => `${(ms / HOUR_MS).toFixed(1)}h`;
  const lines: string[] = [];
  lines.push(`Week of ${formatWeekRange(recap.weekStartMs, recap.weekEndMs)}`);
  lines.push(
    `${fmtH(recap.totalTrackedMs)} in total${
      recap.categoryRows.length > 1
        ? ` across ${recap.categoryRows.length} categories`
        : ""
    }`
  );
  if (recap.categoryRows.length > 0) {
    lines.push("");
    for (const c of recap.categoryRows) lines.push(`${c.name}: ${fmtH(c.ms)}`);
  }
  if (recap.goalRows.length > 0) {
    lines.push("");
    lines.push(`Goals · ${fmtH(recap.totalFocusedMs)} focused`);
    for (const g of recap.goalRows) {
      const mark = g.status === "hit" ? " ✓" : "";
      lines.push(`${g.title}: ${fmtH(g.actualMs)} / ${g.quotaHours.toFixed(1)}h${mark}`);
    }
  }
  return lines.join("\n");
}
