"use client";

import dynamic from "next/dynamic";
import {
  useId,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type Ref,
} from "react";
import { ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";

import { FeedLivePoll } from "@/components/feed-live-poll";
import { NotificationsBell } from "@/components/notifications-bell";
import { InviteTile } from "@/components/v2/invite-tile";
import {
  ListNote,
  PeopleSearchField,
  PeopleSearchResults,
  usePeopleSearch,
} from "@/components/v2/people-search";
import { PersonRow, rowErrorToast, type PersonAction } from "@/components/v2/person-row";
import { PillToast, type PillToastHandle } from "@/components/v2/pill-toast";
import { ShowMoreRow, useUwGroupPaging } from "@/components/v2/uw-groups";
import type { BlockedEntry, PublicUser, RequestEntry } from "@/lib/db/friends";
import {
  ACCEPT_FAILED,
  INVITE_COPY,
  acceptedToast,
  inviteTileSub,
  inviteToast,
} from "@/lib/find-friends";
import {
  FRIENDS_TAB_COPY,
  FRIENDS_TAB_SAID,
  NO_OVERLAY,
  applyFriendsTabOp,
  friendsCountMeta,
  friendsTabSections,
  peopleOnProgra,
  relationsFrom,
  requestSubline,
  tabRelation,
  unblockedToast,
  visibleBlocked,
  visibleOutgoing,
  visibleRequests,
  type FriendRowView,
  type FriendsTabOp,
  type FriendsTabServices,
  type Said,
} from "@/lib/friends-tab";
import { usePrefersReducedMotion } from "@/lib/hooks";
import { inviteText } from "@/lib/onboarding-v3";
import type { ActionResult } from "@/lib/onboarding-v3-services";
import {
  UW_GROUPS_COPY,
  friendsTabUwHide,
  uwSections,
  uwSubline,
  type FriendsTabUw,
} from "@/lib/uw-groups";
import type { UwPeerGroups } from "@/lib/uw-peers";

import { REAL_FRIENDS_SERVICES } from "./services";

// Lazy, per the repo's dialog rule: most visits never open it. ssr: false, as
// every other v2 sheet's: it's what gives the lazy chunk a Suspense of its
// own. Without one, the first tap's chunk load (an urgent update, not a
// transition) suspends up to the route's loading.tsx, and the whole tab
// flashes to its skeleton before the sheet appears.
const SentBlockedSheet = dynamic(
  () => import("./sent-blocked-sheet").then((m) => m.SentBlockedSheet),
  { ssr: false }
);

// The v3 Friends tab (plan P8, R:161-169, D12), behind FRIENDS_V3: the same
// visual language as onboarding v3's Screen 5. Top to bottom:
//
//   "Friends" and "{n} FRIENDS", with the notifications bell (its only mount)
//   the people search: while it's focused or holds a query, everything below
//     it hides and the results take its place, with "Cancel" (R:164)
//   the 68px invite button, breathing as on Screen 5 (R:165)
//   Requests (count): Decline ✕ and Accept on each (R:167)
//   a UW student's UW groups, with UW on (R:168, P9d): "In {Major}", "Shares
//     your interests" and "More at UW", each with its count and each
//     person's reason, and "Show more" for the next page; Add takes the
//     person out of the group at once (P:1294)
//   Your friends (count): "Working on {goal}" and this week's hours (R:169)
//   People on Progra: discovery, for anyone without UW groups (D12)
//   a quiet "Sent requests · Blocked" row opening a sheet (D12)
//
// The UW groups' first pages come with the page's reads (listUwPeerGroups),
// so a revalidation hands them back with the added person already gone (the
// RPC leaves out anyone with a friendship row). Until it lands, and on the
// further pages "Show more" loads (which never refresh), the tab's own
// relations take them out (lib/uw-groups.ts, friendsTabUwHide). A request
// taken back from the Sent sheet puts them back. Those pages load on a tap,
// never on scroll: the groups sit above "Your friends" and the Sent · Blocked
// row, which scrolling through a whole cohort would keep pushing down. A
// refresh whose UW read failed keeps the groups the tab already had.
//
// FeedLivePoll keeps the hours climbing and the requests fresh (every 60s and
// on refocus), as on the old tab. The leaderboard is gone: its hours are on
// the rows now (D12). Remove and Block live on each friend's profile, which
// every row links to.
//
// Every write is an existing action, which revalidates the friend surfaces
// itself, so the fresh reads come back with its answer. A tap shows at once
// (useOptimistic over lib/friends-tab.ts' overlay) and lasts while the action
// is out; a failure reverts it and toasts the action's message through sonner.
// Successes that say something use the redesign's pill (D15); the rest are
// said to a screen reader through a hidden status line (FRIENDS_TAB_SAID).
//
// A tap that takes away the control it was on (a request answered, Add
// turning into "Requested", a UW group's row leaving) would drop keyboard
// and VoiceOver focus to <body>. So the tab notes where focus was, and once
// the tap has shown, puts it back on the row's link, or on a section heading
// if the row is gone: its own section's while that's still there.

type Props = {
  friends: FriendRowView[];
  incoming: RequestEntry[];
  outgoing: RequestEntry[];
  blocked: BlockedEntry[];
  // listSuggestedUsers, as the old tab reads it.
  suggested: PublicUser[];
  initialUnseen: boolean;
  // The viewer's goal the invite names (inviteGoalTitle), or null.
  inviteGoal: string | null;
  // A UW student's first page of each UW group and their own majors
  // (friendsTabUw), with UW on; its groups null when the read failed. Null or
  // absent for everyone else, which leaves the tab as it is outside the
  // cohort.
  uw?: FriendsTabUw | null;
  services?: FriendsTabServices;
  // Dev preview only: the search opens with this typed, or the sheet open,
  // and a stand-in for the bell, whose panel reads and stamps the signed-in
  // viewer's real notifications.
  initialQuery?: string;
  initialSheetOpen?: boolean;
  bell?: ReactNode;
};

export function FriendsClientV3({
  friends,
  incoming,
  outgoing,
  blocked,
  suggested,
  initialUnseen,
  inviteGoal,
  uw = null,
  services = REAL_FRIENDS_SERVICES,
  initialQuery,
  initialSheetOpen = false,
  bell,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const search = usePeopleSearch({ search: services.searchUsers, initialText: initialQuery });
  const searching = search.mode;
  const toastRef = useRef<PillToastHandle>(null);

  const [, startTransition] = useTransition();
  const [overlay, applyOp] = useOptimistic(NO_OVERLAY, applyFriendsTabOp);

  // Hidden status lines: the tab's, and the open sheet's (FRIENDS_TAB_SAID).
  const [said, setSaid] = useState<Said | null>(null);
  const [sheetSaid, setSheetSaid] = useState<Said | null>(null);
  const saidCount = useRef(0);
  function say(text: string, inSheet = false) {
    saidCount.current += 1;
    (inSheet ? setSheetSaid : setSaid)({ id: saidCount.current, text });
  }

  // Where focus was when a write went out (see the header comment), and
  // where it can go back to.
  const mainRef = useRef<HTMLElement>(null);
  const requestsHeading = useRef<HTMLHeadingElement>(null);
  const friendsHeading = useRef<HTMLHeadingElement>(null);
  const sheetTrigger = useRef<HTMLButtonElement>(null);
  const focusWas = useRef<{
    el: HTMLElement;
    row: Element | null;
    section: Element | null;
  } | null>(null);

  // Runs on the commit that shows a tap (the overlay changing). Focus still
  // in place (a search field, a row that's still there) is left alone.
  useLayoutEffect(() => {
    const was = focusWas.current;
    focusWas.current = null;
    if (!was || was.el.isConnected) return;
    // Only when focus really fell out, never taking it from somewhere new.
    const now = document.activeElement;
    if (now && now !== document.body) return;
    const row = was.row?.isConnected ? was.row : null;
    const section = was.section?.isConnected ? was.section : null;
    const target =
      row?.querySelector<HTMLElement>("a:not([tabindex='-1'])") ??
      section?.querySelector<HTMLElement>("h2[tabindex='-1']") ??
      requestsHeading.current ??
      friendsHeading.current;
    target?.focus();
  }, [overlay]);

  // The sheet mounts on its first open and stays, so closing it animates.
  const [sheetOpen, setSheetOpen] = useState(initialSheetOpen);
  const [sheetLoaded, setSheetLoaded] = useState(initialSheetOpen);

  // Whether a share went through, which changes the invite's line for good
  // (D9). The ref guards a second tap while the share sheet is still up, as
  // Screen 5's does.
  const [inviteSent, setInviteSent] = useState(false);
  const sharing = useRef(false);

  const relations = relationsFrom(friends.map((f) => f.userId), incoming, outgoing);
  const requests = visibleRequests(incoming, overlay);
  const sent = visibleOutgoing(outgoing, overlay);
  const blockedNow = visibleBlocked(blocked, overlay);
  const people = peopleOnProgra(suggested, relations, overlay);
  // The last UW groups a read answered with: a refresh whose read failed
  // (groups null) shows these rather than dropping the groups for People on
  // Progra mid-scroll. Derived state, kept in step while rendering; cleared
  // when the viewer is no longer a UW student at all.
  const [uwKept, setUwKept] = useState<UwPeerGroups | null>(uw?.groups ?? null);
  if (uw?.groups && uw.groups !== uwKept) setUwKept(uw.groups);
  if (!uw && uwKept !== null) setUwKept(null);
  const uwGroups = uw ? (uw.groups ?? uwKept) : null;
  // The UW groups' further pages ("Show more"). One generation: the first
  // pages refresh with the page's reads, and what's been paged in stays
  // (lib/uw-groups.ts merges the two).
  const uwPaging = useUwGroupPaging({
    groups: uwGroups,
    generation: "tab",
    fetchMore: services.fetchMoreUwPeers,
  });
  const uwList =
    uw && uwGroups
      ? uwSections({
          groups: uwGroups,
          majors: uw.majors,
          paging: uwPaging.paging,
          hide: friendsTabUwHide(
            relations,
            overlay,
            new Set(blockedNow.map((b) => b.user.userId))
          ),
        })
      : [];
  const show = friendsTabSections({
    searching,
    requests: requests.length,
    uwGroups: uwList.length,
    friends: friends.length,
    people: people.length,
    sent: sent.length,
    blocked: blockedNow.length,
  });

  // One write: show it now, call the action, and on a failure (its `{ error }`,
  // or a throw from the network) toast why. The overlay entry ends with the
  // transition either way: by then the action's revalidation has delivered
  // the page's fresh reads, or there was nothing to deliver and it reverts.
  function run(
    op: FriendsTabOp,
    call: () => Promise<ActionResult>,
    failed: string,
    onOk?: () => void
  ) {
    const el = document.activeElement;
    if (el instanceof HTMLElement && mainRef.current?.contains(el)) {
      focusWas.current = {
        el,
        row: el.closest("[data-person-row]"),
        section: el.closest("section"),
      };
    }
    startTransition(async () => {
      applyOp(op);
      let result: ActionResult;
      try {
        result = await call();
      } catch {
        result = { error: failed };
      }
      if ("error" in result) {
        rowErrorToast(result.error);
        return;
      }
      onOk?.();
    });
  }

  function accept(requestId: string, person: { displayName: string | null; username: string }) {
    run(
      { kind: "accept", requestId },
      () => services.acceptFriendRequest(requestId),
      ACCEPT_FAILED,
      () => {
        toastRef.current?.show(acceptedToast(person));
        services.track("friend_added", { friendship_id: requestId, from: "friends_tab" });
      }
    );
  }

  function decline(requestId: string, person: { displayName: string | null; username: string }) {
    run(
      { kind: "decline", requestId },
      () => services.removeFriendship(requestId),
      FRIENDS_TAB_COPY.declineFailed,
      () => say(FRIENDS_TAB_SAID.declined(person))
    );
  }

  function send(person: { userId: string; displayName: string | null; username: string }) {
    run(
      { kind: "send", userId: person.userId },
      () => services.sendFriendRequest(person.userId),
      FRIENDS_TAB_COPY.sendFailed,
      () => {
        say(FRIENDS_TAB_SAID.sent(person));
        services.track("friend_request_sent", { target_id: person.userId });
      }
    );
  }

  // The sheet's two. Base UI keeps focus in the sheet when a row goes (its
  // popup takes it), so these only need saying, on the sheet's own line.
  function cancel(request: RequestEntry) {
    run(
      { kind: "cancel", requestId: request.requestId, userId: request.user.userId },
      () => services.cancelFriendRequest(request.requestId),
      FRIENDS_TAB_COPY.cancelFailed,
      () => say(FRIENDS_TAB_SAID.cancelled(request.user), true)
    );
  }

  function unblock(user: PublicUser) {
    run(
      { kind: "unblock", userId: user.userId },
      () => services.unblockUser(user.userId),
      FRIENDS_TAB_COPY.unblockFailed,
      () => {
        const text = unblockedToast(user);
        toastRef.current?.show(text);
        say(text, true);
      }
    );
  }

  // Called straight from the tap, so navigator.share runs inside the user
  // gesture it needs.
  function invite() {
    if (sharing.current) return;
    sharing.current = true;
    services.shareInvite(inviteText(inviteGoal)).then(
      (outcome) => {
        sharing.current = false;
        const text = inviteToast(outcome);
        if (text) toastRef.current?.show(text);
        if (outcome === "shared") setInviteSent(true);
        if (outcome === "failed") toast.error(INVITE_COPY.failed);
      },
      () => {
        sharing.current = false;
        toast.error(INVITE_COPY.failed);
      }
    );
  }

  function openSheet() {
    setSheetLoaded(true);
    setSheetOpen(true);
  }

  // Where focus goes when the sheet closes. Its row unmounts once both lists
  // are empty (the last unblock or cancel), and Base UI would then fall back
  // to whatever was focused before, or <body>; "Your friends" always shows
  // while the sheet can be open.
  function sheetFinalFocus() {
    const trigger = sheetTrigger.current;
    return trigger?.isConnected ? trigger : friendsHeading.current;
  }

  // What a person's row offers, by what the viewer already has with them
  // (D12): search results and People on Progra both use it.
  function actionFor(person: {
    userId: string;
    displayName: string | null;
    username: string;
  }): PersonAction {
    const relation = tabRelation(relations, overlay, person.userId);
    switch (relation.kind) {
      case "friends":
        return { kind: "friends" };
      case "requested":
        return { kind: "requested" };
      case "accept":
        return { kind: "accept", onAccept: () => accept(relation.requestId, person) };
      case "add":
        return { kind: "add", added: false, onToggle: () => send(person) };
    }
  }

  // pt-7 is every tab's frame (and PageSkeleton's), kept on purpose so the
  // eyebrow doesn't jump between tabs: it lands ~14px lower than R:162's
  // 22px, which is measured from the prototype's own status bar. The bell
  // (D12, not in the prototype) makes the header row 32px where P:410's is
  // 15px, so the search sits pt-1 under it, not R:163's 12px: that keeps the
  // eyebrow-to-field distance the prototype's (P:410-411).
  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main ref={mainRef} className="flex w-full max-w-md flex-col">
        <header className="flex items-center gap-3 px-5">
          <h1 className="section-label font-sans">{FRIENDS_TAB_COPY.eyebrow}</h1>
          <span className="flex-1" />
          <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">
            {friendsCountMeta(friends.length)}
          </span>
          {bell ?? <NotificationsBell initialUnseen={initialUnseen} />}
        </header>

        <div className="px-5 pt-1">
          <PeopleSearchField search={search} />
        </div>

        {show.invite && (
          <div className="px-5 pt-3 pb-1">
            <InviteTile
              size="tab"
              sub={inviteTileSub(inviteSent)}
              onPress={invite}
              pulse={!searching}
              reduced={reduced}
            />
          </div>
        )}

        {/* Renders nothing; refreshes the page's reads every 60s and on
            refocus, as on the old tab. */}
        <FeedLivePoll />

        {show.results && (
          <PeopleSearchResults
            headerTop="tab"
            view={search.view}
            rowKey={(person) => person.userId}
            renderRow={(person) => (
              <PersonRow
                name={person.displayName}
                username={person.username}
                avatarUrl={person.avatarUrl}
                subline={person.displayName ? `@${person.username}` : null}
                href={`/profile/${person.username}`}
                action={actionFor(person)}
              />
            )}
          />
        )}

        {show.requests && (
          <Section
            label={FRIENDS_TAB_COPY.requests}
            meta={String(requests.length)}
            headingRef={requestsHeading}
          >
            {requests.map((r) => (
              <li key={r.requestId}>
                <PersonRow
                  name={r.user.displayName}
                  username={r.user.username}
                  avatarUrl={r.user.avatarUrl}
                  subline={requestSubline(r.user.username)}
                  href={`/profile/${r.user.username}`}
                  action={{
                    kind: "accept",
                    onAccept: () => accept(r.requestId, r.user),
                    onDecline: () => decline(r.requestId, r.user),
                  }}
                />
              </li>
            ))}
          </Section>
        )}

        {/* R:168: between Requests and Your friends. Every row is an Add
            here: anyone it could say more about has already left the
            group. */}
        {show.uw &&
          uwList.map((group) => (
            <Section
              key={group.key}
              label={group.title}
              meta={String(group.count)}
              metaLabel={UW_GROUPS_COPY.people(group.count)}
            >
              {group.peers.map((p) => {
                const sub = uwSubline(group.key, p);
                return (
                  <li key={p.userId}>
                    <PersonRow
                      name={p.displayName}
                      username={p.username}
                      avatarUrl={p.avatarUrl}
                      subline={sub.text}
                      sublineTone={sub.tone}
                      href={`/profile/${p.username}`}
                      action={actionFor(p)}
                    />
                  </li>
                );
              })}
              {group.cursor && (
                <li>
                  <ShowMoreRow
                    group={group.title}
                    loading={uwPaging.loading(group.key)}
                    auto={false}
                    onMore={() => uwPaging.more(group.key)}
                  />
                </li>
              )}
            </Section>
          ))}

        {show.friends && (
          <Section
            label={FRIENDS_TAB_COPY.friends}
            meta={friends.length > 0 ? String(friends.length) : undefined}
            empty={show.friendsEmpty ? FRIENDS_TAB_COPY.empty : undefined}
            headingRef={friendsHeading}
          >
            {friends.map((f) => (
              <li key={f.userId}>
                <PersonRow
                  name={f.displayName}
                  username={f.username}
                  avatarUrl={f.avatarUrl}
                  subline={f.subline}
                  href={`/profile/${f.username}`}
                  action={{ kind: "meta", text: f.hours }}
                />
              </li>
            ))}
          </Section>
        )}

        {show.people && (
          <Section label={FRIENDS_TAB_COPY.people}>
            {people.map((u) => (
              <li key={u.userId}>
                <PersonRow
                  name={u.displayName}
                  username={u.username}
                  avatarUrl={u.avatarUrl}
                  subline={u.displayName ? `@${u.username}` : null}
                  href={`/profile/${u.username}`}
                  action={actionFor(u)}
                />
              </li>
            ))}
          </Section>
        )}

        {show.sentBlocked && (
          <button
            ref={sheetTrigger}
            type="button"
            onClick={openSheet}
            aria-haspopup="dialog"
            className="border-divider text-caption mt-4 flex w-full items-center gap-2 border-t px-5 py-3.5 text-left text-[13px] font-medium transition-opacity active:opacity-60"
          >
            <span className="flex-1">{FRIENDS_TAB_COPY.sentBlocked}</span>
            <ChevronRightIcon aria-hidden className="text-faint size-4 shrink-0" strokeWidth={2} />
          </button>
        )}

        <p role="status" className="sr-only">
          {said && <span key={said.id}>{said.text}</span>}
        </p>
      </main>

      {sheetLoaded && (
        <SentBlockedSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          outgoing={sent}
          blocked={blockedNow}
          onCancel={cancel}
          onUnblock={unblock}
          said={sheetSaid}
          finalFocus={sheetFinalFocus}
        />
      )}

      <PillToast ref={toastRef} />
    </div>
  );
}

// A section of the tab (P:428): the eyebrow, an optional count on the right
// (10/600, 0.06em), then its rows, or a note in their place. The heading
// takes focus (tabIndex -1, never in the Tab order) when a write removes the
// row that had it. With `metaLabel` (the UW groups), the count is said as
// part of the heading's name instead of as a bare number after it.
function Section({
  label,
  meta,
  metaLabel,
  empty,
  headingRef,
  children,
}: {
  label: string;
  meta?: string;
  metaLabel?: string;
  empty?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <div className="flex items-center gap-[7px] px-5 pt-4 pb-2">
        <h2 ref={headingRef} id={id} tabIndex={-1} className="section-label font-sans">
          {label}
          {metaLabel && <span className="sr-only">, {metaLabel}</span>}
        </h2>
        <span className="flex-1" />
        {meta && (
          <span
            aria-hidden={metaLabel ? true : undefined}
            className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums"
          >
            {meta}
          </span>
        )}
      </div>
      {empty ? <ListNote>{empty}</ListNote> : <ul role="list">{children}</ul>}
    </section>
  );
}
