"use client";

import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { CheckIcon } from "lucide-react";

import { ChipField } from "@/components/v2/chip-field";
import { committedItems, type ChipValue } from "@/lib/chip-field";
import { boxOf, flip, itemStyle, motion, play, type Box, type ItemPhase } from "@/lib/motion";
import {
  INTERESTS_SCROLL_MS,
  UW_COPY,
  UW_PAGE_STAGGER,
  quickAddScrollTop,
  uwBarNote,
  uwDelay,
} from "@/lib/onboarding-v3-uw";
import { UW_INTEREST_FIELD, UW_MAJOR_FIELD } from "@/lib/uw-fields";

import { focusField } from "./focus";
import { aboveLiftedCta } from "./frame";

// The UW page (OWNER-FIX-4): Yes, as a full page of the wizard rather than
// inside the sheet that asked. The owner, verbatim: "It should load to the
// full page, not just a popup when you say Yes to being a UW student". It
// sits on Screen 1, after the welcome: the top row shows (Back to the
// welcome, the progress bar still on step 1), and the wizard's own CTA saves
// it ("Skip for now", then "Continue" once a major or interest is added or
// typed), then Screen 2 comes.
//
// What's on it is what the sheet's Yes path had (P9c): the question, the
// answer as the purple bar with Change (back to the question, R:80), plan
// D2's disclosure under it whenever it lists the student, and the optional
// majors and interests quick-add (R:82-88) on the shared chip field.
// Arriving from the Yes tile, the bar morphs from it (a FLIP from the tile's
// box on screen, its contents fading in over the second half), the rest of
// the page enters on the item motion, and the major field takes the focus at
// 480ms (R:80). Back from Screen 2, or Continue from the welcome, finds the
// bar in place, entering with the rest.
//
// With the keyboard up the page scrolls, its bottom just above the CTA riding
// on the keyboard (aboveLiftedCta, R:83), and the field being typed in is
// kept in view with its suggestions (quickAddScrollTop).

export type UwScreenHandle = {
  // The CTA: whatever was typed but never Returned is added, then onExit.
  exit: () => void;
};

// `el`'s top in `root`'s content coordinates (offsets, so the items' entry
// transforms don't count), or null if `root` isn't among its offset parents.
function offsetTopWithin(el: HTMLElement, root: HTMLElement): number | null {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return node === root ? top : null;
}

export function UwScreen({
  ref,
  phase,
  reduced,
  majors,
  interests,
  listed,
  busy,
  morphFrom,
  onMajors,
  onInterests,
  onDraftChange,
  onChange,
  onExit,
}: {
  ref?: Ref<UwScreenHandle>;
  phase: ItemPhase;
  reduced: boolean;
  majors: readonly string[];
  interests: readonly string[];
  // The reducer's uwListed, for the note under the bar.
  listed: boolean;
  // A save is in flight: the chips can't change, and Change is ignored.
  busy: boolean;
  // The Yes tile's box on screen when the page comes from it just now, for
  // the bar to morph from. Null otherwise.
  morphFrom: Box | null;
  onMajors: (majors: readonly string[]) => void;
  onInterests: (interests: readonly string[]) => void;
  // Whether anything is typed and not yet added, for the CTA's label.
  onDraftChange: (hasDraft: boolean) => void;
  // The bar's "Change": back to the question.
  onChange: () => void;
  // The CTA, with the lists as they're to be saved.
  onExit: (lists: { majors: string[]; interests: string[] }) => void;
}) {
  const active = phase === "active";
  const noteId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const barInnerRef = useRef<HTMLDivElement>(null);
  const majorInputRef = useRef<HTMLInputElement>(null);
  const interestInputRef = useRef<HTMLInputElement>(null);

  // The drafts live here, not in the shell, so a keystroke re-renders the
  // page alone. The chips are the reducer's.
  const [majorDraft, setMajorDraft] = useState("");
  const [interestDraft, setInterestDraft] = useState("");
  const majorValue: ChipValue = { items: majors, draft: majorDraft };
  const interestValue: ChipValue = { items: interests, draft: interestDraft };
  const barNote = uwBarNote(listed);

  // The morph (R:80, plan §6): the Yes tile, measured as its hold ended,
  // becomes the bar, inverted over 560ms on E while the bar's contents fade
  // in over the second half; under reduced motion a 200ms crossfade instead
  // (lib/motion.ts flip()). Before paint, so the bar's first frame is already
  // over the tile, which goes the same frame (uwTileStyle). Then the major
  // field takes the focus, at 480ms (R:80). Once per Yes: the shell clears
  // the tile's box as the page is left.
  const played = useRef<Box | null>(null);
  useLayoutEffect(() => {
    if (!active || !morphFrom || played.current === morphFrom) return;
    played.current = morphFrom;
    const bar = barRef.current;
    if (bar) {
      play(bar, flip(morphFrom, boxOf(bar), reduced));
      play(barInnerRef.current, motion("barContents", reduced));
    }
    const t = setTimeout(() => focusField(majorInputRef.current), uwDelay("majorFocusMs", reduced));
    return () => clearTimeout(t);
  }, [active, morphFrom, reduced]);

  // The quick-add keeps its focused field in view (quickAddScrollTop), with
  // its suggestion row as far as it fits. Focusing Interests scrolls toward
  // the bottom (R:87, P:818), so its suggestions and the D3 line clear the
  // keyboard, but never past the field itself. The keyboard then shrinks the
  // page, so while a field has the focus a resize places it again, Major too.
  // Measured by layout offsets, which ignore the items' entry transforms.
  const pinned = useRef<{ input: HTMLInputElement; toEnd: boolean } | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function reveal(smooth: boolean) {
    const el = scrollRef.current;
    const p = pinned.current;
    if (!el || !p) return;
    const top = offsetTopWithin(p.input, el);
    if (top === null) return;
    const block = p.input.closest<HTMLElement>("[data-quick-add]");
    const blockTop = block ? offsetTopWithin(block, el) : null;
    const fieldBottom = Math.max(
      top + p.input.offsetHeight,
      block && blockTop !== null ? blockTop + block.offsetHeight : 0
    );
    const next = quickAddScrollTop({
      scrollTop: el.scrollTop,
      viewHeight: el.clientHeight,
      contentHeight: el.scrollHeight,
      fieldTop: top,
      fieldBottom,
      toEnd: p.toEnd,
    });
    if (Math.abs(next - el.scrollTop) < 1) return;
    el.scrollTo({ top: next, behavior: smooth && !reduced ? "smooth" : "auto" });
  }
  function unpin(input: HTMLInputElement) {
    if (pinned.current?.input === input) pinned.current = null;
  }
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => reveal(false));
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
    // reveal reads the refs and `reduced` when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setMajors(next: ChipValue) {
    if (next.items !== majors) onMajors(next.items);
    setMajorDraft(next.draft);
    onDraftChange(`${next.draft}${interestDraft}`.trim() !== "");
  }

  function setInterests(next: ChipValue) {
    if (next.items !== interests) onInterests(next.items);
    setInterestDraft(next.draft);
    onDraftChange(`${majorDraft}${next.draft}`.trim() !== "");
  }

  // The CTA (R:88): what was typed but never Returned is added as it'll be
  // saved, handed to the reducer and cleared, then the shell saves and moves
  // on. A failed save leaves it showing as chips.
  function exit() {
    if (busy) return;
    const nextMajors = committedItems(majorValue, UW_MAJOR_FIELD.clean);
    const nextInterests = committedItems(interestValue, UW_INTEREST_FIELD.clean);
    onMajors(nextMajors);
    onInterests(nextInterests);
    setMajorDraft("");
    setInterestDraft("");
    onDraftChange(false);
    onExit({ majors: nextMajors, interests: nextInterests });
  }
  useImperativeHandle(ref, () => ({ exit }));

  // "Change" goes back to the question (R:80, P:816): the sheet, up over the
  // welcome again. Not while a save is in flight: the Yes path's save would
  // still land and carry the wizard on with the answer just taken back. A
  // field with the focus is blurred first, so the keyboard goes with the page.
  function change() {
    if (busy) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && scrollRef.current?.contains(el)) el.blur();
    onChange();
  }

  return (
    <div
      ref={scrollRef}
      className="absolute inset-x-0 top-0 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pt-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ bottom: aboveLiftedCta(14) }}
    >
      <div className="section-label" style={itemStyle(phase, UW_PAGE_STAGGER.label, reduced)}>
        Your school
      </div>
      <h2
        className="text-ink mt-2.5 font-serif text-[25px] leading-[1.18] font-medium tracking-[-0.015em] text-pretty"
        style={itemStyle(phase, UW_PAGE_STAGGER.title, reduced)}
      >
        {UW_COPY.question}
      </h2>

      {/* The answer. Outside the item stagger while it morphs from the Yes
          tile: it shows the moment the page does, with no fade, since the
          FLIP starts it over the tile (P:1389). Otherwise it enters with the
          rest. */}
      <div
        className="mt-[18px]"
        style={morphFrom ? undefined : itemStyle(phase, UW_PAGE_STAGGER.bar, reduced)}
      >
        <div
          ref={barRef}
          className="relative h-[52px] origin-top-left rounded-[15px] bg-[var(--palette-9)] shadow-[0_10px_22px_-10px_rgba(111,78,147,.5)]"
        >
          <div
            ref={barInnerRef}
            className="absolute inset-0 flex items-center gap-2.5 pr-1.5 pl-3.5"
          >
            <span
              aria-hidden
              className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-white text-[var(--palette-9)]"
            >
              <CheckIcon className="size-3" strokeWidth={3.2} />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-white">
              {UW_COPY.bar}
            </span>
            <button
              type="button"
              onClick={change}
              aria-label="Change your UW answer"
              aria-disabled={busy || undefined}
              className="relative h-10 px-3 text-[12px] font-semibold text-white/75 before:absolute before:inset-x-0 before:-inset-y-0.5 before:content-['']"
            >
              {UW_COPY.change}
            </button>
          </div>
        </div>
      </div>

      {/* Plan D2's disclosure, next to the answer that lists the student:
          what UW students will see. None for a replayer whose listing stays
          off (uwBarNote). */}
      {barNote && (
        <p
          id={noteId}
          className="text-caption mt-2 text-[11px] leading-[15px] text-pretty"
          style={itemStyle(phase, UW_PAGE_STAGGER.note, reduced)}
        >
          {barNote}
        </p>
      )}

      <div
        className="section-label mt-[13px]"
        style={itemStyle(phase, UW_PAGE_STAGGER.quickAdd, reduced)}
      >
        {UW_COPY.eyebrow}
      </div>
      <div
        data-quick-add
        className="mt-4"
        style={itemStyle(phase, UW_PAGE_STAGGER.quickAdd + 1, reduced)}
      >
        <ChipField
          {...UW_MAJOR_FIELD}
          inputRef={majorInputRef}
          // Read with the disclosure, which focus jumps past on its way here.
          describedBy={barNote ? noteId : undefined}
          value={majorValue}
          onChange={setMajors}
          // Return on an empty major moves on to Interests (R:85), or closes
          // the keyboard when Interests is full.
          onEmptyReturn={(input) => {
            if (interestInputRef.current) focusField(interestInputRef.current);
            else input.blur();
          }}
          onFocus={(e) => {
            pinned.current = { input: e.currentTarget, toEnd: false };
          }}
          onBlur={(e) => unpin(e.currentTarget)}
          disabled={busy}
          reduced={reduced}
        />
      </div>
      <div
        data-quick-add
        className="mt-4"
        style={itemStyle(phase, UW_PAGE_STAGGER.quickAdd + 2, reduced)}
      >
        <ChipField
          {...UW_INTEREST_FIELD}
          inputRef={interestInputRef}
          value={interestValue}
          onChange={setInterests}
          // The last field: Return on nothing closes the keyboard.
          onEmptyReturn={(input) => input.blur()}
          onFocus={(e) => {
            pinned.current = { input: e.currentTarget, toEnd: true };
            if (scrollTimer.current) clearTimeout(scrollTimer.current);
            scrollTimer.current = setTimeout(() => reveal(true), INTERESTS_SCROLL_MS);
          }}
          onBlur={(e) => unpin(e.currentTarget)}
          disabled={busy}
          reduced={reduced}
        />
      </div>
    </div>
  );
}
