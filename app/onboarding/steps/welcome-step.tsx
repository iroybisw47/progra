"use client";

import Image from "next/image";
import { CheckIcon } from "lucide-react";
import { useId, type Ref } from "react";

import { AvatarPicker } from "@/components/avatar-picker";
import { PrograMark } from "@/components/progra-mark";
import { TypedHeadline } from "@/components/v2/typed-headline";

import { Field, UNDERLINE_INPUT, rise } from "../onboarding-ui";

// Step 0. Who you are: a name (optional), the handle Progra needs before
// anything can be shared, and a photo. Vertically centred, unlike the
// numbered steps, and its headline is the big 40px one.
//
// v2 no longer asks the UW question (plan P9a): the cohort moved to onboarding
// v3, so v2 runs without UW whatever the flag says.
//
// Onboarding v3 mounts this same step as its Screen 1 (OWNER-FIX-3), with
// three optional props v2 never passes, so v2 renders exactly as before:
//   logo           "rainbow" is the app's current icon (/progra-logo.png, as
//                  the What's New modal shows it) in place of the navy mark,
//                  with the mark's pop-in and shadow but no drift
//   uploadAvatar,  the photo's two writes, for v3's services, so its dev
//   removeAvatar   preview never reaches the real actions (AvatarPicker)
//   usernameRef    the handle's input, which v3 focuses when setUsername
//                  refuses the handle as taken
// The UW question is a sheet v3 raises over this screen once its Continue has
// saved the identity, not part of the step.
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
  logo = "mark",
  uploadAvatar,
  removeAvatar,
  usernameRef,
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
  logo?: "mark" | "rainbow";
  uploadAvatar?: (formData: FormData) => Promise<{ ok: true } | { error: string }>;
  removeAvatar?: () => Promise<{ ok: true } | { error: string }>;
  usernameRef?: Ref<HTMLInputElement>;
}) {
  // The handle's error, read with its input.
  const usernameErrorId = useId();
  return (
    <div className="flex flex-1 flex-col justify-center gap-[22px] pb-10">
      {logo === "rainbow" ? (
        // 144px on disk, so unoptimized: next/image would only serve 1x/2x
        // of a fixed-width image (the What's New modal's reason). Eager, as
        // it's the first thing on the screen. Named like the mark.
        <Image
          src="/progra-logo.png"
          alt="Progra"
          width={58}
          height={58}
          unoptimized
          loading="eager"
          className="size-[58px] shrink-0 rounded-[13px] shadow-[0_14px_30px_-12px_var(--glow)]"
          style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both" }}
        />
      ) : (
        <PrograMark
          size={58}
          motion="drift"
          className="shadow-[0_14px_30px_-12px_var(--glow)]"
          style={{ animation: "pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both" }}
        />
      )}
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
        <Field label="Username" error={usernameError ?? undefined} errorId={usernameErrorId}>
          <div className="flex items-center">
            <span className="text-caption pr-1 text-[19px]">@</span>
            <input
              ref={usernameRef}
              className={`${UNDERLINE_INPUT} flex-1`}
              aria-invalid={usernameError ? true : undefined}
              aria-describedby={usernameError ? usernameErrorId : undefined}
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
          upload={uploadAvatar}
          remove={removeAvatar}
        />
      </div>
    </div>
  );
}
