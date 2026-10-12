import { XIcon } from "lucide-react";

import { anim } from "@/lib/recap-story-nav";
import { cn } from "@/lib/utils";

import { stopStory } from "./slide-frame";

// The story's chrome on every slide after Loading: one pip per slide (filled up
// to and including this one — nothing auto-advances, so no timer fill) and the
// close X. On the navy Closing slide it turns white and fades in behind the
// flood. Two visually hidden buttons give VoiceOver and keyboard users the page
// turns that sighted users get from tapping either half.
export function StoryHeader({
  count,
  current,
  dark,
  onClose,
  onPrev,
  onNext,
  label,
}: {
  count: number;
  current: number;
  dark: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  return (
    <header
      key={dark ? "dark" : "light"}
      className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 pr-1.5 pl-4"
      style={{
        paddingTop: "var(--rs-top)",
        animation: dark ? anim("fade", 0.35, 0.55, "ease") : undefined,
      }}
    >
      <div aria-hidden className="flex flex-1 items-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            className="block h-1 flex-1 overflow-hidden rounded-full"
            style={{ background: dark ? "rgba(255,255,255,.2)" : "var(--track)" }}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-300 ease-out"
              style={{ background: dark ? "#ffffff" : "var(--brand)", width: i <= current ? "100%" : "0%" }}
            />
          </span>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {label}
      </p>
      <button
        type="button"
        className="sr-only"
        onClick={onPrev}
        onPointerDown={stopStory}
        onPointerUp={stopStory}
      >
        Previous slide
      </button>
      <button
        type="button"
        className="sr-only"
        onClick={onNext}
        onPointerDown={stopStory}
        onPointerUp={stopStory}
      >
        Next slide
      </button>
      <button
        type="button"
        aria-label="Close recap"
        onClick={onClose}
        onPointerDown={stopStory}
        onPointerUp={stopStory}
        className={cn(
          "flex h-7 w-11 shrink-0 items-center justify-center border-0 bg-transparent p-0",
          dark ? "text-white/65" : "text-caption"
        )}
      >
        <XIcon size={20} strokeWidth={2} aria-hidden />
      </button>
    </header>
  );
}
