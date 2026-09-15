"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

import { ColorSwatches } from "@/components/color-swatches";
import { goalDisplay } from "@/lib/onboarding";

import { CARD, Field, PreviewRing, Stepper, UNDERLINE_INPUT } from "../onboarding-ui";
import { StepTemplate } from "../onboarding-ui";

// Step 2. The first goal — title, colour, hours — with a live preview of how
// it'll sit on the Progress tab, so the colour and number they pick are the
// ones they keep seeing.
export function GoalStep({
  eyebrow,
  title,
  onTitle,
  color,
  onColor,
  hours,
  onHours,
  onSubmit,
  pending,
}: {
  eyebrow: string | null;
  title: string;
  onTitle: (v: string) => void;
  color: string;
  onColor: (v: string) => void;
  hours: number;
  onHours: (v: number) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Set your first goal."
      body={
        <>
          {/* A marker highlight sweeping across the one sentence that matters,
              a beat after the copy lands. */}
          <strong
            className="text-ink -mx-[3px] -my-px rounded-[3px] px-[3px] py-px font-bold [box-decoration-break:clone]"
            style={{
              backgroundImage:
                "linear-gradient(color-mix(in srgb, var(--cat-mustard) 28%, transparent), color-mix(in srgb, var(--cat-mustard) 28%, transparent))",
              backgroundRepeat: "no-repeat",
              backgroundSize: "0% 100%",
              backgroundPosition: "0 55%",
              animation: "hl-sweep .7s cubic-bezier(.22,1,.36,1) 1.2s both",
            }}
          >
            BUT, make sure it&apos;s something you can put hours in.
          </strong>{" "}
          Instead of saying{" "}
          <span className="text-destructive">&quot;get a 4.0 in math&quot;</span>, say{" "}
          <strong className="text-ink font-semibold">&quot;study math 6hr a week&quot;</strong>.
        </>
      }
    >
      <Field label="Your goal">
        <input
          className={UNDERLINE_INPUT}
          placeholder="e.g. Study math"
          maxLength={120}
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim() && !pending) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
      </Field>
      <Field label="Color">
        {/* Re-tapping the selected swatch sends null (it's a "clear" elsewhere
            in the app); here a goal always has a colour, so that's ignored. */}
        <ColorSwatches value={color} onChange={(v) => v && onColor(v)} />
      </Field>
      <Field label="Hours per week">
        <div className="flex items-center gap-4">
          <Stepper
            label="Fewer hours"
            disabled={hours <= 1}
            onClick={() => onHours(Math.max(1, hours - 1))}
          >
            <MinusIcon className="size-4" strokeWidth={2} />
          </Stepper>
          <span className="stat-num min-w-[74px] text-center text-[30px] leading-none">
            {hours}h
          </span>
          <Stepper
            label="More hours"
            disabled={hours >= 40}
            onClick={() => onHours(Math.min(40, hours + 1))}
          >
            <PlusIcon className="size-4" strokeWidth={2} />
          </Stepper>
        </div>
      </Field>

      <div className={`${CARD} flex items-center gap-3.5 p-3.5`}>
        <PreviewRing color={color} />
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="section-label">On your Progress tab</span>
          <span className="text-ink truncate text-sm font-semibold">
            {goalDisplay(title)}
          </span>
          <span
            className="font-serif text-[20px] font-medium tracking-[-0.03em] transition-colors duration-300"
            style={{ color }}
          >
            {hours}h
            <span className="text-caption font-sans text-xs tracking-normal"> / week</span>
          </span>
        </div>
      </div>
    </StepTemplate>
  );
}
