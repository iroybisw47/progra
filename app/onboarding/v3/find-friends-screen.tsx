"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import Image from "next/image";
import { InviteTile } from "@/components/v2/invite-tile";
import {
  ListNote,
  PeopleSearchField,
  PeopleSearchResults,
  usePeopleSearch,
} from "@/components/v2/people-search";
import { PersonRow, rowErrorToast, type PersonAction } from "@/components/v2/person-row";
import { ShowMoreRow, UwGroupsLoading, useUwGroupPaging } from "@/components/v2/uw-groups";
import { APP_STORE_DISPLAY } from "@/lib/app-store";
import {
  ACCEPT_FAILED,
  INVITE_COPY,
  acceptedToast,
  inviteTileSub,
  inviteToast,
  isAdded,
  rowRelation,
  type AddPerson,
  type FriendAdds,
  type FriendRelations,
} from "@/lib/find-friends";
import type { ShareOutcome } from "@/lib/invite-share";
import { KEYBOARD_CTA_GAP_PX } from "@/lib/keyboard";
import { EASING, itemStyle, type ItemPhase } from "@/lib/motion";
import { FIND_FRIENDS_COPY, inviteText } from "@/lib/onboarding-v3";
import type {
  ActionResult,
  SearchUsersResult,
  UwPeerGroupsResult,
  UwPeerPageResult,
} from "@/lib/onboarding-v3-services";
import {
  UW_GROUPS_COPY,
  findFriendsView,
  uwFetchKey,
  uwSections,
  uwSubline,
  type FindFriendsView,
  type UwFetchState,
  type UwSection,
} from "@/lib/uw-groups";
import type { UwBucket, UwPeerCursor, UwPeerGroups } from "@/lib/uw-peers";

import { aboveCta } from "./frame";

// Screen 5, "Find your friends" (R:129-144): the title, the breathing invite
// button, search, and under them either a preview of the message the invite
// sends or, for a UW student with UW on, their UW groups (P9d).
//
// The UW groups (R:136-139) show at once, no search needed: "In {Major}",
// "Shares your interests" and "More at UW", each under its header and count,
// with the reason under every name. They're fetched as soon as the wizard is
// past Screen 1 (useUwGroupsFetch below), so they're usually in hand by the
// time this screen comes into view, rather than read by the page, because
// Screen 1 saved the answer they're built from in the same session. The
// UW subtitle (R:131) shows only over groups; the rare wait is a few quiet
// rows under the plain one, so nothing is said and then taken back. Nobody
// yet is R:141's "You're early" over the invite preview, and a failed fetch
// is the non-UW screen whole (lib/uw-groups.ts, findFriendsView). A screen
// reader hears the wait and what it found on a status line that stays
// mounted. Their rows are the same Add toggle as the results', and an added
// person STAYS listed, showing "✓ Added" to be undone (P:1199-1200), as
// nothing refetches unless the answer on Screen 1 changes. "More at UW" (and
// a long match group) loads its next page a little before its last row
// scrolls into view, through the shared paging (components/v2/uw-groups.tsx).
//
// Inviting is the main event (R:133). It opens the native share sheet with
// inviteText(goal 1) and the App Store link (shareInvite, D9), and a share
// that went through changes the button's line for good. Search (R:134) finds
// people by handle or name, and Add sends a real friend request on the tap
// (D13: "Added" is a pending request); tapping "✓ Added" takes it back. Who's
// added lives in the shell (useFriendAdds), so it survives Back and forward
// and drives the CTA, "Skip for now" until then "Continue · {n} added"
// (R:143). Nothing here writes on Continue: every write already happened on
// its tap. Someone the viewer already knows gets the Friends tab's row
// instead (D12): "Friends" for a friend, Accept for a request waiting on
// them, and "✓ Added" for one they sent before (the page's relations).
//
// Search mode, while the field is focused or holds a query (R:134, P:1183):
// the title and the invite exit upward on the item motion, the field slides up
// 174px over 460ms E, and the list under it starts at y=168 instead of 342,
// with "Cancel" beside the field. The two lists (this screen's note and
// preview or UW groups, and the results) are separate layers that crossfade
// at their own tops, rather than one list whose top jumps under the sliding
// field. Under reduced motion the field doesn't travel (R:54); everything
// crossfades. Search works the same over the groups as over the preview.

// Where things sit, in the section's own coordinates: the handoff's 393 × 852
// frame (R:20) less the 96px above the section (the status bar's 54 and the
// top row, frame.ts's V3_TOP_ROW).
const TITLE_TOP = 14; // y=110
const INVITE_TOP = 100; // y=196
const SEARCH_TOP = 190; // y=286
const SEARCH_RISE = 174; // to y=112
const LIST_TOP = 246; // y=342
const RESULTS_TOP = 72; // y=168

// The lists end 10px above the resting CTA (748 → 758, P:1190), or 8px above
// it once the keyboard has lifted it (461 → 469): the keyboard, the CTA's
// 12px gap over it (lib/keyboard.ts), its 52px, and the 8.
const KEYBOARD_LIST_BOTTOM = `calc(var(--kb-inset, 0px) + ${KEYBOARD_CTA_GAP_PX + 52 + 8}px)`;
const LIST_BOTTOM = `max(${aboveCta(10)}, ${KEYBOARD_LIST_BOTTOM})`;

const LIST =
  "absolute inset-x-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// Phase for something that's hidden while searching: as the screen's, but
// gone upward (exited forward) in search mode. Search mode while the screen
// isn't in front changes nothing: it leaves or arrives with the rest.
function hiddenWhileSearching(phase: ItemPhase, searching: boolean): ItemPhase {
  return phase === "active" && searching ? "past" : phase;
}

// The reverse, for the results: in front only while searching, and resting
// below (where an item enters from) otherwise.
function shownWhileSearching(phase: ItemPhase, searching: boolean): ItemPhase {
  if (phase !== "active") return phase;
  return searching ? "active" : "ahead";
}

// A UW student's groups, fetched through the services seam (fetchUwPeerGroups)
// for the answer `key` names (uwFetchKey), from the moment `ready` says
// Screen 1 has saved it (the wizard is past Screen 1), so the answer is
// usually in by the time Screen 5 is. Not sooner: Yes sets the key on the
// tap, before the save the RPC reads. Null for anyone with no key, who gets
// no fetch at all. Fetching early keeps "added stays listed": adds only
// happen here, after the read.
//
// One fetch per answer: going Back and on again keeps what's shown, so the
// people added here stay listed (a fresh read would leave them out). A new
// answer (Back to Screen 1, different majors) fetches again, and an old
// answer's reply that lands after is dropped. A failed fetch is tried again
// the next time the screen comes into view, not on every move through
// Screens 2-4; until it answers, the screen stays as the failure left it, the
// non-UW layout, rather than flashing a wait over it.
//
// The answer is derived while rendering: for a key with no reply yet it's
// "loading", so nothing is set in the effect itself. The refs only record
// what the effect has asked and been told, between runs.
function useUwGroupsFetch(
  key: string | null,
  ready: boolean,
  active: boolean,
  fetchGroups: () => Promise<UwPeerGroupsResult>
): UwFetchState | null {
  const [answer, setAnswer] = useState<{ key: string; groups: UwPeerGroups | null } | null>(null);
  const told = useRef<{ key: string; ok: boolean } | null>(null);
  const asking = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || key === null) return;
    if (told.current?.key === key && (told.current.ok || !active)) return;
    if (asking.current === key) return;
    asking.current = key;
    const land = (groups: UwPeerGroups | null) => {
      if (asking.current !== key) return;
      asking.current = null;
      told.current = { key, ok: groups !== null };
      setAnswer({ key, groups });
    };
    fetchGroups().then(
      (r) => land("error" in r ? null : r.groups),
      () => land(null)
    );
  }, [ready, active, key, fetchGroups]);

  if (key === null) return null;
  if (answer?.key !== key) return { status: "loading" };
  return answer.groups ? { status: "ready", groups: answer.groups } : { status: "failed" };
}

// What Screen 5's status line says (a screen reader only), while it's in
// front: that it's looking while the groups load, then, if it was heard
// looking, what it found (the count, or the note it shows instead). Nothing
// otherwise, so arriving at a screen already filled in says nothing extra.
// The line stays mounted, and only its text changes, which is what a live
// region announces.
function uwSpoken(
  active: boolean,
  waited: boolean,
  view: FindFriendsView,
  sections: readonly UwSection[]
): string {
  if (!active) return "";
  if (view.list === "loading") return UW_GROUPS_COPY.loading;
  if (!waited) return "";
  if (view.list === "preview") return view.note;
  return UW_GROUPS_COPY.found(sections.reduce((n, s) => n + s.count, 0));
}

// Someone a row can be about: a search result or a UW group's person.
type RowPerson = { userId: string; username: string; displayName: string | null };

export function FindFriendsScreen({
  phase,
  reduced,
  goal,
  adds,
  onToggleAdd,
  relations,
  accept,
  search,
  share,
  onToast,
  initialQuery,
  uw,
  uwReady,
  fetchUwGroups,
  fetchMoreUw,
}: {
  phase: ItemPhase;
  reduced: boolean;
  // Goal 1's title, for the invite message.
  goal: string | null;
  // Who's added (useFriendAdds, held by the shell).
  adds: FriendAdds;
  onToggleAdd: (person: AddPerson) => void;
  // Who the viewer already knows (getFriendRelations, via the page).
  relations: FriendRelations;
  // acceptFriendRequest, searchUsers and shareInvite, through the services
  // seam.
  accept: (requestId: string) => Promise<ActionResult>;
  search: (query: string) => Promise<SearchUsersResult>;
  share: (text: string) => Promise<ShareOutcome>;
  // The shell's pill toast, for successes (D15). Errors go to sonner.
  onToast: (text: string) => void;
  // Dev preview only: the search field opens with this typed.
  initialQuery?: string;
  // A UW student's answer from Screen 1, as saved: their majors, for "In
  // {Major}", and interests. Null for everyone else, and always with UW off,
  // which leaves this screen exactly as it was before P9d.
  uw: { majors: readonly string[]; interests: readonly string[] } | null;
  // The wizard is past Screen 1, so `uw` is saved and the groups can be
  // fetched ahead of this screen.
  uwReady: boolean;
  // fetchUwPeerGroups and fetchMoreUwPeers, through the services seam.
  fetchUwGroups: () => Promise<UwPeerGroupsResult>;
  fetchMoreUw: (bucket: UwBucket, cursor: UwPeerCursor) => Promise<UwPeerPageResult>;
}) {
  const active = phase === "active";
  const people = usePeopleSearch({ search, initialText: initialQuery });
  const searching = people.mode;
  const message = inviteText(goal);

  const uwKey = uwFetchKey(uw);
  const uwFetch = useUwGroupsFetch(uwKey, uwReady, active, fetchUwGroups);
  const view = findFriendsView(uwFetch);
  const groups = uwFetch?.status === "ready" ? uwFetch.groups : null;
  const paging = useUwGroupPaging({
    groups,
    generation: uwKey ?? "",
    fetchMore: fetchMoreUw,
  });
  const sections =
    groups && view.list === "groups"
      ? uwSections({ groups, majors: uw?.majors ?? [], paging: paging.paging })
      : [];
  const groupIds = useId();

  // Whether the status line has said it's looking, on this visit, for this
  // answer: only then does it go on to say what it found. Set while
  // rendering, as derived state, so it's in place in the same commit.
  const [waitedFor, setWaitedFor] = useState<string | null>(null);
  if (active && view.list === "loading" && uwKey !== null && waitedFor !== uwKey) {
    setWaitedFor(uwKey);
  }
  if (!active && waitedFor !== null) setWaitedFor(null);
  const spoken = uwSpoken(active, waitedFor !== null && waitedFor === uwKey, view, sections);

  // Whether a share went through, which changes the button's line for good
  // (D9). A ref guards against a second tap while the sheet is still up:
  // navigator.share refuses a second call, and shareInvite would then fall
  // back to copying without a word.
  const [sent, setSent] = useState(false);
  const sharing = useRef(false);

  // Requests accepted from a row here, by user id: in flight, or done (shown
  // as "Friends" from then on, as the revalidated page's relations agree).
  const [accepts, setAccepts] = useState<Readonly<Record<string, "busy" | "done">>>({});
  function acceptFrom(person: RowPerson, requestId: string) {
    if (accepts[person.userId]) return;
    const set = (state: "busy" | "done" | null) =>
      setAccepts((now) => {
        const next = { ...now };
        if (state) next[person.userId] = state;
        else delete next[person.userId];
        return next;
      });
    const fail = (message: string) => {
      set(null);
      rowErrorToast(message);
    };
    set("busy");
    accept(requestId).then(
      (r) => {
        if ("error" in r) return fail(r.error);
        set("done");
        onToast(acceptedToast(person));
      },
      () => fail(ACCEPT_FAILED)
    );
  }
  const acceptedIds = new Set(Object.keys(accepts).filter((id) => accepts[id] === "done"));

  // What a person's row offers, in the results and the UW groups alike:
  // "Friends", Accept, or the Add toggle (which already shows a request the
  // viewer sent as "✓ Added"). The groups' people have no friendship row
  // when they're read (list_uw_peers leaves anyone with one out), so theirs
  // is the toggle, unless something changed since.
  function actionFor(person: RowPerson): PersonAction {
    const relation = rowRelation(relations, person.userId, acceptedIds);
    if (relation.kind === "friends") return { kind: "friends" };
    if (relation.kind === "accept") {
      return {
        kind: "accept",
        busy: accepts[person.userId] === "busy",
        onAccept: () => acceptFrom(person, relation.requestId),
      };
    }
    return {
      kind: "add",
      added: isAdded(adds, person.username),
      onToggle: () => onToggleAdd(person),
    };
  }

  // Called straight from the tap, so navigator.share runs inside the user
  // gesture it needs.
  function invite() {
    if (sharing.current) return;
    sharing.current = true;
    share(message).then(
      (outcome) => {
        sharing.current = false;
        const text = inviteToast(outcome);
        if (text) onToast(text);
        if (outcome === "shared") setSent(true);
        if (outcome === "failed") toast.error(INVITE_COPY.failed);
      },
      () => {
        sharing.current = false;
        toast.error(INVITE_COPY.failed);
      }
    );
  }

  const topPhase = hiddenWhileSearching(phase, searching);
  const resultsPhase = shownWhileSearching(phase, searching);
  const topHidden = active && searching;

  return (
    <>
      <div
        inert={topHidden}
        className="absolute inset-x-5"
        style={{ top: TITLE_TOP, ...itemStyle(topPhase, 0, reduced) }}
      >
        <h2 className="text-ink font-serif text-[26px] leading-[1.15] font-medium tracking-[-0.015em]">
          {FIND_FRIENDS_COPY.title}
        </h2>
        <p className="text-secondary-ink mt-1.5 text-[13px] leading-[1.45] text-pretty">
          {view.sub}
        </p>
      </div>

      <div
        inert={topHidden}
        className="absolute inset-x-5"
        style={{
          top: INVITE_TOP,
          pointerEvents: topHidden ? "none" : undefined,
          ...itemStyle(topPhase, 1, reduced),
        }}
      >
        <InviteTile
          sub={inviteTileSub(sent)}
          onPress={invite}
          pulse={active && !searching}
          reduced={reduced}
        />
      </div>

      {/* Only the field's own (risen) box takes taps: the wrapper stays at
          y=286 while searching, over the results, and must let them through.
          Off screen, nothing does, as the section's own pointer-events say. */}
      <div
        className="pointer-events-none absolute inset-x-5 z-[1]"
        style={{ top: SEARCH_TOP, ...itemStyle(phase, 2, reduced) }}
      >
        <div
          className={active ? "pointer-events-auto" : undefined}
          style={{
            transform: searching ? `translateY(${-SEARCH_RISE}px)` : "none",
            transition: reduced ? "none" : `transform 460ms ${EASING.E}`,
          }}
        >
          <PeopleSearchField search={people} />
        </div>
      </div>

      {/* Not searching: a UW student's groups (R:136-139), the wait for
          them, or the note and what the group chat gets (R:141). */}
      <div
        inert={topHidden}
        aria-hidden={topHidden || undefined}
        className={LIST}
        style={{
          top: LIST_TOP,
          bottom: LIST_BOTTOM,
          pointerEvents: topHidden ? "none" : undefined,
          ...itemStyle(topPhase, 3, reduced),
        }}
      >
        {view.list === "groups" ? (
          sections.map((section) => {
            const headingId = `${groupIds}-${section.key}`;
            return (
              <section key={section.key} aria-labelledby={headingId}>
                {/* R:136: the .section-label and its count, padded 14/20/8.
                    The count is in the heading's name too, so moving by
                    headings hears it, and reading on doesn't hear a bare
                    number after it. */}
                <div className="flex items-center gap-[7px] px-5 pt-3.5 pb-2">
                  <h3 id={headingId} className="section-label min-w-0 truncate font-sans">
                    {section.title}
                    <span className="sr-only">, {UW_GROUPS_COPY.people(section.count)}</span>
                  </h3>
                  <span className="flex-1" />
                  <span
                    aria-hidden
                    className="text-caption shrink-0 text-[10px] font-semibold tracking-[0.06em] tabular-nums"
                  >
                    {section.count}
                  </span>
                </div>
                <ul role="list">
                  {section.peers.map((person) => {
                    const sub = uwSubline(section.key, person);
                    return (
                      <li key={person.userId}>
                        <PersonRow
                          name={person.displayName}
                          username={person.username}
                          avatarUrl={person.avatarUrl}
                          subline={sub.text}
                          sublineTone={sub.tone}
                          action={actionFor(person)}
                        />
                      </li>
                    );
                  })}
                  {section.cursor && (
                    <li>
                      <ShowMoreRow
                        group={section.title}
                        loading={paging.loading(section.key)}
                        auto={active && !searching && !paging.failed(section.key)}
                        onMore={() => paging.more(section.key)}
                      />
                    </li>
                  )}
                </ul>
              </section>
            );
          })
        ) : view.list === "loading" ? (
          <UwGroupsLoading />
        ) : (
          <>
            <ListNote>{view.note}</ListNote>
            <InvitePreview message={message} />
          </>
        )}
      </div>

      {/* Outside both lists, so neither one's hiding silences it. */}
      {uwKey !== null && (
        <p role="status" className="sr-only">
          {spoken}
        </p>
      )}

      {/* Searching: the results, or the note that stands in for them. */}
      <div
        inert={!searching}
        aria-hidden={!searching || undefined}
        className={LIST}
        style={{
          top: RESULTS_TOP,
          bottom: LIST_BOTTOM,
          pointerEvents: searching ? undefined : "none",
          ...itemStyle(resultsPhase, 0, reduced),
        }}
      >
        <PeopleSearchResults
          view={people.view}
          rowKey={(person) => person.userId}
          renderRow={(person) => (
            <PersonRow
              name={person.displayName}
              username={person.username}
              avatarUrl={person.avatarUrl}
              subline={person.displayName ? `@${person.username}` : null}
              action={actionFor(person)}
            />
          )}
        />
      </div>
    </>
  );
}

// The invite as the group chat will see it (R:141): the message in a navy
// bubble, right-aligned like a sent text, over the link card. The card shows
// the URL that's actually sent, the App Store listing (D9), not R's
// progra.world/i/{username}, and the app's current rainbow icon rather than
// R's PrograMark, which is still the old navy clock (the icon a recipient
// actually sees on the listing). 3x for iPhone, unoptimized for the same
// reason as the What's New logo.
function InvitePreview({ message }: { message: string }) {
  return (
    <div role="group" aria-label="Your invite" className="flex flex-col items-end gap-1 px-5 pt-1 pb-3.5">
      <p className="bg-brand m-0 max-w-[270px] rounded-[18px_18px_4px_18px] px-[13px] py-[9px] text-[13px] leading-[1.4] text-primary-foreground">
        {message}
      </p>
      <div className="border-hairline flex w-[220px] max-w-full items-center gap-2.5 rounded-[14px] border bg-card px-3 py-2.5">
        <Image
          src="/progra-logo.png"
          alt=""
          width={30}
          height={30}
          unoptimized
          className="size-[30px] shrink-0 rounded-[7px]"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-body text-[12px] font-semibold">{FIND_FRIENDS_COPY.linkTitle}</span>
          <span className="text-faint truncate text-[11px]">{APP_STORE_DISPLAY}</span>
        </span>
      </div>
    </div>
  );
}
