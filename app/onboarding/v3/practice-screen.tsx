"use client";

import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Ref,
} from "react";
import { CameraIcon, CheckIcon, FastForwardIcon, HeartIcon, MessageCircleIcon, TimerIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { Donut } from "@/components/v2/donut";
import { GoalQuotaRows } from "@/components/v2/goal-quota-rows";
import { HabitWeekGrid } from "@/components/v2/habit-week-grid";
import { SectionHeader } from "@/components/v2/section-header";
import { formatTime12 } from "@/lib/dates";
import { useNowMinute } from "@/lib/hooks";
import {
  PHOTO_FLIP_MS,
  TITLE_FLIP_MS,
  boxOf,
  flipUniform,
  heroBarFill,
  heroCheckIn,
  itemStyle,
  motion,
  play,
  type Box,
  type ItemPhase,
} from "@/lib/motion";
import {
  PRACTICE_COPY as COPY,
  PRACTICE_FF_CHIP_MS,
  PRACTICE_SECS,
  earlySeconds,
  endedStatus,
  formatPracticeClock,
  heroSample,
  liveLabel,
  pickMeta,
  practiceGoals,
  practicePose,
  practiceStopped,
  simSeconds,
  type PracticeEnd,
  type PracticePhase,
} from "@/lib/onboarding-v3-practice";
import { cn } from "@/lib/utils";

import { aboveCta } from "./frame";

// Screen 4, "What is Progra" (design_handoff_progra_step04): one practice
// loop of the real product, in six phases the wizard's reducer holds
// (intro → ready → running → ended → post → posted). The intro explains Progra
// over a preview of the Progress tab; ready is the Clock tab cut down to the
// goal and a 25 minute timer; running is the live timer, fast-forwarded until
// it clocks them out; post asks for a photo; posted shows the post as their
// friends will see it, and Continue goes on to Screen 5.
//
// The shell owns the one CTA and pages the phases with it. The moves that
// need this screen's elements go through PracticeScreenHandle: Clock in
// measures the goal's title for its FLIP and starts the timer, Clock out
// stops it, "Add a photo" opens the picker, and Post hands the photo to the
// shell (onPost), which uploads it, then measures the slot for the photo's
// FLIP into the card.
//
// Nothing about the run is written: the timer is rAF and a text node, and
// the 25 minutes never reach a session. The post is the "just joined Progra"
// card friends already get from onboarded_at, plus the photo (app/actions/
// join-photo.ts).
//
// Every phase's elements stay mounted and move on the shared item motion,
// like the screens around them (lib/onboarding-v3-practice.ts practicePose).
// Reduced motion: the items crossfade, and there's no wheel spin, bar fill,
// pop, ring or FLIP, and the timer steps in five minutes.

// The live title's 10px square and 9px gap, which the row's title has no twin
// for: the FLIP lands the title's text, not the square, on the row's.
const LIVE_TITLE_LEAD_PX = 19;
// The CTA's ring after the clock stops.
const END_CTA_RING_MS = 520;

export type PracticeScreenHandle = {
  start: () => void;
  clockOut: () => void;
  pickPhoto: () => void;
  post: () => void;
};

// The 10px eyebrow meta, right of the label.
const META = "text-caption text-[10px] font-semibold tracking-[0.06em]";
// A 56px row: the goal rows and the timer row.
const ROW = "flex h-14 w-full items-center gap-[11px] rounded-[14px] border-[1.5px] bg-white px-3.5 text-left";
const ROW_TITLE = "text-ink truncate font-serif text-[17px] font-medium tracking-[-0.01em]";

export function PracticeScreen({
  ref,
  phase,
  reduced,
  demo,
  demoGoal,
  goals,
  goalColors,
  habits,
  name,
  colorKey,
  photoUrl,
  onDemo,
  onPickGoal,
  onHasPhoto,
  onEndRing,
  onPost,
}: {
  ref?: Ref<PracticeScreenHandle>;
  phase: ItemPhase;
  reduced: boolean;
  demo: PracticePhase;
  demoGoal: number;
  // Screen 2's goals, in the colors it drew them in.
  goals: readonly string[];
  goalColors: readonly string[];
  // Screen 3's picks, for the preview's habit grid.
  habits: readonly string[];
  // Screen 1's identity, for the post: the name, the handle whose palette
  // color the initials sit on, and the photo if one was picked.
  name: string;
  colorKey: string;
  photoUrl: string | null;
  onDemo: (demo: PracticePhase) => void;
  onPickGoal: (index: number) => void;
  onHasPhoto: (has: boolean) => void;
  // The run has stopped: the shell rings its CTA.
  onEndRing: () => void;
  // Post, with the photo or none. Resolves true once it's posted and the
  // screen should show the card, false when it failed (the shell toasted) or
  // the wizard has moved on meanwhile.
  onPost: (photo: File | null, end: PracticeEnd | null) => Promise<boolean>;
}) {
  const active = phase === "active";
  const list = practiceGoals(goals, goalColors);
  const goal = list[Math.min(Math.max(0, demoGoal), list.length - 1)];
  const hero = heroSample(habits);
  const me = name.trim() || "You";
  const stopped = practiceStopped(demo);

  // How the run went. Set from the handle and the timer, never in an effect;
  // nothing reads them until Clock in has set them afresh.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [end, setEnd] = useState<PracticeEnd | null>(null);
  const [secs, setSecs] = useState(0);
  const [ff, setFf] = useState(false);
  // The picked photo, as a File for the upload and an object URL for the slot
  // and the card. It survives Back, as every other screen's fields do.
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [posting, setPosting] = useState(false);

  const heroRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const liveTitleRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLButtonElement>(null);
  const slotImgRef = useRef<HTMLImageElement>(null);
  const cardPhotoRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Where the title and the photo FLIP from, measured as they're left.
  const titleFrom = useRef<Box | null>(null);
  const photoFrom = useRef<Box | null>(null);
  // The simulated seconds on the clock right now, for Clock out.
  const sim = useRef(0);
  const raf = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The clock, written to its text node so the rAF re-renders nothing. React
  // renders the same node with 0:00:00 before the run and the final time
  // after, and writes it itself when that changes.
  function paint(value: number) {
    sim.current = value;
    const el = timerRef.current;
    if (!el) return;
    const text = formatPracticeClock(value);
    const node = el.firstChild;
    if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = text;
    else el.textContent = text;
  }

  function stopTimer() {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }

  function finish(how: PracticeEnd) {
    stopTimer();
    const final = how === "auto" ? PRACTICE_SECS : earlySeconds(sim.current);
    paint(final);
    setEnd(how);
    setSecs(final);
    setFf(false);
    onDemo("ended");
  }

  // The object URL goes when it's replaced, and when the wizard unmounts.
  const photoUrlNow = useRef<string | null>(null);
  useEffect(() => () => {
    if (photoUrlNow.current) URL.revokeObjectURL(photoUrlNow.current);
  }, []);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (photoUrlNow.current) URL.revokeObjectURL(photoUrlNow.current);
    const url = URL.createObjectURL(file);
    photoUrlNow.current = url;
    setPhoto({ file, url });
    onHasPhoto(true);
  }

  function pickPhoto() {
    if (!active || demo !== "post" || posting) return;
    fileRef.current?.click();
  }

  function post(withPhoto: boolean) {
    if (!active || demo !== "post" || posting) return;
    const file = withPhoto ? (photo?.file ?? null) : null;
    setPosting(true);
    void onPost(file, end).then((ok) => {
      if (!mounted.current) return;
      setPosting(false);
      if (!ok) return;
      photoFrom.current = file && slotRef.current ? boxOf(slotRef.current) : null;
      onDemo("posted");
    });
  }

  useImperativeHandle(ref, () => ({
    start() {
      if (!active || demo !== "ready") return;
      const title = listRef.current?.querySelector(`[data-goal-title="${demoGoal}"]`);
      titleFrom.current = title ? boxOf(title) : null;
      setStartedAt(Date.now());
      setEnd(null);
      setSecs(0);
      setFf(false);
      onDemo("running");
    },
    clockOut() {
      if (!active || demo !== "running") return;
      finish("early");
    },
    pickPhoto,
    post() {
      post(photo !== null);
    },
  }));

  // The intro's preview coming in, 120ms after the phase does: the wheel
  // turns in, the goal's bar fills and the habit checks pop. Left to run out
  // when the phase is left (cancelling would drop their backwards fill and
  // flash what's still waiting), replayed from the start on the way back in,
  // and stopped when the wizard unmounts.
  const heroAnims = useRef<(Animation | null)[]>([]);
  const introOn = active && demo === "intro";
  useLayoutEffect(() => {
    const wrap = heroRef.current;
    if (!introOn || !wrap) return;
    heroAnims.current.forEach((a) => a?.cancel());
    const bars = Array.from(wrap.querySelectorAll<HTMLElement>(".bg-track > div"));
    bars.forEach((b) => {
      b.style.transformOrigin = "0 50%";
    });
    heroAnims.current = [
      play(wrap.querySelector("[data-wheel] svg"), motion("heroWheelIn", reduced)),
      ...bars.map((b, i) => play(b, heroBarFill(i, reduced))),
      ...Array.from(wrap.querySelectorAll('[aria-label$=" done"]'), (c, i) =>
        play(c, heroCheckIn(i, reduced))
      ),
    ];
  }, [introOn, reduced]);
  useEffect(() => () => heroAnims.current.forEach((a) => a?.cancel()), []);

  // The run: the title FLIPs up from its row, the clock starts at 0:00:00,
  // the fast-forward chip comes in at 900ms, and the timer clocks them out
  // at 25:00. Leaving the screen mid-run (Back) stops it, and coming back in
  // starts the screen over at its intro.
  const runOn = active && demo === "running";
  useLayoutEffect(() => {
    if (!runOn) return;
    paint(0);
    const from = titleFrom.current;
    titleFrom.current = null;
    const title = liveTitleRef.current;
    if (from && title) {
      play(
        title,
        flipUniform(from, boxOf(title), {
          by: "height",
          duration: TITLE_FLIP_MS,
          leadPx: LIVE_TITLE_LEAD_PX,
          reduced,
        })
      );
    }
    const chip = reduced ? null : window.setTimeout(() => setFf(true), PRACTICE_FF_CHIP_MS);
    const t0 = performance.now();
    const step = (now: number) => {
      const { sim: value, done } = simSeconds(now - t0, reduced);
      paint(value);
      if (done) {
        raf.current = null;
        finish("auto");
        return;
      }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      stopTimer();
      if (chip !== null) window.clearTimeout(chip);
    };
    // `finish` and `paint` only touch refs, state setters and onDemo, which
    // the shell's dispatch keeps stable in effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runOn, reduced]);

  // The run stopping: the check pops over the dot, the clock bumps, a ring
  // pulses out of it, and the CTA rings a moment later.
  const lastDemo = useRef(demo);
  const endRing = useRef(onEndRing);
  useLayoutEffect(() => {
    endRing.current = onEndRing;
  });
  useLayoutEffect(() => {
    const was = lastDemo.current;
    lastDemo.current = demo;
    if (!(was === "running" && demo === "ended")) return;
    play(checkRef.current, motion("practiceCheck", reduced));
    play(timerRef.current, motion("timerBump", reduced));
    play(ringRef.current, motion("endRing", reduced));
    if (reduced) return;
    const id = window.setTimeout(() => endRing.current(), END_CTA_RING_MS);
    return () => window.clearTimeout(id);
  }, [demo, reduced]);

  // A photo picked: it settles into the slot.
  useLayoutEffect(() => {
    if (photo) play(slotImgRef.current, motion("photoIn", reduced));
  }, [photo, reduced]);

  // Posted with a photo: it FLIPs from the slot into the card.
  useLayoutEffect(() => {
    if (demo !== "posted") return;
    const from = photoFrom.current;
    photoFrom.current = null;
    const el = cardPhotoRef.current;
    if (!from || !el) return;
    play(el, flipUniform(from, boxOf(el), { by: "width", duration: PHOTO_FLIP_MS, reduced }));
  }, [demo, reduced]);

  // The pose of an element shown in `shownIn` (and only while `when` holds).
  function pose(shownIn: readonly PracticePhase[], when = true): ItemPhase {
    const p = practicePose(phase, demo, shownIn);
    return p === "active" && !when ? "ahead" : p;
  }
  const item = (shownIn: readonly PracticePhase[], i: number, when = true): CSSProperties =>
    itemStyle(pose(shownIn, when), i, reduced);
  // A phase's group: out of the tab order and the accessibility tree, and
  // deaf to taps, unless it's in front.
  const group = (on: boolean) => ({
    inert: !on || undefined,
    "aria-hidden": !on || undefined,
    style: { pointerEvents: on ? "auto" : "none" } as CSSProperties,
  });

  const INTRO = ["intro"] as const;
  const READY = ["ready"] as const;
  const RUN = ["running", "ended"] as const;
  const POST = ["post"] as const;
  const POSTED = ["posted"] as const;
  const runShown = pose(RUN) === "active";
  // The live title only fades as it FLIPs in; it leaves on the item motion.
  const liveTitleStyle: CSSProperties = runShown
    ? { opacity: 1, transform: "none", transition: `opacity ${reduced ? 200 : 120}ms linear` }
    : itemStyle(pose(RUN), 0, reduced);
  // Posted with a photo, the card only fades in while the photo FLIPs.
  const cardStyle: CSSProperties =
    pose(POSTED) === "active" && photo && !reduced
      ? { opacity: 1, transform: "none", transition: "opacity 140ms linear" }
      : item(POSTED, 1);
  const status = stopped
    ? endedStatus(end, secs)
    : `Started ${startedAt ? formatTime12(new Date(startedAt)) : ""} · 25 min timer`;

  return (
    <div className="relative h-full">
      {/* The eyebrows, one per phase group, crossfading in one slot. */}
      <div className="absolute inset-x-5 top-4 h-3.5">
        <div className="absolute inset-0 flex items-center justify-between" style={item(READY, 0)}>
          <span className="section-label">Clock in</span>
          <TodayMeta />
        </div>
        <div className="absolute inset-0 flex items-center gap-[7px]" style={item(RUN, 0)}>
          <span aria-hidden className="relative size-3.5 shrink-0">
            <span className="bg-done absolute top-[3.5px] left-[3.5px] size-[7px] animate-[pulse-dot_1.6s_ease_infinite] rounded-full" />
            <span
              ref={checkRef}
              className="bg-done absolute inset-0 flex items-center justify-center rounded-full text-white"
              style={{ opacity: stopped ? 1 : 0 }}
            >
              <CheckIcon className="size-[9px]" strokeWidth={4} />
            </span>
          </span>
          <span className="section-label text-done!">{liveLabel(demo, end)}</span>
          <span className="flex-1" />
          <span className={META}>{COPY.practiceRun}</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-between" style={item(POST, 0)}>
          <span className="section-label">Session done</span>
          <span className={META}>{COPY.practiceRun}</span>
        </div>
        <div className="absolute inset-0 flex items-center gap-[7px]" style={item(POSTED, 0)}>
          <span aria-hidden className="bg-done size-[7px] rounded-full" />
          <span className="section-label">Your friends&rsquo; feed</span>
        </div>
      </div>

      {/* Intro: what Progra is, over a preview of the Progress tab. On a
          short phone it scrolls above the CTA. */}
      <div
        {...group(pose(INTRO) === "active")}
        className="absolute inset-0 overflow-y-auto px-5 pt-3.5"
        style={{ ...group(pose(INTRO) === "active").style, paddingBottom: aboveCta(16) }}
      >
        <div ref={heroRef} className="bg-inset rounded-[22px] p-3" style={item(INTRO, 0)}>
          <div className="rounded-2xl bg-white px-4 pt-3.5 pb-3">
            <div className="flex items-center gap-4">
              <div data-wheel className="shrink-0">
                <Donut segments={hero.segments} size={112} stroke={12} label={hero.total} sub="This week" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
                <span className="section-label">Goals this week</span>
                <GoalQuotaRows goals={hero.goals} />
              </div>
            </div>
            <div className="bg-hairline mt-3 mb-[9px] h-px" />
            <span className="section-label">Habits</span>
            <div className="mt-1">
              <HabitWeekGrid
                habits={hero.habits}
                completions={hero.completions}
                weekStart={hero.weekStart}
                today={hero.today}
              />
            </div>
          </div>
        </div>
        <h2
          className="text-ink mt-6 font-serif text-[34px] leading-[1.1] font-medium tracking-[-0.02em]"
          style={item(INTRO, 1)}
        >
          {COPY.heading}
        </h2>
        <p
          className="text-secondary-ink mt-3 font-serif text-[22px] leading-[1.3] font-medium tracking-[-0.01em] text-pretty"
          style={item(INTRO, 2)}
        >
          {COPY.lead}
        </p>
        <p className="text-secondary-ink mt-3.5 text-[15px] leading-[1.55] text-pretty" style={item(INTRO, 3)}>
          {COPY.body}
        </p>
        <p className="text-body mt-4 text-[15px] leading-[1.4] font-semibold" style={item(INTRO, 5)}>
          {COPY.start}
        </p>
      </div>

      {/* Ready: the Clock tab, down to the goal and the timer. */}
      <div {...group(pose(READY) === "active")} className="absolute inset-x-5 top-[50px]">
        <div style={item(READY, 1)}>
          <SectionHeader label="Working on" meta={pickMeta(list.length)} className="pb-2" />
        </div>
        <div
          ref={listRef}
          role="radiogroup"
          aria-label="Working on"
          className="flex flex-col gap-2"
          style={item(READY, 2)}
        >
          {list.map((g, i) => {
            const selected = i === demoGoal;
            return (
              <button
                key={`${i}:${g.title}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPickGoal(i)}
                className={cn(
                  ROW,
                  "transition-[border-color,transform] duration-150 active:scale-[.99]",
                  selected ? "border-brand" : "border-control-border"
                )}
              >
                <span aria-hidden className="h-6 w-[3px] shrink-0 rounded-[2px]" style={{ background: g.color }} />
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span data-goal-title={i} className={ROW_TITLE}>
                    {g.title}
                  </span>
                  <span className="text-faint text-[11px]">{COPY.goalSub}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-white transition-colors duration-150",
                    selected ? "border-brand bg-brand" : "border-control-border bg-white"
                  )}
                >
                  <CheckIcon className="size-3" strokeWidth={3.5} style={{ opacity: selected ? 1 : 0 }} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-[22px]" style={item(READY, 3)}>
          <SectionHeader label="Timer" className="pb-2" />
          <div className={cn(ROW, "border-control-border")}>
            <span aria-hidden className="text-caption flex w-6 shrink-0 justify-center">
              <TimerIcon className="size-[17px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className={ROW_TITLE}>{COPY.timer}</span>
              <EndsAt />
            </span>
          </div>
        </div>
      </div>

      {/* Running, then ended: the live timer. */}
      <div
        {...group(runShown)}
        className="absolute inset-x-5 top-[176px] flex flex-col items-center text-center"
      >
        <div className="max-w-full" style={liveTitleStyle}>
          <div ref={liveTitleRef} className="flex max-w-full origin-top-left items-center gap-[9px]">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ background: goal.color }} />
            <span className="text-ink min-w-0 truncate font-serif text-[22px] font-medium tracking-[-0.015em]">
              {goal.title}
            </span>
          </div>
        </div>
        <div className="mt-[22px]" style={item(RUN, 1)}>
          <div ref={timerRef} className="stat-num text-[52px] leading-[0.9]">
            {formatPracticeClock(stopped ? secs : 0)}
          </div>
        </div>
        <p
          aria-live="polite"
          className="text-caption mt-3.5 text-[13px] leading-[1.45]"
          style={item(RUN, 2)}
        >
          {status}
        </p>
        <div className="mt-[22px]" style={item(["running"], 0, ff)}>
          <span className="bg-track text-secondary-ink inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold whitespace-nowrap">
            <FastForwardIcon aria-hidden className="size-[13px]" fill="currentColor" strokeWidth={0} />
            {COPY.fastForward}
          </span>
        </div>
      </div>
      <div
        ref={ringRef}
        aria-hidden
        className="border-done pointer-events-none absolute top-[176px] left-[calc(50%-75px)] size-[150px] rounded-full border-2 opacity-0"
      />

      {/* Post: the first post, with a photo if they like. The slot shrinks
          on a short phone rather than run under the CTA. */}
      <div
        {...group(pose(POST) === "active")}
        className="absolute inset-x-5 top-10 flex flex-col"
        style={{ ...group(pose(POST) === "active").style, bottom: aboveCta(12) }}
      >
        <h2
          className="text-ink shrink-0 font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.015em] text-pretty"
          style={item(POST, 1)}
        >
          {COPY.postHeading}
        </h2>
        <div className="mt-6 min-h-[160px] max-h-[340px] flex-1" style={item(POST, 2)}>
          <button
            ref={slotRef}
            type="button"
            onClick={pickPhoto}
            aria-label={photo ? "Change photo" : COPY.addPhoto}
            className={cn(
              "bg-inset relative block size-full overflow-hidden rounded-[14px] border-[1.5px] border-dashed transition-transform active:scale-[.99]",
              photo ? "border-transparent" : "border-disabled"
            )}
          >
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              <span className="bg-brand flex size-[52px] items-center justify-center rounded-full text-white shadow-[0_10px_22px_-10px_rgba(28,58,94,.55)]">
                <CameraIcon aria-hidden className="size-[22px]" />
              </span>
              <span className="text-body text-sm font-semibold">{COPY.addPhoto}</span>
              <span className="text-caption text-xs">{COPY.addPhotoHint}</span>
            </span>
            {photo && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                <img
                  ref={slotImgRef}
                  src={photo.url}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
                <span className="text-body absolute right-2.5 bottom-2.5 inline-flex h-7 items-center gap-[5px] rounded-full bg-white/92 px-[11px] text-[11.5px] font-semibold">
                  <CameraIcon aria-hidden className="size-3" />
                  {COPY.change}
                </span>
              </>
            )}
          </button>
        </div>
        <div
          className="mt-3 flex shrink-0 justify-center"
          style={{ ...item(POST, 3, !photo), pointerEvents: photo ? "none" : undefined }}
        >
          <button
            type="button"
            onClick={() => post(false)}
            tabIndex={photo ? -1 : undefined}
            className="text-caption hover:text-brand active:text-brand h-11 px-3.5 text-xs font-medium whitespace-nowrap"
          >
            {COPY.postWithout}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden
          className="hidden"
          onChange={onFile}
        />
      </div>

      {/* Posted: the post as their friends will see it. */}
      <div
        {...group(pose(POSTED) === "active")}
        className="absolute inset-x-5 top-10 flex flex-col gap-3.5"
      >
        <div className="bg-inset rounded-[22px] p-3.5" style={cardStyle}>
          <div className="flex flex-col gap-2.5 rounded-2xl bg-white px-4 py-3.5">
            <div className="flex items-start gap-[11px]">
              <AvatarInitials
                name={name.trim() || null}
                username={colorKey}
                avatarUrl={photoUrl}
                className="size-[34px] shrink-0 text-xs"
              />
              <p className="text-secondary-ink min-w-0 flex-1 pt-px text-[13px] leading-[1.4] text-pretty">
                <span className="text-body font-semibold">{me}</span> {COPY.joined}{" "}
                {/* The square stays with the goal's first word. */}
                <span className="whitespace-nowrap">
                  <span
                    aria-hidden
                    className="mr-1 mb-px ml-px inline-block size-[7px] rounded-[2px]"
                    style={{ background: goal.color }}
                  />
                  <span className="text-body font-semibold">{firstWord(goal.title)}</span>
                </span>
                <span className="text-body font-semibold">{restWords(goal.title)}</span>
              </p>
              <span className="text-faint shrink-0 pt-px text-xs">{COPY.justNow}</span>
            </div>
            {photo && (
              <div
                ref={cardPhotoRef}
                className="bg-track h-[min(282px,36dvh)] origin-top-left overflow-hidden rounded-[14px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL */}
                <img src={photo.url} alt="" className="block size-full object-cover" />
              </div>
            )}
            <div className="flex justify-end">
              <span
                aria-hidden
                className="border-hairline text-disabled inline-flex items-center gap-0.5 rounded-full border p-0.5"
              >
                <span className="inline-flex px-2 py-[3px]">
                  <MessageCircleIcon className="size-[13px]" />
                </span>
                <span className="inline-flex px-2 py-[3px]">
                  <HeartIcon className="size-[13px]" />
                </span>
              </span>
            </div>
          </div>
        </div>
        <p className="text-secondary-ink px-0.5 text-[13px] leading-[1.45] text-pretty" style={item(POSTED, 4)}>
          {COPY.posted}
        </p>
      </div>
    </div>
  );
}

// A title split after its first word, so the square before it never sits on
// a line of its own and a long title can still wrap.
function firstWord(title: string): string {
  const at = title.indexOf(" ");
  return at < 0 ? title : title.slice(0, at);
}
function restWords(title: string): string {
  const at = title.indexOf(" ");
  return at < 0 ? "" : title.slice(at);
}

// Today's date over the Clock in phase ("MON, OCT 19"). A leaf, so the
// minute tick re-renders only this. Empty until hydrated.
function TodayMeta() {
  const now = useNowMinute();
  if (!now) return <span className={META} />;
  const text = new Date(now)
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
  return <span className={META}>{text}</span>;
}

// "Clocks you out at {now + 25 min}", under the timer row. A leaf, as above.
function EndsAt() {
  const now = useNowMinute();
  return (
    <span className="text-faint text-[11px]">
      {now ? `Clocks you out at ${formatTime12(new Date(now + PRACTICE_SECS * 1000))}` : " "}
    </span>
  );
}
