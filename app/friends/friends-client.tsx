"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { XIcon } from "lucide-react";

import { track } from "@/lib/analytics";
import { FeedLivePoll } from "@/components/feed-live-poll";
import { FriendsLeaderboard } from "@/components/v2/friends-leaderboard";
import type { FriendsLeaderboardRow } from "@/lib/leaderboard";

import { AvatarInitials } from "@/components/avatar-initials";
import { NotificationsBell } from "@/components/notifications-bell";
import {
  acceptFriendRequest,
  blockUser,
  removeFriendship,
  searchUsers,
  sendFriendRequest,
  unblockUser,
  type UserSearchResult,
} from "@/app/actions/friends";
import type {
  BlockedEntry,
  FriendEntry,
  PublicUser,
  RequestEntry,
} from "@/lib/db/friends";

type Props = {
  friends: FriendEntry[];
  incoming: RequestEntry[];
  outgoing: RequestEntry[];
  blocked: BlockedEntry[];
  suggested: PublicUser[];
  initialUnseen: boolean;
  leaderboard: FriendsLeaderboardRow[];
};

type ActionResult = { ok: true } | { error: string };

export function FriendsClient({
  friends,
  incoming,
  outgoing,
  blocked,
  suggested,
  initialUnseen,
  leaderboard,
}: Props) {
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Relationship lookups for labeling search results against fresh server data.
  const friendIds = new Set(friends.map((f) => f.user.userId));
  const outgoingIds = new Set(outgoing.map((o) => o.user.userId));
  const incomingByUser = new Map(
    incoming.map((i) => [i.user.userId, i.requestId])
  );

  // Immediate UI feedback lives in the change handler (an event handler, so
  // setState is fine here); the effect below only schedules the async fetch.
  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
    } else {
      setSearching(true);
    }
  }

  // Debounced prefix search. The ignore flag drops out-of-order responses. All
  // setState happens inside the timeout (deferred), never synchronously in the
  // effect body.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let ignore = false;
    const t = setTimeout(async () => {
      const r = await searchUsers(q);
      if (ignore) return;
      setSearching(false);
      if ("error" in r) {
        toast.error(r.error);
        setResults([]);
        return;
      }
      setResults(r.results);
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [query]);

  // Run a mutating action, surface errors, and refetch server data on success.
  function run(
    action: () => Promise<ActionResult>,
    okMsg?: string,
    onOk?: () => void
  ) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (okMsg) toast.success(okMsg);
      onOk?.();
    });
  }

  // The right-hand action button for a user, by our relationship to them.
  // Shared by search results and the "People on Progra" section.
  const chip =
    "h-[30px] rounded-[10px] px-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50";
  const chipOutline = `border-control-border text-caption border-[1.5px] ${chip}`;
  const chipSolid = `bg-brand text-primary-foreground ${chip}`;

  function renderAction(userId: string) {
    if (friendIds.has(userId)) {
      return (
        <span className="text-disabled text-xs font-semibold">Friends</span>
      );
    }
    if (outgoingIds.has(userId)) {
      return (
        <span className="text-disabled text-xs font-semibold">Requested</span>
      );
    }
    const requestId = incomingByUser.get(userId);
    if (requestId) {
      return (
        <button
          type="button"
          className={chipSolid}
          disabled={pending}
          onClick={() =>
            run(() => acceptFriendRequest(requestId), "Friend added", () =>
              track("friend_added", { from: "friends_tab" })
            )
          }
        >
          Accept
        </button>
      );
    }
    return (
      <button
        type="button"
        className={chipOutline}
        disabled={pending}
        onClick={() => run(() => sendFriendRequest(userId), "Request sent")}
      >
        Add
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center pt-7 pb-28">
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-3 px-5">
          <span className="section-label">Friends</span>
          <NotificationsBell initialUnseen={initialUnseen} />
        </header>

        {/* Search */}
        <div className="px-5 pt-3.5">
          <input
            aria-label="Search people"
            className="border-control-border text-ink focus:border-brand h-[42px] w-full rounded-[13px] border-[1.5px] px-3.5 text-sm outline-none placeholder:text-disabled"
            placeholder="Search people"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

        {/* Search results replace the board while a query is live. */}
        {query.trim().length >= 2 && (
          <section className="flex flex-col">
            <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
              <span className="section-label">Results</span>
            </div>
            {searching && (
              <p className="text-caption border-divider border-t px-5 py-3 text-[13px]">
                Searching…
              </p>
            )}
            {!searching && results.length === 0 && (
              <p className="text-disabled border-divider border-t px-5 py-3 text-xs">
                No one matches &ldquo;{query.trim()}&rdquo;.
              </p>
            )}
            {results.map((u) => (
              <UserRow key={u.userId} user={u}>
                {renderAction(u.userId)}
              </UserRow>
            ))}
          </section>
        )}

        {/* Incoming requests — the one thing that needs answering. */}
        {incoming.length > 0 && (
          <section className="flex flex-col">
            <div className="flex items-center gap-[7px] px-5 pt-5 pb-2">
              <span className="text-brand text-[10px] font-semibold uppercase tracking-[0.14em]">
                Requests
              </span>
              <span className="bg-brand text-primary-foreground flex h-4 min-w-4 items-center justify-center rounded-full px-[5px] text-[10px] font-semibold tabular-nums">
                {incoming.length}
              </span>
            </div>
            {incoming.map((r) => (
              <UserRow key={r.requestId} user={r.user}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(() => acceptFriendRequest(r.requestId), "Friend added", () =>
                      track("friend_added", { from: "friends_tab" })
                    )
                  }
                  className="bg-brand text-primary-foreground h-[30px] rounded-[10px] px-3.5 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  aria-label={`Decline ${r.user.displayName || r.user.username}`}
                  disabled={pending}
                  onClick={() => run(() => removeFriendship(r.requestId))}
                  className="border-hairline text-caption hover:text-destructive flex size-[30px] items-center justify-center rounded-[10px] border-[1.5px] disabled:opacity-50"
                >
                  <XIcon className="size-3.5" strokeWidth={2.2} />
                </button>
              </UserRow>
            ))}
            <div className="bg-track border-hairline mt-3 h-1.5 border-t" />
          </section>
        )}

        {/* Keeps friends' totals climbing while you watch, and refreshes on
            refocus. Same component and cadence the feed uses. */}
        <FeedLivePoll />
        {query.trim().length < 2 && <FriendsLeaderboard rows={leaderboard} />}

        {/* Friends */}
        <section className="flex flex-col">
          <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
            <span className="section-label">Your friends</span>
            <span className="flex-1" />
            <span className="text-caption text-[10px] font-semibold tracking-[0.06em] tabular-nums">
              {friends.length}
            </span>
          </div>
          {friends.length === 0 ? (
            <p className="text-caption border-divider border-t px-5 py-3 text-[13px]">
              No friends yet — search above to add someone.
            </p>
          ) : (
            friends.map((f) => (
              <UserRow key={f.friendshipId} user={f.user}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeFriendship(f.friendshipId))}
                  className="border-control-border text-caption h-[30px] rounded-[10px] border-[1.5px] px-3 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                >
                  Remove
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => blockUser(f.user.userId), "User blocked")}
                  className="text-destructive h-[30px] rounded-[10px] px-2 text-xs font-semibold disabled:opacity-50"
                >
                  Block
                </button>
              </UserRow>
            ))
          )}
        </section>

        {/* People on Progra — discovery. Excludes current friends (they're in
            "Your friends" above); pending shows Requested/Accept. */}
        {(() => {
          const people = suggested.filter((u) => !friendIds.has(u.userId));
          if (people.length === 0) return null;
          return (
            <section className="flex flex-col">
              <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
                <span className="section-label">People on Progra</span>
              </div>
              {people.map((u) => (
                <UserRow key={u.userId} user={u}>
                  {renderAction(u.userId)}
                </UserRow>
              ))}
            </section>
          );
        })()}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <section className="flex flex-col">
            <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
              <span className="section-label">Sent</span>
            </div>
            {outgoing.map((r) => (
              <UserRow key={r.requestId} user={r.user}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeFriendship(r.requestId))}
                  className="border-control-border text-caption h-[30px] rounded-[10px] border-[1.5px] px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              </UserRow>
            ))}
          </section>
        )}

        {/* Blocked */}
        {blocked.length > 0 && (
          <section className="flex flex-col">
            <div className="flex items-center gap-[7px] px-5 pt-[18px] pb-2">
              <span className="section-label">Blocked</span>
            </div>
            {blocked.map((b) => (
              <UserRow key={b.user.userId} user={b.user}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => unblockUser(b.user.userId), "User unblocked")}
                  className="border-control-border text-caption h-[30px] rounded-[10px] border-[1.5px] px-3 text-xs font-semibold disabled:opacity-50"
                >
                  Unblock
                </button>
              </UserRow>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function UserRow({
  user,
  children,
}: {
  user: PublicUser | UserSearchResult;
  children: React.ReactNode;
}) {
  return (
    <div className="border-divider flex items-center gap-[11px] border-t px-5 py-[9px]">
      <Link href={`/profile/${user.username}`} className="shrink-0">
        <AvatarInitials
          name={user.displayName}
          username={user.username}
          avatarUrl={user.avatarUrl}
          className="size-9 text-[13px]"
        />
      </Link>
      <Link
        href={`/profile/${user.username}`}
        className="flex min-w-0 flex-1 flex-col"
      >
        <span className="text-body truncate text-[13px] leading-[1.25] font-semibold">
          {user.displayName || `@${user.username}`}
        </span>
        {user.displayName && (
          <span className="text-faint truncate text-[11px] leading-[1.3]">
            @{user.username}
          </span>
        )}
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
