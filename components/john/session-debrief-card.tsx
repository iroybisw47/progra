"use client";

import {
  FOCUS_RATINGS,
  OUTCOME_MAX,
  PHONE_LEVELS,
  PHONE_LEVEL_LABELS,
  type FocusRating,
  type PhoneLevel,
} from "@/lib/john/instrumentation";
import { cn } from "@/lib/utils";

// The John debrief: the "after" half of the pair whose "before" was typed at
// clock-in. ONE card rather than three blocks — the finish screen is already a
// dense single sheet, and three stacked sections would push Post off a phone.
//
// Controlled: it owns no action and no transition. finish-client submits these
// through the updateSession call it already makes, so posting stays one
// round-trip.

type Props = {
  // What they said they were going to do, echoed read-only. Without it,
  // "what actually happened?" has nothing to be measured against.
  intention: string | null;
  outcome: string;
  onOutcomeChange: (v: string) => void;
  focus: FocusRating | null;
  onFocusChange: (v: FocusRating) => void;
  phone: PhoneLevel | null;
  onPhoneChange: (v: PhoneLevel) => void;
  disabled?: boolean;
};

const PILL =
  "h-11 flex-1 rounded-[14px] border-[1.5px] text-[15px] font-bold transition-transform active:scale-[.97] disabled:opacity-50";
const PILL_OFF = "border-control-border text-caption";
const PILL_ON = "border-brand bg-brand/10 text-brand";

export function SessionDebriefCard({
  intention,
  outcome,
  onOutcomeChange,
  focus,
  onFocusChange,
  phone,
  onPhoneChange,
  disabled = false,
}: Props) {
  return (
    <div className="border-hairline flex flex-col gap-4 rounded-[22px] border p-5">
      {intention && (
        <div className="bg-inset rounded-[16px] px-3.5 py-3">
          <div className="text-caption text-[13px] font-semibold tracking-[0.04em] uppercase">
            You said
          </div>
          <div className="mt-1 text-[15px] leading-snug">{intention}</div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="finish-outcome" className="text-[15px] font-bold">
          What actually happened?
        </label>
        {/* A single-line input, not a Textarea: the shape of the control is the
            instruction. Notes below is where a paragraph belongs. */}
        <input
          id="finish-outcome"
          value={outcome}
          onChange={(e) => onOutcomeChange(e.target.value)}
          placeholder="Optional"
          maxLength={OUTCOME_MAX}
          disabled={disabled}
          className="bg-inset text-ink h-11 w-full rounded-[16px] px-3.5 text-[15px] outline-none placeholder:text-disabled disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-[15px] font-bold">How focused were you?</div>
        <div className="flex gap-2">
          {FOCUS_RATINGS.map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Focus ${n} of 5`}
              aria-pressed={focus === n}
              disabled={disabled}
              onClick={() => onFocusChange(n as FocusRating)}
              className={cn(PILL, focus === n ? PILL_ON : PILL_OFF)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* Stands in for Screen Time, which the app cannot read. */}
        <div className="text-[15px] font-bold">Phone pulling at you?</div>
        <div className="flex gap-2">
          {PHONE_LEVELS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={phone === p}
              disabled={disabled}
              onClick={() => onPhoneChange(p)}
              className={cn(PILL, phone === p ? PILL_ON : PILL_OFF)}
            >
              {PHONE_LEVEL_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
