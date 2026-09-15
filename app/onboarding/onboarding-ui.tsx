"use client";

import { CheckIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { TypedHeadline } from "@/components/v2/typed-headline";
import { cn } from "@/lib/utils";

// The pieces every onboarding step is built from. Presentational; the shell
// (onboarding-client-v2.tsx) owns all state.

export const rise = (delay: string): CSSProperties =>
  ({ "--rise-delay": delay }) as CSSProperties;

// The design's underline input: no box, a 2px hairline underneath that turns
// navy on focus, 19px/500.
export const UNDERLINE_INPUT =
  "text-ink w-full min-w-0 border-b-2 border-hairline bg-transparent pb-2 text-[19px] font-medium tracking-[-0.01em] transition-colors outline-none placeholder:text-disabled focus:border-brand";

// A content card: 1.5px stroke, 16px radius.
export const CARD = "border-control-border rounded-[16px] border-[1.5px]";

// The shared shape of a step: eyebrow, the headline typing itself in, body
// copy, then whatever that step's controls are — each entering on the rise
// stagger (0 / .1 / .25 / .4s).
export function StepTemplate({
  eyebrow,
  title,
  titleClassName = "text-[30px] leading-[1.12]",
  body,
  children,
}: {
  eyebrow: string | null;
  title: string;
  titleClassName?: string;
  body: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[18px] pt-[18px] pb-6">
      {eyebrow && <span className="section-label rise">{eyebrow}</span>}
      <TypedHeadline
        text={title}
        className={cn(
          "text-ink rise font-serif font-medium tracking-[-0.02em]",
          titleClassName
        )}
        style={rise(".1s")}
      />
      <p
        className="rise text-sm leading-[1.6] text-pretty text-secondary-ink"
        style={rise(".25s")}
      >
        {body}
      </p>
      <div className="rise flex flex-col gap-[18px]" style={rise(".4s")}>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  // A quiet note ("Optional"); `error` is the same slot in terracotta.
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="section-label">{label}</span>
        {(error || hint) && (
          <span className={cn("text-[11px]", error ? "text-destructive" : "text-faint")}>
            {error ?? hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Stepper({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-hairline text-caption flex size-[38px] items-center justify-center rounded-[12px] border-[1.5px] transition-transform active:scale-90 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

// One promise, ticked in green.
export function CheckLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <CheckIcon className="mt-[3px] size-[15px] shrink-0 text-success" strokeWidth={2.4} />
      <span className="text-body text-[13.5px] leading-[1.45]">{children}</span>
    </div>
  );
}

// A habit tile: an 18px box that fills in the habit's colour when picked.
export function CheckTile({
  name,
  color,
  on,
  onToggle,
}: {
  name: string;
  color: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className="text-body flex min-w-0 items-center gap-[7px] rounded-[12px] border-[1.5px] bg-white px-2.5 py-[9px] text-[12.5px] font-semibold transition-[transform,border-color] duration-150 active:scale-[.96]"
      style={{ borderColor: on ? color : "var(--control-border)" }}
    >
      <span
        className="flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] text-white transition-colors duration-150"
        style={{
          borderColor: on ? color : "var(--disabled)",
          backgroundColor: on ? color : "#fff",
        }}
      >
        {on && <CheckIcon className="check-pop size-3" strokeWidth={3.2} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{name}</span>
    </button>
  );
}

// The goal preview's 84px ring, filling to ~62% in the goal's colour.
export function PreviewRing({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 96 96" width={84} height={84} className="shrink-0" aria-hidden>
      <circle cx="48" cy="48" r="38" fill="none" stroke="var(--track)" strokeWidth="8" />
      <circle
        cx="48"
        cy="48"
        r="38"
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="238.76"
        transform="rotate(-90 48 48)"
        style={{
          animation: "wheel-fill 1.1s cubic-bezier(.22,1,.36,1) .3s both",
          transition: "stroke .3s",
        }}
      />
    </svg>
  );
}
