"use client";

import { CheckIcon, ImageIcon } from "lucide-react";

import { AvatarInitials } from "@/components/avatar-initials";
import { goalDisplay } from "@/lib/onboarding";

import { CARD, StepTemplate } from "../onboarding-ui";

// Step 6 (practice). A fake post of the practice session. Says so on screen,
// and writes nothing.
export function PostStep({
  eyebrow,
  name,
  username,
  avatarUrl,
  goalTitle,
  goalColor,
  photo,
  onPhoto,
  caption,
  onCaption,
  posted,
  onPost,
}: {
  eyebrow: string | null;
  name: string | null;
  username: string;
  avatarUrl: string | null;
  goalTitle: string;
  goalColor: string;
  photo: boolean;
  onPhoto: () => void;
  caption: string;
  onCaption: (v: string) => void;
  posted: boolean;
  onPost: () => void;
}) {
  return (
    <StepTemplate
      eyebrow={eyebrow}
      title="Show your work."
      body={
        <>
          Clock out, snap what you did, and post it to your friends.{" "}
          <strong className="text-body font-semibold">
            This one&apos;s practice, so don&apos;t worry - nothing gets posted.
          </strong>
        </>
      }
    >
      <div className={`${CARD} flex flex-col gap-3 p-4`}>
        <div className="flex items-center gap-2.5">
          <AvatarInitials
            name={name}
            username={username}
            avatarUrl={avatarUrl}
            className="size-[34px] text-xs"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-body text-[13px] font-semibold">Your first session</span>
            <span className="text-faint truncate text-[11px]">
              25m · {goalDisplay(goalTitle)}
            </span>
          </div>
          <span
            aria-hidden
            className="size-[9px] shrink-0 rounded-[2px]"
            style={{ backgroundColor: goalColor }}
          />
        </div>
        {photo ? (
          <div className="check-pop flex h-[76px] items-center justify-center gap-2 rounded-[12px] bg-linear-to-br from-sand to-track">
            <ImageIcon className="size-4 text-secondary-ink" strokeWidth={2} />
            <span className="text-xs font-semibold whitespace-nowrap text-secondary-ink">
              desk-photo.jpg attached
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPhoto}
            className="text-caption border-disabled hover:border-brand bg-inset-2 flex h-[76px] w-full items-center justify-center gap-2 rounded-[12px] border-[1.5px] border-dashed text-[12.5px] font-semibold transition-colors"
          >
            <ImageIcon className="size-4" strokeWidth={2} />
            Add a photo
          </button>
        )}
        <input
          className="text-ink w-full border-b-2 border-hairline bg-transparent pb-2 text-sm transition-colors outline-none placeholder:text-disabled focus:border-brand"
          placeholder="Say something about it…"
          value={caption}
          onChange={(e) => onCaption(e.target.value)}
        />
        {posted ? (
          <div className="check-pop flex items-center gap-2 pt-0.5">
            <CheckIcon className="size-4 text-success" strokeWidth={2.4} />
            <span className="text-[13px] font-semibold text-success">
              That&apos;s the whole flow. Nothing was posted.
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPost}
            className="bg-brand text-primary-foreground h-[46px] w-full rounded-[13px] text-sm font-semibold transition-transform active:scale-[.98]"
          >
            Post to feed
          </button>
        )}
      </div>
    </StepTemplate>
  );
}
