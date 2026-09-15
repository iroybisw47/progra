"use client";

import { CheckIcon } from "lucide-react";

import { AvatarPicker } from "@/components/avatar-picker";
import { PrograMark } from "@/components/progra-mark";
import { TypedHeadline } from "@/components/v2/typed-headline";

import { Field, UNDERLINE_INPUT, rise } from "../onboarding-ui";

// Step 0. Who you are: a name (optional), the handle Progra needs before
// anything can be shared, and a photo. Vertically centred, unlike the
// numbered steps, and its headline is the big 40px one.
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
      </div>
    </div>
  );
}
