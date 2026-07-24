"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

// The conversational text engine: on each step, a typing indicator plays, then
// the title + body lines stream in word-by-word with a caret, then the step's
// controls + CTA fade up. Tap anywhere while streaming to fast-forward. Honors
// prefers-reduced-motion (mounts straight into the "ready" phase). Faithful to
// the design prototype's state machine (Progra Onboarding.dc.html).
//
// Colors resolve to Progra's navy V2 tokens (bg-brand/text-*), NOT the
// handoff's green — structure/motion/copy match the handoff, hues are ours.

export type Utterance = { big: boolean; text: string };

// Per-word reveal cadence (ms).
const TITLE_WORD_MS = 72;
const BODY_WORD_MS = 34;
const TYPING_MS = 650;
const BETWEEN_UTTER_MS = 320;
const AFTER_LAST_MS = 280;

type Phase = "typing" | "streaming" | "ready";
type State = { phase: Phase; utter: number; shown: number };
type Action =
  | { type: "start" }
  | { type: "reveal" } // +1 word in current utterance
  | { type: "nextUtter" }
  | { type: "ready" }
  | { type: "fastForward"; lastUtter: number; lastWords: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { phase: "streaming", utter: 0, shown: 0 };
    case "reveal":
      return { ...state, shown: state.shown + 1 };
    case "nextUtter":
      return { ...state, utter: state.utter + 1, shown: 0 };
    case "ready":
      return { ...state, phase: "ready" };
    case "fastForward":
      return {
        phase: "ready",
        utter: action.lastUtter,
        shown: action.lastWords,
      };
    default:
      return state;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function Conversation({
  utterances,
  stepKey,
  onReady,
  children,
}: {
  utterances: Utterance[];
  // Re-runs the whole sequence when this changes (one per wizard step).
  stepKey: string;
  // Fires once the text finishes — lets a pinned-outside CTA bar fade in.
  onReady?: () => void;
  // The step's controls — rendered (and cascaded in) once text finishes.
  children?: ReactNode;
}) {
  // Words split once per render; cheap.
  const words = utterances.map((u) => u.text.split(" "));
  const lastUtter = utterances.length - 1;
  const lastWords = words[lastUtter]?.length ?? 0;

  // Fixed for the component's life — lazy useState (not a ref) so it's safe to
  // read during render.
  const [instant] = useState(prefersReducedMotion);
  const [state, dispatch] = useReducer(
    reducer,
    instant
      ? { phase: "ready" as Phase, utter: lastUtter, shown: lastWords }
      : { phase: "typing" as Phase, utter: 0, shown: 0 }
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drive the sequence. Keyed on stepKey so each step restarts cleanly; all
  // scheduling lives here (an external system — the clock — so effect-driven
  // setState is correct, not the discouraged render-sync pattern).
  useEffect(() => {
    if (instant) return;
    // Kick off: typing indicator, then start streaming.
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
    };
    clear();
    timer.current = setTimeout(() => dispatch({ type: "start" }), TYPING_MS);
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  // Advance streaming as state changes.
  useEffect(() => {
    if (instant || state.phase !== "streaming") return;
    const cur = words[state.utter] ?? [];
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
    };
    clear();
    if (state.shown < cur.length) {
      const ms = utterances[state.utter]?.big ? TITLE_WORD_MS : BODY_WORD_MS;
      timer.current = setTimeout(() => dispatch({ type: "reveal" }), ms);
    } else if (state.utter < lastUtter) {
      timer.current = setTimeout(
        () => dispatch({ type: "nextUtter" }),
        BETWEEN_UTTER_MS
      );
    } else {
      timer.current = setTimeout(() => dispatch({ type: "ready" }), AFTER_LAST_MS);
    }
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.utter, state.shown, stepKey]);

  function fastForward() {
    if (instant || state.phase === "ready") return;
    if (timer.current) clearTimeout(timer.current);
    dispatch({ type: "fastForward", lastUtter, lastWords });
  }

  // Notify the parent once, whenever this step reaches the ready phase.
  const readyFired = useRef(false);
  useEffect(() => {
    readyFired.current = false;
  }, [stepKey]);
  useEffect(() => {
    if (state.phase === "ready" && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [state.phase, onReady]);

  const streaming = state.phase === "streaming";
  const ready = state.phase === "ready";

  return (
    <div
      data-onboarding
      onClick={fastForward}
      className="flex flex-col gap-3.5"
    >
      {state.phase === "typing" ? (
        <TypingIndicator />
      ) : (
        <div className="flex flex-col gap-[13px]">
          {utterances.map((u, i) => {
            // How many words of THIS utterance are visible.
            const visible =
              ready || i < state.utter
                ? words[i].length
                : i === state.utter
                  ? state.shown
                  : 0;
            if (visible === 0 && !ready) return null;
            const showCaret = streaming && i === state.utter;
            return (
              <p
                key={i}
                className={
                  u.big
                    ? "text-ink text-[26px] font-bold leading-[1.25] tracking-[-0.02em]"
                    : "text-body text-[15px] leading-[1.6]"
                }
              >
                {words[i].slice(0, visible).map((w, wi) => (
                  <span
                    key={wi}
                    className="inline-block"
                    style={{
                      marginRight: "0.27em",
                      animation: instant
                        ? undefined
                        : "word-in 0.32s ease both",
                    }}
                  >
                    {w}
                  </span>
                ))}
                {showCaret && (
                  <span
                    aria-hidden
                    className="bg-brand ml-0.5 inline-block h-[1em] w-[3px] translate-y-[0.12em] rounded-[2px]"
                    style={{ animation: "caret-blink 0.9s step-end infinite" }}
                  />
                )}
              </p>
            );
          })}
        </div>
      )}

      {/* Controls cascade in once the text is done. */}
      {ready && children && (
        <div className="mt-2 flex flex-col gap-6">{children}</div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div
      aria-label="Progra is typing"
      className="bg-track flex w-fit items-center gap-1.5 rounded-full px-[15px] py-3"
    >
      {[0, 0.15, 0.3].map((d) => (
        <span
          key={d}
          className="bg-brand size-1.5 rounded-full"
          style={{ animation: `dot-bounce 1.05s ${d}s ease-in-out infinite` }}
        />
      ))}
    </div>
  );
}

// Staggered fade-up for a control block (0 / 0.08 / 0.16s per index). Wrap each
// control in the "ready" area with this for the cascade.
export function ControlBlock({
  index = 0,
  children,
}: {
  index?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{ animation: `fade-up 0.5s ${index * 0.08}s ease both` }}
    >
      {children}
    </div>
  );
}
