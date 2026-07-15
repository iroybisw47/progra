"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { AvatarInitials } from "@/components/avatar-initials";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
};

type ActionResult = { ok: true } | { error: string };

export function FriendsClient({ friends, incoming, outgoing, blocked }: Props) {
  const router = useRouter();
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
  function run(action: () => Promise<ActionResult>, okMsg?: string) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (okMsg) toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-28">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Friends</h1>
          <p className="text-caption text-sm">
            Find people, manage requests, and see who you&rsquo;re connected to.
          </p>
        </header>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Add a friend</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input
              className="h-11"
              placeholder="Search by username or name"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            {query.trim().length >= 2 && (
              <div className="flex flex-col gap-2">
                {searching && (
                  <p className="text-caption text-sm">Searching…</p>
                )}
                {!searching && results.length === 0 && (
                  <p className="text-caption text-sm">No users found.</p>
                )}
                {results.map((u) => {
                  const requestId = incomingByUser.get(u.userId);
                  return (
                    <UserRow key={u.userId} user={u}>
                      {friendIds.has(u.userId) ? (
                        <Button size="sm" variant="ghost" disabled>
                          Friends
                        </Button>
                      ) : outgoingIds.has(u.userId) ? (
                        <Button size="sm" variant="ghost" disabled>
                          Requested
                        </Button>
                      ) : requestId ? (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => acceptFriendRequest(requestId),
                              "Friend added"
                            )
                          }
                        >
                          Accept
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => sendFriendRequest(u.userId),
                              "Request sent"
                            )
                          }
                        >
                          Add
                        </Button>
                      )}
                    </UserRow>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Requests
                <span className="bg-brand text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums">
                  {incoming.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {incoming.map((r) => (
                <UserRow key={r.requestId} user={r.user}>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => acceptFriendRequest(r.requestId),
                        "Friend added"
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => removeFriendship(r.requestId))}
                  >
                    Decline
                  </Button>
                </UserRow>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sent</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {outgoing.map((r) => (
                <UserRow key={r.requestId} user={r.user}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => removeFriendship(r.requestId))}
                  >
                    Cancel
                  </Button>
                </UserRow>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Friends */}
        <Card>
          <CardHeader>
            <CardTitle>Your friends</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {friends.length === 0 ? (
              <p className="text-caption text-sm">
                No friends yet — search above to add someone.
              </p>
            ) : (
              friends.map((f) => (
                <UserRow key={f.friendshipId} user={f.user}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => removeFriendship(f.friendshipId))}
                  >
                    Remove
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      run(() => blockUser(f.user.userId), "User blocked")
                    }
                  >
                    Block
                  </Button>
                </UserRow>
              ))
            )}
          </CardContent>
        </Card>

        {/* Blocked */}
        {blocked.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Blocked</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {blocked.map((b) => (
                <UserRow key={b.user.userId} user={b.user}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(() => unblockUser(b.user.userId), "User unblocked")
                    }
                  >
                    Unblock
                  </Button>
                </UserRow>
              ))}
            </CardContent>
          </Card>
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
    <div className="flex items-center justify-between gap-3">
      <Link
        href={`/profile/${user.username}`}
        className="flex min-w-0 items-center gap-2.5"
      >
        <AvatarInitials
          name={user.displayName}
          username={user.username}
          className="size-9 text-xs"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium hover:underline">
            {user.displayName || `@${user.username}`}
          </span>
          {user.displayName && (
            <span className="text-caption truncate text-xs">
              @{user.username}
            </span>
          )}
        </span>
      </Link>
      <div className="flex shrink-0 gap-2">{children}</div>
    </div>
  );
}
