"use client";

import { CheckIcon } from "lucide-react";

import { AvatarPicker } from "@/components/avatar-picker";
import { PrograMark } from "@/components/progra-mark";
import { TypedHeadline } from "@/components/v2/typed-headline";
import { UW } from "@/lib/flags";
import { PALETTE } from "@/lib/palette";

import { Field, UNDERLINE_INPUT, rise } from "../onboarding-ui";

// Step 0. Who you are: a name (optional), the handle Progra needs before
// anything can be shared, and a photo. Vertically centred, unlike the
// numbered steps, and its headline is the big 40px one.
//
// Also where the UW question is asked, which looks like an odd place for it
// until you read activeSteps() in lib/onboarding.ts: the answer decides whether
// the run is 8 steps or 9, and the step list may only change length while the
// user is still standing on THIS step at index 0. Asked any later, the "Step N
// of M" eyebrow and the progress dots would renumber under them.
export function WelcomeStep({
  displayName,
  onDisplayName,
  username,
  onUsername,
  usernameValid,
  usernameError,
  initialDisplayName,
  initialUsername,
  avatarUrl,
  isUw,
  onIsUw,
  onSubmit,
  pending,
}: {
  displayName: string;
  onDisplayName: (v: string) => void;
  username: string;
  onUsername: (v: string) => void;
  usernameValid: boolean;
  usernameError: string | null;
  initialDisplayName: string | null;
  initialUsername: string;
  avatarUrl: string | null;
  isUw: boolean;
  onIsUw: (v: boolean) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-[22px] pb-10">
      <PrograMark
        size={58}
        motion="drift"
        className="shadow-[0_14px_30px_-12px_rgba(28,58,94,.55)]"
        style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both" }}
      />
      <TypedHeadline
        text={"Welcome to\nProgra."}
        className="text-ink rise font-serif text-[40px] leading-[1.08] font-medium tracking-[-0.02em]"
        style={rise(".1s")}
      />
      <p
        className="rise text-[15px] leading-[1.6] text-pretty text-secondary-ink"
        style={rise(".22s")}
      >
        Hours toward your goals, with friends watching.
      </p>

      <div className="rise flex flex-col gap-3.5 pt-1" style={rise(".38s")}>
        <Field label="Your name" hint="Optional">
          <input
            className={UNDERLINE_INPUT}
            placeholder="Your name"
            maxLength={50}
            value={displayName}
            onChange={(e) => onDisplayName(e.target.value)}
          />
        </Field>
        <Field label="Username" error={usernameError ?? undefined}>
          <div className="flex items-center">
            <span className="text-caption pr-1 text-[19px]">@</span>
            <input
              className={`${UNDERLINE_INPUT} flex-1`}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="yourhandle"
              value={username}
              onChange={(e) => onUsername(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && usernameValid && !pending) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
            {usernameValid && (
              <CheckIcon
                className="check-pop text-brand ml-2 size-5 shrink-0"
                strokeWidth={2.2}
              />
            )}
          </div>
        </Field>
        <AvatarPicker
          name={displayName.trim() || initialDisplayName}
          username={username.trim() || initialUsername || "?"}
          avatarUrl={avatarUrl}
          sizeClassName="size-14 text-lg"
        />
        {UW && (
          // Deliberately bigger than a CheckTile: this one tick decides whether
          // the run is 8 steps or 9, so it has to read as a question rather
          // than as a preference tucked under the avatar.
          <button
            type="button"
            aria-pressed={isUw}
            onClick={() => onIsUw(!isUw)}
            className="mt-1 flex w-full items-center gap-3.5 rounded-[15px] border-[1.5px] bg-white px-4 py-[15px] text-left transition-[transform,border-color] duration-150 active:scale-[.98]"
            style={{
              borderColor: isUw ? PALETTE[7].fill : "var(--control-border)",
            }}
          >
            <span
              className="flex size-[24px] shrink-0 items-center justify-center rounded-[8px] border-[1.5px] text-white transition-colors duration-150"
              style={{
                borderColor: isUw ? PALETTE[7].fill : "var(--disabled)",
                backgroundColor: isUw ? PALETTE[7].fill : "#fff",
              }}
            >
              {isUw && <CheckIcon className="check-pop size-4" strokeWidth={3} />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="text-ink text-[16px] leading-tight font-semibold">
                I&apos;m a UW student
              </span>
              <span className="text-caption text-[12.5px] leading-snug">
                Get matched with Huskies in your major and clubs
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
