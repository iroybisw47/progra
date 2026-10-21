"use client";

import { useEffect, useLayoutEffect, useRef, type PointerEvent } from "react";
import { HeartIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { CategoryDonut } from "@/components/v2/category-donut";
import {
  KUDOS_LINE_IN,
  TRAVEL,
  itemStyle,
  kudosAvatarIn,
  legendRowIn,
  motion,
  play,
  transition,
  type ItemPhase,
} from "@/lib/motion";
import { themedColor } from "@/lib/colors";
import { INTRO_BEATS } from "@/lib/onboarding-v3";
import {
  INTRO_LEGEND_MAX,
  KUDOS_FRIENDS,
  KUDOS_LINE,
  KUDOS_OFFSET_PX,
  SAMPLE_POST,
  beatMove,
  beatPhase,
  beatSegmentFill,
  categoryCountLabel,
  fitScale,
  introActivity,
  introAnnouncement,
  introCaption,
  introGoal,
  introSummary,
  introWeek,
  type BeatMove,
  type WeekSeg,
} from "@/lib/onboarding-v3-intro";

import { aboveCta } from "./frame";

// Screen 4, "What Progra is" (R:106-127): three beats the person steps
// through by hand, each a caption over a preview panel. Beat 1 is their own
// first post landing in a friend's feed, Beat 2 their week adding up, Beat 3
// friends keeping each other going. There is no auto-advance (R:107) and
// nothing here writes. lib/onboarding-v3-intro.ts holds the decisions (which
// way a press moves, whose week, the copy) and lib/motion.ts the timings.
//
// The beat lives in the wizard's reducer, which restarts it at beat 1 every
// time Screen 4 is entered (P:861). The shell owns the CTA ("Next", then
// "Continue") and moves through `onNext`, which goes on to Screen 5 from the
// last beat. This screen adds the other ways to move: a tap on the panel (the
// left third goes back), a horizontal swipe, and the arrow keys.
//
// Every beat stays mounted and crossfades on the shared item motion, as the
// six screens do, so a beat left mid-entrance reverses rather than jumping.
// The one-shots (the donut's spin, the legend rows, the panel's bump) are
// WAAPI. The donut's run out under Beat 2's fade when it's left and replay
// when it's entered again; the bump stops when the screen is left; both stop
// when the wizard unmounts. The kudos are CSS transitions with delays, which
// a beat change interrupts on its own.
//
// Reduced motion: every beat and caption only crossfades (itemStyle's
// reduced path), the donut doesn't spin, the legend rows, activity cards and
// kudos avatars don't stagger, the panel doesn't bump, and the progress
// segments snap.
//
// Assistive tech hears each beat's position and caption from a live region,
// and a summary in place of the panel, whose made-up people and posts are
// hidden from it (introSummary). Hidden buttons give it the panel's moves.

// The space between "Skip intro" and the CTA: 730 to 758 on the 852 frame.
const SKIP_TO_CTA_PX = 28;

// Captions are 25px (R:108) in a 100px box. One that would overflow it (a
// long goal 1 on a narrow phone) steps down a pixel at a time, to this.
const CAPTION_PX = 25;
const CAPTION_MIN_PX = 19;
const CAPTION_BOX_PX = 100;

// The live region is filled this long after a beat or the screen arrives,
// never in the commit that takes Screen 4's `inert` off: a region that joins
// the accessibility tree already full isn't reliably read out.
const ANNOUNCE_DELAY_MS = 150;

// The kudos fading back out when Beat 1 is left (P:1084). R gives only their
// way in (kudosAvatarIn, KUDOS_LINE_IN).
const KUDOS_OUT = { normal: "opacity 120ms linear", reduced: "opacity 200ms linear" };
const KUDOS_LINE_OUT = "opacity 300ms linear";

// Wider than its box. The 1px allows for scrollWidth and clientWidth
// rounding apart.
function overflowsX(el: HTMLElement) {
  return el.scrollWidth > el.clientWidth + 1;
}

// Fits a caption to its box. Beat 1's "■ {goal 1}" run stays on one line, as
// the prototype keeps it (P:219), unless it's wider than the caption at full
// size: then the rest of the title is let wrap after the square and the
// goal's first word (introCaption's head and tail). After that the font steps
// down from the size the class gives it until the caption is no taller than
// the box and no wider than the screen (a one-word goal too long for a line).
// Written straight to the elements, not held in state: it has to be measured
// after layout, and React never renders these styles.
function fitCaption(el: HTMLElement) {
  el.style.fontSize = "";
  const run = el.querySelector<HTMLElement>("[data-goal]");
  if (run) {
    run.style.whiteSpace = "";
    if (overflowsX(el)) run.style.whiteSpace = "normal";
  }
  let px = CAPTION_PX;
  while (px > CAPTION_MIN_PX && (el.offsetHeight > CAPTION_BOX_PX || overflowsX(el))) {
    px -= 1;
    el.style.fontSize = `${px}px`;
  }
}

export function IntroScreen({
  phase,
  reduced,
  beat,
  name,
  colorKey,
  photoUrl,
  goals,
  goalColors,
  firstHabit,
  week,
  onNext,
  onPrev,
  onSkip,
}: {
  phase: ItemPhase;
  reduced: boolean;
  beat: number;
  // Screen 1's identity, for Beat 1's post: the name, whose palette color
  // the initials sit on, and the photo if one was picked.
  name: string;
  colorKey: string;
  photoUrl: string | null;
  // Screen 2's goals, in the colors it drew them in.
  goals: readonly string[];
  goalColors: readonly string[];
  // Screen 3's first pick, for Daniel's card.
  firstHabit: string | null;
  // This week's real category totals (app/onboarding/page.tsx), or none.
  week?: readonly WeekSeg[];
  onNext: () => void;
  // Back a beat. Never called from beat 1: the panel bumps instead.
  onPrev: () => void;
  onSkip: () => void;
}) {
  const active = phase === "active";
  const goal = introGoal(goals, goalColors);
  const hours = introWeek(week, goals, goalColors);
  const cards = introActivity(firstHabit);
  // The post is theirs: their name, or "You" before they've typed one
  // (P:1080), and their avatar, whose initials come from the handle when
  // there's no name, as the travelling avatar's do.
  const me = name.trim() || "You";

  const phases = Array.from({ length: INTRO_BEATS }, (_, k) => beatPhase(k, beat, phase));
  const feedOn = phases[0] === "active";
  const hoursOn = phases[1] === "active";
  // The kudos row only fades: its avatars do the moving (P:249).
  const kudosRow = itemStyle(phases[0], 2, reduced);

  const panelRef = useRef<HTMLDivElement>(null);
  const captionBoxRef = useRef<HTMLDivElement>(null);
  const donutRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const bump = useRef<Animation | null>(null);
  const donutAnims = useRef<(Animation | null)[]>([]);

  function stopBump() {
    bump.current?.cancel();
    bump.current = null;
  }

  // Back from beat 1 has nowhere to go, so the panel bumps (R:127). Not
  // under reduced motion, where it would be travel.
  function prev() {
    if (beat > 0) {
      onPrev();
      return;
    }
    stopBump();
    bump.current = play(panelRef.current, motion("panelBump", reduced));
  }

  function move(to: BeatMove) {
    if (to === "next") onNext();
    else if (to === "prev") prev();
  }

  // The arrow keys move the beats while Screen 4 is in front (R:126). Bound
  // once per visit, reading the current handlers through a ref, so a beat
  // change doesn't re-bind it. A held key doesn't race through the beats and
  // off the screen, and a key with a modifier is left to the browser.
  const keys = useRef({ next: onNext, prev });
  useLayoutEffect(() => {
    keys.current = { next: onNext, prev };
  });
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) {
        return;
      }
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        keys.current.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        keys.current.prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // The panel's tap and swipe (R:126), on the recap story's pattern
  // (app/recap/[weekStart]/recap-story.tsx) plus pointer capture, so a swipe
  // that ends off the panel still counts, and pointercancel, which is what a
  // vertical drag becomes under `touch-action: pan-y`. One pointer at a time.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || e.button !== 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone. The press still works uncaptured.
    }
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = press.current;
    if (!start || start.id !== e.pointerId) return;
    press.current = null;
    const box = e.currentTarget.getBoundingClientRect();
    move(
      beatMove({
        dx: e.clientX - start.x,
        dy: e.clientY - start.y,
        x: e.clientX - box.left,
        width: box.width,
      })
    );
  }
  function onPointerCancel(e: PointerEvent<HTMLDivElement>) {
    if (press.current?.id === e.pointerId) press.current = null;
  }

  // Beat 2 arriving: the donut rotates in and its legend rows follow
  // (R:121), queried from a wrapper because CategoryDonut forwards no ref
  // (P:1011-1017). A layout effect, so the first frame is already the
  // animation's. Leaving the beat lets them run out under its fade, as the
  // prototype does: cancelling them would drop their `fill: "backwards"`, and
  // the rows still waiting to come in would flash up whole as Beat 2 faded.
  // Coming back replays them from the start, and the wizard unmounting stops
  // them.
  function stopDonut() {
    donutAnims.current.forEach((a) => a?.cancel());
    donutAnims.current = [];
  }
  useLayoutEffect(() => {
    const wrap = donutRef.current;
    if (!hoursOn || !wrap) return;
    stopDonut();
    donutAnims.current = [
      play(wrap.querySelector("svg"), motion("donutIn", reduced)),
      ...Array.from(wrap.querySelectorAll("li"), (li, i) => play(li, legendRowIn(i, reduced))),
    ];
  }, [hoursOn, reduced]);
  useEffect(() => () => stopDonut(), []);

  // The bump is the only one-shot not tied to a beat. It stops when the
  // screen is left mid-bump, so it can't hold the panel over its exit, and
  // when the wizard unmounts.
  useEffect(() => {
    if (!active) return;
    return () => stopBump();
  }, [active]);

  // Short phones (plan §6): a beat whose content would be cut off at the
  // panel's edge scales down to fit (fitScale). Its bottom padding doesn't
  // count, so Beat 2's card, which ends 3px inside the 852 frame's panel,
  // stays full size. It uses the `scale` property, so it composes with the
  // transforms the item motion and the bump write. Scaling changes no layout
  // size, so the observer can't feed itself.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const beats = beatRefs.current.filter((el): el is HTMLDivElement => el !== null);
    const fit = () => {
      const room = panel.clientHeight;
      for (const el of beats) {
        const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
        const s = fitScale(el.offsetHeight - pad, room);
        if (s === 1) el.style.removeProperty("scale");
        else el.style.setProperty("scale", String(s));
      }
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(panel);
    beats.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // A caption too long for its box (a long goal 1) steps its font down
  // (fitCaption). Again when the goal changes, when the box changes width,
  // and once the serif has loaded, since the fallback font measures
  // differently.
  useLayoutEffect(() => {
    const box = captionBoxRef.current;
    if (!box) return;
    const layers = Array.from(box.querySelectorAll<HTMLElement>("[data-caption]"));
    const fit = () => layers.forEach(fitCaption);
    fit();
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) fit();
    });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(box);
    return () => {
      live = false;
      observer?.disconnect();
    };
  }, [goal.title]);

  // The live region (see ANNOUNCE_DELAY_MS), written to the element so React
  // never renders it full. Cleared at once when the screen is left.
  const announcement = active ? introAnnouncement(beat, goal.title) : "";
  useEffect(() => {
    const el = liveRef.current;
    if (!el) return;
    if (!announcement) {
      el.textContent = "";
      return;
    }
    const id = window.setTimeout(() => {
      el.textContent = announcement;
    }, ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [announcement]);

  const segment = transition(reduced ? TRAVEL.beatSegment.reduced : TRAVEL.beatSegment.normal);

  return (
    <div className="flex h-full flex-col px-5 pt-4" style={{ paddingBottom: aboveCta(SKIP_TO_CTA_PX) }}>
      {/* Beat progress (R:107): a segment per beat, filled in --ink up to
          the current one. Hidden from assistive tech, which hears the
          beat's position from the live region instead. */}
      <div aria-hidden className="flex h-[3px] shrink-0 gap-1" style={itemStyle(phase, 0, reduced)}>
        {phases.map((_, k) => (
          <div key={k} className="bg-track h-[3px] flex-1 overflow-hidden rounded-full">
            <div
              className="bg-ink size-full origin-left"
              style={{ transform: `scaleX(${beatSegmentFill(k, beat, phase)})`, transition: segment }}
            />
          </div>
        ))}
      </div>

      {/* The caption (R:108-111): one layer per beat, crossfading on the
          item motion. They're drawn for sight only; the live region below
          reads the current one out, with its position, as each beat
          arrives. */}
      <div
        ref={captionBoxRef}
        className="text-ink relative mt-[21px] h-[100px] shrink-0 font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.015em]"
      >
        {phases.map((p, k) => {
          const caption = introCaption(k, goal.title);
          return (
            <p
              key={k}
              data-caption
              aria-hidden
              className="absolute inset-x-0 top-0 text-pretty"
              style={itemStyle(p, 0, reduced)}
            >
              {caption.before}
              {caption.goal && (
                <span data-goal className="whitespace-nowrap">
                  <span className="whitespace-nowrap">
                    <span
                      className="mr-1.5 inline-block size-2.5 rounded-[2px]"
                      style={{ background: themedColor(goal.color) }}
                    />
                    {caption.goal.head}
                  </span>
                  {caption.goal.tail}
                </span>
              )}
              {caption.after}
            </p>
          );
        })}
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />
      </div>

      {/* The preview panel (R:112): 420px tall on the 852 frame, less on a
          shorter phone, where the beats scale to fit. The whole panel is the
          tap and swipe target, so a long press on the photo mustn't open
          iOS's image menu, and no image in it can start a native drag, which
          would cancel the press. */}
      <div
        ref={panelRef}
        role="group"
        aria-label={`Preview, ${beat + 1} of ${INTRO_BEATS}`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="bg-inset relative mt-3.5 max-h-[420px] min-h-0 flex-1 cursor-pointer touch-pan-y overflow-hidden rounded-[22px] select-none [-webkit-touch-callout:none] [&_img]:pointer-events-none"
        style={itemStyle(phase, 1, reduced)}
      >
        <p className="sr-only">{introSummary(beat, hours.sample)}</p>

        {/* Beat 1, the feed post (R:113). Made up, so hidden from assistive
            tech, which hears the summary above instead. */}
        <div
          ref={(el) => {
            beatRefs.current[0] = el;
          }}
          aria-hidden
          className="absolute inset-x-0 top-0 origin-top px-3.5 py-4"
        >
          <div
            className="flex h-[22px] items-center gap-[7px] px-1"
            style={itemStyle(phases[0], 0, reduced)}
          >
            <span className="bg-done size-[7px] rounded-full" />
            <span className="section-label">Your friends&apos; feed</span>
          </div>
          <div
            className="mt-2 flex flex-col gap-[9px] rounded-[16px] bg-card px-4 py-3.5"
            style={itemStyle(phases[0], 1, reduced)}
          >
            <div className="flex items-center gap-[11px]">
              <div className="size-[34px] shrink-0 text-[12px]">
                <AvatarInitials
                  name={name.trim() || null}
                  username={colorKey}
                  avatarUrl={photoUrl}
                  className="size-full"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">
                  {me}
                </span>
                <span className="text-caption flex flex-wrap items-center gap-x-1 text-[12px] leading-[1.3]">
                  clocked into
                  <span className="size-[7px] rounded-[2px]" style={{ background: themedColor(goal.color) }} />
                  <span className="text-body max-w-full font-medium break-words">{goal.title}</span>
                  for
                  <span className="text-body font-medium">{SAMPLE_POST.duration}</span>
                </span>
              </div>
              <span className="text-faint shrink-0 text-[12px]">{SAMPLE_POST.when}</span>
            </div>
            <span className="text-ink font-serif text-[17px] font-medium tracking-[-0.01em]">
              {SAMPLE_POST.title}
            </span>
            <div className="flex items-center gap-3.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold tabular-nums"
                style={{ background: goal.wash, color: goal.ink }}
              >
                <span className="size-1.5 rounded-[2px]" style={{ background: goal.color }} />
                {SAMPLE_POST.duration}
              </span>
              <span className="flex-1" />
              {/* The kudos count turns brand and fills as the post lands. */}
              <span
                className="border-hairline inline-flex items-center gap-1 rounded-full border px-[9px] py-[3px] text-[11px] font-semibold"
                style={{
                  color: feedOn ? "var(--brand)" : "var(--disabled)",
                  transition: "color 200ms linear",
                }}
              >
                <HeartIcon
                  className="size-[13px]"
                  strokeWidth={2}
                  fill={feedOn ? "currentColor" : "none"}
                />
                {SAMPLE_POST.kudos}
              </span>
            </div>
          </div>
          {/* Three friends' kudos spring in, then say so (R:113). */}
          <div
            className="mt-4 flex items-center gap-2.5 px-1"
            style={{ opacity: kudosRow.opacity, transition: kudosRow.transition }}
          >
            <div className="relative h-[30px] w-[72px] shrink-0">
              {KUDOS_FRIENDS.map((f, i) => {
                const timing = kudosAvatarIn(i);
                return (
                  <div
                    key={f.username}
                    className="border-inset absolute top-0 size-[30px] rounded-full border-2 bg-card text-[10px]"
                    style={{
                      left: i * KUDOS_OFFSET_PX,
                      opacity: feedOn ? 1 : 0,
                      transform: feedOn || reduced ? "scale(1)" : timing.from,
                      transition: feedOn
                        ? transition(reduced ? timing.reduced : timing.normal)
                        : reduced
                          ? KUDOS_OUT.reduced
                          : KUDOS_OUT.normal,
                    }}
                  >
                    <AvatarInitials name={f.name} username={f.username} className="size-full" />
                  </div>
                );
              })}
            </div>
            <span
              className="text-secondary-ink text-[12px] leading-[1.35]"
              style={{
                opacity: feedOn ? 1 : 0,
                transition: feedOn ? transition([KUDOS_LINE_IN]) : KUDOS_LINE_OUT,
              }}
            >
              {KUDOS_LINE}
            </span>
          </div>
        </div>

        {/* Beat 2, hours by category (R:114-121): the real CategoryDonut.
            Read out only when it's a replayer's own week. */}
        <div
          ref={(el) => {
            beatRefs.current[1] = el;
          }}
          aria-hidden={!hoursOn || hours.sample || undefined}
          className="absolute inset-x-0 top-0 origin-top px-3.5 py-4"
        >
          <div
            ref={donutRef}
            className="rounded-[16px] bg-card px-4 pt-3.5 pb-4"
            style={itemStyle(phases[1], 0, reduced)}
          >
            <div className="flex items-center justify-between pb-2.5">
              <span className="section-label">This week</span>
              <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
                {categoryCountLabel(hours.segs.length)}
              </span>
            </div>
            <CategoryDonut segs={hours.segs} totalMs={hours.totalMs} max={INTRO_LEGEND_MAX} />
          </div>
        </div>

        {/* Beat 3, friend activity (R:122-125). Made up, like Beat 1. */}
        <div
          ref={(el) => {
            beatRefs.current[2] = el;
          }}
          aria-hidden
          className="absolute inset-x-0 top-0 origin-top px-3.5 py-4"
        >
          <div className="flex h-[22px] items-center px-1" style={itemStyle(phases[2], 0, reduced)}>
            <span className="section-label">Activity</span>
          </div>
          <ul role="list" className="mt-2 flex flex-col gap-2">
            {cards.map((card, i) => (
              <li
                key={card.username}
                className="flex items-start gap-[11px] rounded-[16px] bg-card px-3.5 py-3"
                style={itemStyle(phases[2], i + 1, reduced)}
              >
                <div className="size-[34px] shrink-0 text-[12px]">
                  <AvatarInitials name={card.name} username={card.username} className="size-full" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-secondary-ink text-[13px] leading-[1.3]">
                    <span className="text-body font-semibold">{card.who}</span> {card.verb}
                  </span>
                  <span className="flex min-w-0 items-center gap-[7px]">
                    <span
                      className="h-3.5 w-[3px] shrink-0 rounded-[2px]"
                      style={{ background: themedColor(card.color) }}
                    />
                    <span className="text-body truncate text-[12.5px] leading-[1.35]">
                      {card.line}
                    </span>
                  </span>
                </div>
                <span className="text-faint shrink-0 text-[11px]">{card.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The panel's moves as buttons, for screen readers and Switch Control,
          which can't tap a third of the panel or swipe it. Hidden from
          sight and out of the tab order, since a keyboard has the arrow
          keys, and outside the panel, so its own press never doubles them.
          They stay mounted at the ends, marked disabled, so the focus on
          them isn't lost. */}
      <div className="sr-only">
        <button type="button" tabIndex={-1} aria-disabled={beat === 0 || undefined} onClick={prev}>
          Previous example
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-disabled={beat >= INTRO_BEATS - 1 || undefined}
          onClick={() => {
            if (beat < INTRO_BEATS - 1) onNext();
          }}
        >
          Next example
        </button>
      </div>

      {/* "Skip intro" (R:126): straight on to Screen 5. */}
      <div className="mt-4 flex shrink-0 justify-center" style={itemStyle(phase, 2, reduced)}>
        <button
          type="button"
          onClick={onSkip}
          className="text-caption hover:text-brand h-11 px-3.5 text-[12px] font-medium whitespace-nowrap transition-colors"
        >
          Skip intro
        </button>
      </div>
    </div>
  );
}
