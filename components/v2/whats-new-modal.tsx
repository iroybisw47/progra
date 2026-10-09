"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";

import { markPatchNotesSeen } from "@/app/actions/profile";
import { PrimaryButton } from "@/components/v2/primary-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { noteSegments } from "@/lib/patch-notes";

// "What's new" — one release note, shown once, on the first Progress load after
// a release this user hasn't been stamped for. The server already decided this
// should exist (app/layout.tsx reads profiles.patch_notes_seen_version through
// patchNoteToShow), so it opens at mount rather than through an effect.
//
// EVERY close path goes through dismiss(), which stamps: the CTA, the backdrop,
// Escape. Same rule as PlanCompleteModal and for its reason — a dismiss that
// didn't write would reopen this on every page load.
//
// Drawn in the app's own tokens (bg-card / text-ink / PrimaryButton), not the
// shadcn ones its sibling still uses; auto-end-nudge.tsx was rewritten for
// exactly that drift. Every line of copy is ink: it's a note from a person, and
// grey intro text read as small print.
export function WhatsNewModal({
  version,
  title,
  intro,
  items,
  outro,
}: {
  version: string;
  title: string;
  intro?: string;
  items: string[];
  outro?: string[];
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
      {/* Capped and scrollable: a three-item note with a sign-off is about as
          tall as an iPhone SE, and an unscrollable dialog taller than the screen
          pushes "Got it" out of reach with no backdrop left to tap. The insets
          keep the logo out from under the Dynamic Island. */}
      <DialogContent
        className="bg-card text-ink max-h-[calc(100dvh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom)_-_2rem)] gap-3.5 overflow-y-auto rounded-[22px] p-5 sm:max-w-sm"
        showCloseButton={false}
      >
        <DialogHeader className="gap-2">
          {/* The rainbow app-icon logo, at 3x so it's sharp on an iPhone. It's
              decorative — the title right below it is what gets announced — and
              unoptimized because the file is already that size; next/image would
              only serve 1x/2x of a fixed-width image. */}
          <Image
            src="/progra-logo.png"
            alt=""
            width={48}
            height={48}
            unoptimized
            className="mb-0.5 size-12 rounded-[11px]"
          />
          {/* DialogTitle is already font-heading — the app's Newsreader serif. */}
          <DialogTitle className="text-ink text-[19px] leading-snug">
            {title}
          </DialogTitle>
          {/* The dialog's description slot, so it's announced with the title.
              Body-sized rather than caption: the welcome note is a paragraph,
              and 13px caption type makes three sentences a wall. Entries with
              nothing to preface go straight to the bullets. */}
          {intro && (
            <DialogDescription className="text-ink text-[13.5px] leading-[1.55] text-pretty">
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
              <span className="text-ink text-[14px] leading-[1.5] text-pretty">
                {noteSegments(item).map((segment, i) =>
                  segment.href ? (
                    // A plain link: Capacitor hands any host that isn't
                    // progra.world to iOS, so it opens in Safari (or Instagram)
                    // rather than navigating the app's webview away.
                    <a
                      key={i}
                      href={segment.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline decoration-1 underline-offset-3"
                    >
                      {segment.text}
                    </a>
                  ) : (
                    segment.text
                  )
                )}
              </span>
            </li>
          ))}
        </ul>

        {outro && (
          <div className="flex flex-col gap-2.5">
            {outro.map((paragraph) => (
              <p
                key={paragraph}
                className="text-ink text-[14px] leading-[1.5] whitespace-pre-line"
              >
                {paragraph}
              </p>
            ))}
          </div>
        )}

        {/* No DialogFooter: it carries bg-muted/50 + border-t, shadcn chrome
            nothing else in components/v2/ wears. */}
        <PrimaryButton disabled={pending} onClick={dismiss} className="mt-1">
          Got it
        </PrimaryButton>
      </DialogContent>
    </Dialog>
  );
}
