"use client";

import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { SparklesIcon } from "lucide-react";

import { markPatchNotesSeen } from "@/app/actions/profile";
import { PrimaryButton } from "@/components/v2/primary-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// "What's new" — one release note, shown once, on the first Progress load after
// a release this user hasn't been stamped for. The server already decided this
// should exist (app/layout.tsx reads profiles.patch_notes_seen_version through
// patchNoteToShow), so it opens at mount rather than through an effect.
//
// EVERY close path goes through dismiss(), which stamps: the CTA, the backdrop,
// Escape. Same rule as PlanCompleteModal and for its reason — a dismiss that
// didn't write would reopen this on every page load.
//
// Drawn in the app's own tokens (bg-card / text-ink / text-caption /
// PrimaryButton), not the shadcn ones its sibling still uses; auto-end-nudge.tsx
// was rewritten for exactly that drift.
export function WhatsNewModal({
  version,
  title,
  intro,
  items,
}: {
  version: string;
  title: string;
  intro?: string;
  items: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  function dismiss() {
    setOpen(false);
    // Best-effort, matching PlanCompleteModal: on failure the note returns next
    // load rather than blocking anything. On success the action revalidates the
    // layout, so this drops out of the server tree in the same round-trip — no
    // router.refresh() needed, and AGENTS.md forbids one anyway.
    startTransition(async () => {
      await markPatchNotesSeen(version);
    });
  }

  // Progress only. An ALLOWLIST, not a list of screens to dodge: this leaf lives
  // in the root layout, so a denylist would have to be right about /clock/live,
  // /clock/finish's unsaved wizard, the recap story, and every route added after
  // it. "/" is the post-login landing and the first nav tab, so nobody misses a
  // note by more than one tap — and it's the screen the notes are usually about.
  // Deferral comes free: open /clock/live and nothing shows; go to "/" and it does.
  //
  // After the hooks, never before them: this component survives navigation away
  // from "/", so an early return above would change the hook order.
  if (pathname !== "/") return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent
        className="bg-card text-ink gap-3.5 rounded-[22px] p-5 sm:max-w-sm"
        showCloseButton={false}
      >
        <DialogHeader className="gap-2">
          <div className="bg-track text-brand mb-0.5 flex size-11 items-center justify-center rounded-full">
            <SparklesIcon className="size-5" strokeWidth={2} />
          </div>
          {/* DialogTitle is already font-heading — the app's Newsreader serif. */}
          <DialogTitle className="text-ink text-[19px] leading-snug">
            {title}
          </DialogTitle>
          {/* The dialog's description slot, so it's announced with the title.
              Body-sized rather than caption: the welcome note is a paragraph,
              and 13px caption type makes three sentences a wall. Entries with
              nothing to preface go straight to the bullets. */}
          {intro && (
            <DialogDescription className="text-caption text-[13.5px] leading-[1.55] text-pretty">
              {intro}
            </DialogDescription>
          )}
        </DialogHeader>

        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span
                aria-hidden
                className="bg-brand mt-[7px] size-1.5 shrink-0 rounded-full"
              />
              <span className="text-body text-[14px] leading-[1.5] text-pretty">
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/* No DialogFooter: it carries bg-muted/50 + border-t, shadcn chrome
            nothing else in components/v2/ wears. */}
        <PrimaryButton disabled={pending} onClick={dismiss} className="mt-1">
          Got it
        </PrimaryButton>
      </DialogContent>
    </Dialog>
  );
}
