"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { HeartIcon, ImageIcon, MessageCircleIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import { entityInk, themedColor, tint } from "@/lib/colors";
import { EASING, itemStyle, transition, type ItemPhase } from "@/lib/motion";
import { KUDOS_FRIENDS, KUDOS_LINE, KUDOS_OFFSET_PX, beatMove, beatPhase, beatSegmentFill } from "@/lib/onboarding-v3-intro";
import { HOW_STEPS, formatClock, type FirstGoal } from "@/lib/onboarding-v4";

// Screen 04, "How Progra works" (R:99-114): four steps on one screen, each a
// caption over a preview panel. Clock in (a live timer), clock out (the time
// landing in your week), post (your session in a friend's feed), friends react
// (kudos and a comment). The step is the reducer's howStep; the CTA ("Next",
// then "Try it") and the skip link are the shell's. This screen adds the
// other ways to move: a tap on the panel (the left third goes back), a
// horizontal swipe, and Enter, Space and the arrow keys. v3's intro screen is
// its base: every step stays mounted and crossfades on the item motion, so a
// step left mid-entrance reverses rather than jumps.
//
// Nothing here is real or writes anything. The people and the post are made
// up, so the panel is hidden from assistive tech, which hears each step's
// caption from a live region instead.

const STEPS = [
  { title: "Clock in", body: null },
  { title: "Clock out", body: "Stop when you’re done. The time counts toward your week." },
  { title: "Post", body: "Add a photo and a line. It lands in your friends’ feed." },
  { title: "Friends react", body: "They like and comment — and you cheer on theirs." },
] as const;

const SAMPLE = {
  duration: "1h 20m",
  minutes: 80,
  when: "just now",
  title: "Locking in at the library",
  kudos: 3,
  comment: { name: "Marcus Lee", username: "marcuslee", text: "same spot tomorrow?", when: "2m" },
} as const;

// Step 2's "This week" grow: 0 → 80 minutes over 900ms, ease-out cubic, after
// 450ms (R:111). "+1H 20M" fades in at 60% of it.
const GROW_DELAY_MS = 450;
const GROW_MS = 900;
const GROW_LABEL_AT = 0.6;

// Step 4's timings from arrival (R:113).
const HEART_MS = 500;
const KUDOS_AVATAR_MS = [650, 800, 950] as const;
const KUDOS_LINE_MS = 1100;
const COMMENT_MS = 1350;

const HOUR_MS = 3_600_000;

// The live region fills this long after a step arrives, as v3's does.
const ANNOUNCE_DELAY_MS = 150;

// Counts the times `on` has turned true, to key a leaf that restarts each
// time its step is entered (the timer "restarts each time you enter step 1",
// R:110). Adjusting state while rendering, React's way to reset on a prop
// change without an effect.
function useEntries(on: boolean): number {
  const [entries, setEntries] = useState(on ? 1 : 0);
  const [was, setWas] = useState(on);
  if (on !== was) {
    setWas(on);
    if (on) setEntries(entries + 1);
  }
  return entries;
}

// Step 1's timer, h:mm:ss from 0:00:00, ticking each second while its step
// is in front. A leaf, so the tick re-renders nothing else (AGENTS.md).
function HowTimer({ running }: { running: boolean }) {
  const [start] = useState(() => performance.now());
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSeconds(Math.floor((performance.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, start]);
  return <>{formatClock(seconds)}</>;
}

const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;

// Step 2's week, growing as it arrives. Under reduced motion it's there
// already, and only the step's fade carries it in.
function WeekGrow({ goal, reduced }: { goal: FirstGoal; reduced: boolean }) {
  const [p, setP] = useState(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now() + GROW_DELAY_MS;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / GROW_MS));
      setP(easeOutCubic(k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  return (
    <>
      <div className="mt-3 flex items-center justify-between">
        <span className="section-label">This week</span>
        <span
          className="text-done text-[10px] font-semibold tracking-[0.06em]"
          style={{
            opacity: p >= GROW_LABEL_AT ? 1 : 0,
            transition: "opacity 200ms linear",
          }}
        >
          +1H 20M
        </span>
      </div>
      <div className="mt-2.5">
        <GoalQuotaRows
          goals={[
            {
              id: "how",
              title: goal.title,
              color: goal.color,
              quotaHours: goal.hours,
              actualMs: (SAMPLE.minutes / 60) * HOUR_MS * p,
            },
          ]}
        />
      </div>
    </>
  );
}

// The goal's square, inline in a line of text.
function Square({ color, size }: { color: string; size: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[2px] align-middle"
      style={{ width: size, height: size, background: themedColor(color) }}
    />
  );
}

export function HowScreen({
  phase,
  reduced,
  step,
  name,
  colorKey,
  photoUrl,
  goal,
  onNext,
  onPrev,
}: {
  phase: ItemPhase;
  reduced: boolean;
  step: number; // 0..HOW_STEPS-1
  // The welcome's identity, for the post: the name, the handle its color is
  // keyed on, and the photo.
  name: string;
  colorKey: string;
  photoUrl: string | null;
  goal: FirstGoal;
  onNext: () => void;
  // Back a step. Never called from step 1, where there's nowhere to go.
  onPrev: () => void;
}) {
  const active = phase === "active";
  const phases = Array.from({ length: HOW_STEPS }, (_, k) => beatPhase(k, step, phase));
  const on = phases.map((p) => p === "active");
  const timerEntries = useEntries(on[0]);
  const growEntries = useEntries(on[1]);
  const me = name.trim() || "You";
  const wash = tint(goal.color, 0.14);
  const ink = entityInk(goal.color);

  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  function prev() {
    if (step > 0) onPrev();
  }

  // Enter, Space and → go on; ← goes back (R:114). Not while typing in a
  // field, and not while a button or link has the focus, whose own Enter or
  // Space would then move twice.
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
        el instanceof HTMLButtonElement ||
        el instanceof HTMLAnchorElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
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

  // The panel's tap and swipe (v3's): the left third back, the rest on, a
  // horizontal swipe past 36px either way.
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
    const move = beatMove({
      dx: e.clientX - start.x,
      dy: e.clientY - start.y,
      x: e.clientX - box.left,
      width: box.width,
    });
    if (move === "next") onNext();
    else if (move === "prev") prev();
  }
  function onPointerCancel(e: PointerEvent<HTMLDivElement>) {
    if (press.current?.id === e.pointerId) press.current = null;
  }

  // The live region: the step's position and caption, written once it has
  // arrived, and cleared when the screen is left.
  const caption = STEPS[step] ?? STEPS[0];
  const announcement = active
    ? `${step + 1} of ${HOW_STEPS}. ${caption.title}. ${
        caption.body ?? `Start a session toward ${goal.title}.`
      }`
    : "";
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

  const segment = reduced ? "none" : `transform 700ms ${EASING.E}`;
  // Something on step 4 arriving `ms` after the step does, or leaving at once.
  const later = (ms: number, show = on[3]) =>
    show ? `opacity 300ms linear ${ms}ms` : "opacity 120ms linear";

  const header = (
    <div className="flex items-start gap-[11px]">
      <div className="size-[34px] shrink-0 text-[12px]">
        <AvatarInitials
          name={name.trim() || null}
          username={colorKey}
          avatarUrl={photoUrl}
          className="size-full"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">{me}</span>
        <span className="text-caption text-[12px] leading-[1.35]">
          clocked into <Square color={goal.color} size={7} />{" "}
          <span className="text-body font-medium break-words">{goal.title}</span> for{" "}
          <span className="text-body font-medium">{SAMPLE.duration}</span>
        </span>
      </div>
      <span className="text-faint shrink-0 text-[12px]">{SAMPLE.when}</span>
    </div>
  );
  const durationPill = (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold tabular-nums"
      style={{ background: wash, color: ink }}
    >
      <span className="size-1.5 rounded-[2px]" style={{ background: themedColor(goal.color) }} />
      {SAMPLE.duration}
    </span>
  );
  const postTitle = (
    <span className="text-ink font-serif text-[17px] leading-[1.25] font-medium tracking-[-0.01em]">
      {SAMPLE.title}
    </span>
  );

  return (
    <div className="flex h-full flex-col px-6 pt-[18px] pb-[116px]">
      <h2
        className="text-ink shrink-0 font-serif text-[34px] leading-[1.08] font-medium tracking-[-0.02em]"
        style={itemStyle(phase, 0, reduced)}
      >
        How Progra works
      </h2>

      {/* A segment per step, filled in --ink up to and including the
          current one, so arriving at a step fills its own (R:103). */}
      <div aria-hidden className="mt-4 flex h-[3px] shrink-0 gap-1" style={itemStyle(phase, 1, reduced)}>
        {phases.map((_, k) => (
          <div key={k} className="bg-track h-[3px] flex-1 overflow-hidden rounded-full">
            <div
              className="bg-ink size-full origin-left"
              style={{ transform: `scaleX(${beatSegmentFill(k, step, phase)})`, transition: segment }}
            />
          </div>
        ))}
      </div>

      {/* The captions, one layer per step (R:104). Drawn for sight; the live
          region reads the current one out. */}
      <div className="relative mt-[22px] h-[84px] shrink-0" style={itemStyle(phase, 2, reduced)}>
        {STEPS.map((s, k) => (
          <div
            key={s.title}
            aria-hidden
            className="absolute inset-x-0 top-0"
            style={itemStyle(phases[k], 0, reduced)}
          >
            <p className="text-ink font-serif text-[26px] leading-[1.15] font-medium tracking-[-0.015em]">
              {s.title}
            </p>
            <p className="text-secondary-ink mt-1.5 text-[14px] leading-[1.5] text-pretty">
              {s.body ?? (
                <>
                  Start a session toward <Square color={goal.color} size={8} />{" "}
                  <span className="text-body font-semibold">{goal.title}</span>.
                </>
              )}
            </p>
          </div>
        ))}
        <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />
      </div>

      {/* The panel (R:109): the whole of it is the tap and swipe target, so
          nothing in it starts a native drag or iOS's image menu. */}
      <div
        aria-hidden
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="bg-inset relative mt-3.5 max-h-[400px] min-h-0 flex-1 cursor-pointer touch-pan-y overflow-hidden rounded-[22px] select-none [-webkit-touch-callout:none]"
        style={itemStyle(phase, 3, reduced)}
      >
        {/* 1. Clocked in: a live timer from 0:00:00. */}
        <div className="absolute inset-0 flex flex-col justify-center px-3.5 py-4" style={itemStyle(phases[0], 0, reduced)}>
          <div className="flex flex-col items-center gap-3.5 rounded-[16px] bg-card px-4 pt-7 pb-[26px]">
            <span className="flex items-center gap-[7px]">
              <span
                className="size-[7px] animate-[pulse-dot_1.6s_ease-in-out_infinite] rounded-full"
                style={{ background: themedColor(goal.color) }}
              />
              <span className="section-label">Clocked in</span>
            </span>
            <span className="text-ink font-serif text-[52px] leading-[0.9] font-medium tracking-[-0.03em] tabular-nums">
              <HowTimer key={timerEntries} running={on[0]} />
            </span>
            <span className="text-body flex min-w-0 max-w-full items-center gap-[7px] text-[13px] font-semibold">
              <Square color={goal.color} size={8} />
              <span className="truncate">{goal.title}</span>
            </span>
          </div>
        </div>

        {/* 2. Clocked out: the session, then this week growing by it. */}
        <div className="absolute inset-0 flex flex-col justify-center px-3.5 py-4" style={itemStyle(phases[1], 0, reduced)}>
          <div className="rounded-[16px] bg-card px-4 py-[18px]">
            <span className="section-label">Clocked out</span>
            <div className="mt-3 flex min-w-0 items-baseline gap-2">
              <span className="text-ink shrink-0 font-serif text-[40px] leading-[0.95] font-medium tracking-[-0.03em]">
                {SAMPLE.duration}
              </span>
              <span className="text-caption min-w-0 truncate text-[13px]">
                on <Square color={goal.color} size={7} />{" "}
                <span className="text-body font-semibold">{goal.title}</span>
              </span>
            </div>
            <div className="bg-hairline mt-4 h-px" />
            <WeekGrow key={growEntries} goal={goal} reduced={reduced} />
          </div>
        </div>

        {/* 3. Post: the session in a friend's feed, with its photo. */}
        <div className="absolute inset-0 flex flex-col justify-center px-3.5 py-4" style={itemStyle(phases[2], 0, reduced)}>
          <div className="flex h-[22px] items-center gap-[7px] px-1">
            <span className="bg-done size-[7px] rounded-full" />
            <span className="section-label">Your friends&apos; feed</span>
          </div>
          <div className="mt-2 flex flex-col gap-2.5 rounded-[16px] bg-card px-4 py-3.5">
            {header}
            {postTitle}
            <div className="bg-track flex h-[112px] items-center justify-center gap-2 rounded-[14px]">
              <ImageIcon className="text-caption size-4" strokeWidth={2} />
              <span className="text-caption text-[12px] font-semibold">Your photo</span>
            </div>
            <div className="flex">{durationPill}</div>
          </div>
        </div>

        {/* 4. Friends react: kudos, then a comment. */}
        <div className="absolute inset-0 flex flex-col justify-center px-3.5 py-4" style={itemStyle(phases[3], 0, reduced)}>
          <div className="flex flex-col gap-2.5 rounded-[16px] bg-card px-4 py-3.5">
            {header}
            {postTitle}
            <div className="flex items-center gap-2">
              {durationPill}
              <span className="flex-1" />
              <span
                className="border-hairline inline-flex items-center gap-1 rounded-full border px-[9px] py-[3px] text-[11px] font-semibold"
                style={{
                  color: on[3] ? "var(--brand)" : "var(--disabled)",
                  transition: on[3] ? `color 200ms linear ${HEART_MS}ms` : "color 120ms linear",
                }}
              >
                <HeartIcon
                  className="size-3"
                  strokeWidth={2}
                  fill={on[3] ? "currentColor" : "none"}
                  style={{ transition: on[3] ? `fill 200ms linear ${HEART_MS}ms` : undefined }}
                />
                {SAMPLE.kudos}
              </span>
              <span
                className="border-hairline text-caption inline-flex items-center gap-1 rounded-full border px-[9px] py-[3px] text-[11px] font-semibold"
                style={{ opacity: on[3] ? 1 : 0, transition: later(COMMENT_MS) }}
              >
                <MessageCircleIcon className="size-3" strokeWidth={2} />1
              </span>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2.5 px-1">
            <div className="relative h-[30px] w-[70px] shrink-0">
              {KUDOS_FRIENDS.map((f, i) => (
                <div
                  key={f.username}
                  className="border-inset absolute top-0 size-[30px] rounded-full border-2 bg-card text-[10px]"
                  style={{
                    left: i * KUDOS_OFFSET_PX,
                    opacity: on[3] ? 1 : 0,
                    transform: on[3] || reduced ? "scale(1)" : "scale(0.5)",
                    transition: on[3]
                      ? reduced
                        ? `opacity 200ms linear ${KUDOS_AVATAR_MS[0]}ms`
                        : `opacity 200ms linear ${KUDOS_AVATAR_MS[i]}ms, transform 420ms ${EASING.SPRING} ${KUDOS_AVATAR_MS[i]}ms`
                      : "opacity 120ms linear",
                  }}
                >
                  <AvatarInitials name={f.name} username={f.username} className="size-full" />
                </div>
              ))}
            </div>
            <span
              className="text-secondary-ink text-[12px] leading-[1.35]"
              style={{ opacity: on[3] ? 1 : 0, transition: later(KUDOS_LINE_MS) }}
            >
              {KUDOS_LINE}
            </span>
          </div>
          <div
            className="mt-2.5 flex items-start gap-2.5 rounded-[16px] bg-card px-3.5 py-3"
            style={{
              opacity: on[3] ? 1 : 0,
              transform: on[3] || reduced ? "none" : "translateY(10px)",
              transition: on[3]
                ? reduced
                  ? `opacity 200ms linear ${COMMENT_MS}ms`
                  : transition([
                      { property: "opacity", duration: 300, easing: "linear", delay: COMMENT_MS },
                      { property: "transform", duration: 460, easing: EASING.E, delay: COMMENT_MS },
                    ])
                : "opacity 120ms linear",
            }}
          >
            <div className="size-[30px] shrink-0 text-[11px]">
              <AvatarInitials
                name={SAMPLE.comment.name}
                username={SAMPLE.comment.username}
                className="size-full"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-[12.5px] font-semibold">{SAMPLE.comment.name}</span>
              <span className="text-body text-[13px]">{SAMPLE.comment.text}</span>
            </div>
            <span className="text-faint shrink-0 text-[11px]">{SAMPLE.comment.when}</span>
          </div>
        </div>
      </div>

      {/* The panel's moves as buttons, for screen readers and Switch Control. */}
      <div className="sr-only">
        <button type="button" tabIndex={-1} aria-disabled={step === 0 || undefined} onClick={prev}>
          Previous step
        </button>
        <button type="button" tabIndex={-1} onClick={onNext}>
          Next step
        </button>
      </div>
    </div>
  );
}
