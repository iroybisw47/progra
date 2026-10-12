"use client";

import { CheckIcon } from "lucide-react";

import { ReviewStats } from "@/components/v2/review-stats";
import { useKeyboardInset } from "@/lib/hooks";
import { anim } from "@/lib/recap-story-nav";
import { cn } from "@/lib/utils";
import type { ShareView } from "@/lib/recap-story";
import { CAPTION_MAX, normalizeCaption, reviewStats } from "@/lib/weekly-review";

import { SlideFrame, SlideTitle, stopStory } from "./slide-frame";

// Share your week (owner, 2026-10-12): post the week — hours tracked, % towards
// goals, % of habits done — to friends' feeds and your own You tab, with an
// optional caption. Just before Closing; tapping outside the composer (or
// "Not this week") moves on without posting. No handoff frame: drawn from the
// story's parts (title block, the navy-wash panel, the 15px-radius button).
//
// The draft and the posted state live in the controller, not here — every
// move remounts the slide, and a post made here must survive that.
export function ShareSlide({
  share,
  weekSpanLabel,
  draft,
  onDraft,
  posted,
  posting,
  onPost,
  onSkip,
}: {
  share: ShareView;
  weekSpanLabel: string;
  draft: string;
  onDraft: (text: string) => void;
  posted: { id: string; caption: string | null } | null;
  posting: boolean;
  onPost: () => void;
  onSkip: () => void;
}) {
  const inset = useKeyboardInset();
  const normalized = normalizeCaption(draft);
  const changed = "caption" in normalized && normalized.caption !== (posted?.caption ?? null);
  const label = posting ? "Posting…" : !posted ? "Post to feed" : changed ? "Update caption" : "Posted";

  return (
    <SlideFrame
      label="Share your week"
      // Above the keyboard while typing, so the field and the button stay in view.
      style={{ paddingBottom: inset > 0 ? `${inset + 12}px` : "calc(var(--rs-bottom) + 10px)" }}
    >
      <SlideTitle
        title="Share your week"
        sub={
          share.audience === "friends"
            ? "Your friends will see it in their feed"
            : "Only you will see it until you add friends"
        }
      />
      <div className="flex flex-1 flex-col justify-center gap-[22px] pt-6 pb-4">
        <div
          className="flex flex-col gap-4 rounded-[25.92px] px-5 pt-4 pb-5"
          style={{ background: "rgba(28,58,94,.05)", animation: anim("rise", 0.55, 0.2) }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-faint text-[10px] leading-none font-semibold tracking-[.14em] whitespace-nowrap uppercase">
              {weekSpanLabel}
            </span>
            {posted && (
              <span
                role="status"
                className="text-done flex shrink-0 items-center gap-[3px] rounded-full py-0.5 pr-2 pl-1.5 text-[10.5px] font-bold tracking-[.02em]"
                style={{ background: "rgba(38,107,77,.1)", animation: anim("check", 0.4, 0, "ease") }}
              >
                <CheckIcon size={11} strokeWidth={3.4} aria-hidden />
                Posted
              </span>
            )}
          </div>
          <ReviewStats stats={reviewStats(share.summary)} />
        </div>

        {/* Its taps type and post; they must never also turn the page. */}
        <div
          className="flex flex-col gap-3"
          style={{ animation: anim("rise", 0.5, 0.45) }}
          onPointerDown={stopStory}
          onPointerUp={stopStory}
        >
          <label className="sr-only" htmlFor="review-caption">
            Caption
          </label>
          <textarea
            id="review-caption"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              // One line of text: Return finishes typing rather than adding a line.
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            maxLength={CAPTION_MAX}
            rows={3}
            enterKeyHint="done"
            placeholder="Add a caption (optional)"
            className="border-control-border text-body placeholder:text-faint w-full resize-none rounded-[15px] border-[1.5px] bg-white px-4 py-3 text-[16px] leading-[1.4] outline-none select-text focus:border-[var(--brand)] [-webkit-touch-callout:default] [-webkit-user-select:text]"
          />
          {draft.length > 200 && (
            <span className="text-caption -mt-1 self-end text-[11px] tabular-nums">
              {draft.length}/{CAPTION_MAX}
            </span>
          )}
          <button
            type="button"
            onClick={onPost}
            disabled={posting || (posted !== null && !changed)}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[15px] border-0 text-base font-semibold transition-transform duration-150 active:scale-[.98]",
              label === "Posted"
                ? "text-done bg-[rgba(38,107,77,.1)]"
                : "bg-brand text-white disabled:opacity-60"
            )}
          >
            {label === "Posted" && <CheckIcon size={16} strokeWidth={3} aria-hidden />}
            {label}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-caption self-center border-0 bg-transparent px-3 py-1.5 text-[13.5px] font-medium"
          >
            {posted ? "Continue" : "Not this week"}
          </button>
        </div>
      </div>
    </SlideFrame>
  );
}
