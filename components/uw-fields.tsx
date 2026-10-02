"use client";

import { useMemo, useState } from "react";
import { XIcon } from "lucide-react";

import { PALETTE } from "@/lib/palette";
import {
  CLUB_MAX,
  MAJOR_MAX,
  MAX_UW_CLUBS,
  UW_MAJORS,
  cleanClubs,
  normalizeMatchText,
} from "@/lib/uw";

import { CheckTile, Field, UNDERLINE_INPUT } from "@/app/onboarding/onboarding-ui";

const TILE = PALETTE[7].fill; // Dark blue, as the goal step's default

// Major, clubs and the goal-sharing switch — one implementation, rendered by
// both the onboarding UW step and Settings → Edit profile. Two copies of a
// picker whose values have to match to score a match is how a cohort quietly
// stops matching.
//
// The major is a typeahead over a suggestion list; the CLUBS FIELD OFFERS
// NOTHING. UW has on the order of a thousand student orgs, so any list we
// showed would be mostly wrong and would quietly teach students that a club
// missing from it doesn't count. They type what they're in, and
// clubsMatch()/uw_club_tokens() do the work of deciding that "UW Robotics Club"
// and "Husky Robotics" are the same room.
export function UwFields({
  major,
  onMajor,
  clubs,
  onClubs,
  shareGoals,
  onShareGoals,
}: {
  major: string;
  onMajor: (v: string) => void;
  clubs: readonly string[];
  onClubs: (next: string[]) => void;
  shareGoals: boolean;
  onShareGoals: (v: boolean) => void;
}) {
  const [majorFocused, setMajorFocused] = useState(false);
  const [clubDraft, setClubDraft] = useState("");

  // Empty field → the whole list, so the options are discoverable at all.
  // Typing filters; an exact pick hides the list rather than leaving one
  // redundant chip under the field.
  const majorSuggestions = useMemo(() => {
    const q = normalizeMatchText(major);
    if (!q) return UW_MAJORS.slice(0, 8);
    if (UW_MAJORS.some((m) => normalizeMatchText(m) === q)) return [];
    return UW_MAJORS.filter((m) => normalizeMatchText(m).includes(q)).slice(0, 8);
  }, [major]);

  const atCap = clubs.length >= MAX_UW_CLUBS;

  // cleanClubs is the authority on dedupe, trimming and the cap — the same
  // function the action runs before the write, so the field can never show a
  // list the DB would then store differently.
  function addClub(value: string) {
    const next = cleanClubs([...clubs, value]);
    setClubDraft("");
    if (next.length !== clubs.length) onClubs(next);
  }

  function removeClub(value: string) {
    onClubs(clubs.filter((c) => c !== value));
  }

  return (
    <>
      <Field label="Major" hint="Or type your own">
        <input
          className={UNDERLINE_INPUT}
          placeholder="Start typing — e.g. Informatics"
          maxLength={MAJOR_MAX}
          value={major}
          onChange={(e) => onMajor(e.target.value)}
          onFocus={() => setMajorFocused(true)}
          // Blur fires before a chip's click on some mobile browsers, so the
          // list closes on a frame delay rather than immediately.
          onBlur={() => setTimeout(() => setMajorFocused(false), 120)}
        />
        {majorFocused && majorSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {majorSuggestions.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onMajor(m)}
                className="border-hairline text-secondary-ink hover:border-brand rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="Clubs"
        hint={atCap ? `${MAX_UW_CLUBS} of ${MAX_UW_CLUBS}` : `Up to ${MAX_UW_CLUBS}`}
      >
        {clubs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pb-2.5">
            {clubs.map((club) => (
              <span
                key={club}
                className="text-primary-foreground flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-[12.5px] font-semibold"
                style={{ backgroundColor: TILE }}
              >
                {club}
                <button
                  type="button"
                  aria-label={`Remove ${club}`}
                  onClick={() => removeClub(club)}
                  className="flex size-[18px] items-center justify-center rounded-full bg-white/20 transition-transform active:scale-90"
                >
                  <XIcon className="size-3" strokeWidth={2.6} />
                </button>
              </span>
            ))}
          </div>
        )}
        {!atCap && (
          <div className="flex items-end gap-2">
            <input
              className={`${UNDERLINE_INPUT} min-w-0 flex-1`}
              placeholder="Type a club you're in"
              maxLength={CLUB_MAX}
              value={clubDraft}
              onChange={(e) => setClubDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter and comma both commit, the way every tag field does.
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  if (clubDraft.trim()) addClub(clubDraft);
                } else if (e.key === "Backspace" && !clubDraft && clubs.length > 0) {
                  // Backspace on an empty field pulls back the last chip.
                  removeClub(clubs[clubs.length - 1]);
                }
              }}
            />
            {/* A visible Add, because Enter is invisible on a phone keyboard. */}
            <button
              type="button"
              onClick={() => clubDraft.trim() && addClub(clubDraft)}
              disabled={!clubDraft.trim()}
              className="bg-brand text-primary-foreground h-9 shrink-0 rounded-[11px] px-4 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}
        <p className="text-caption pt-2 text-[11px] leading-snug">
          Write them however you say them — we&apos;ll work out who else is in
          the same one.
        </p>
      </Field>

      <Field label="Your goals">
        <CheckTile
          name="Show what I'm working on"
          color={TILE}
          on={shareGoals}
          onToggle={() => onShareGoals(!shareGoals)}
        />
        <p className="text-caption pt-2 text-[11px] leading-snug">
          {shareGoals
            ? "When a UW student is working on the same thing as you, you'll each see that one goal of the other's — never your private ones, and never the rest."
            : "Your goals stay between you and your friends, and aren't used to match you. You'll still be matched on your major and clubs."}
        </p>
      </Field>
    </>
  );
}
