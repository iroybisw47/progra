"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SettingsIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent } from "@/components/v2/bottom-sheet";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptFriendRequest,
  blockUser,
  removeFriendship,
  sendFriendRequest,
} from "@/app/actions/friends";
import { setProfileIdentity } from "@/app/actions/profile";
import { ReportButton } from "@/components/report-button";
import type { PublicUser } from "@/lib/db/friends";
import type { Relationship } from "@/lib/db/profiles";

type Result = { ok: true } | { error: string };

export function ProfileActions({
  target,
  relationship,
}: {
  target: PublicUser;
  relationship: Relationship;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [displayName, setDisplayName] = useState(target.displayName ?? "");
  const [bio, setBio] = useState(target.bio ?? "");

  function run(
    action: () => Promise<Result>,
    opts?: { okMsg?: string; then?: () => void }
  ) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (opts?.okMsg) toast.success(opts.okMsg);
      if (opts?.then) opts.then();
    });
  }

  const k = relationship.kind;

  // Your own profile keeps its plain Edit chip — the gear below is about what
  // you can do to SOMEONE ELSE, and none of those actions apply to yourself.
  if (k === "self") {
    return (
      <>
        <button
          type="button"
          className="border-hairline text-caption h-8 shrink-0 rounded-[11px] border-[1.5px] px-3.5 text-xs font-semibold whitespace-nowrap transition-transform active:scale-95"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>


        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="pf-name">
                  Display name
                </label>
                <Input
                  id="pf-name"
                  className="h-10"
                  placeholder="Your name"
                  maxLength={50}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="pf-bio">
                  Bio
                </label>
                <Textarea
                  id="pf-bio"
                  placeholder="A line about you"
                  maxLength={300}
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() => setProfileIdentity({ displayName, bio }), {
                    okMsg: "Saved",
                    then: () => setEditing(false),
                  })
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Everyone else: one gear, opening a sheet with the three things you can do.
  // It replaces a row of up-to-three chips, which is what forced the name to
  // truncate — a 32px control leaves the name the rest of the line.
  const friendRow = (() => {
    if (k === "friends") {
      return {
        label: "Remove as friend",
        run: () => run(() => removeFriendship(relationship.friendshipId!), {
          okMsg: "Removed",
          then: () => setMenuOpen(false),
        }),
      };
    }
    if (k === "outgoing") {
      // Not friends yet, so "remove as friend" would be a lie about what the
      // tap does.
      return {
        label: "Cancel friend request",
        run: () => run(() => removeFriendship(relationship.requestId!), {
          okMsg: "Request cancelled",
          then: () => setMenuOpen(false),
        }),
      };
    }
    if (k === "incoming") return null; // handled as two rows below
    return {
      label: "Add as friend",
      run: () => run(() => sendFriendRequest(target.userId), {
        okMsg: "Request sent",
        then: () => setMenuOpen(false),
      }),
    };
  })();

  return (
    <>
      <button
        type="button"
        aria-label={`Options for @${target.username}`}
        onClick={() => setMenuOpen(true)}
        className="border-hairline text-caption flex size-8 shrink-0 items-center justify-center rounded-[11px] border-[1.5px] transition-transform active:scale-95"
      >
        <SettingsIcon className="size-4" strokeWidth={1.9} />
      </button>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen}>
        <BottomSheetContent
          title={target.displayName || `@${target.username}`}
          meta={`@${target.username}`}
        >
          <div className="flex flex-col pb-1">
            {k === "incoming" ? (
              <>
                <MenuRow
                  label="Accept friend request"
                  disabled={pending}
                  onClick={() =>
                    run(() => acceptFriendRequest(relationship.requestId!), {
                      okMsg: "Friend added",
                      then: () => setMenuOpen(false),
                    })
                  }
                />
                <MenuRow
                  label="Decline friend request"
                  disabled={pending}
                  onClick={() =>
                    run(() => removeFriendship(relationship.requestId!), {
                      okMsg: "Declined",
                      then: () => setMenuOpen(false),
                    })
                  }
                />
              </>
            ) : (
              friendRow && (
                <MenuRow
                  label={friendRow.label}
                  disabled={pending}
                  onClick={friendRow.run}
                />
              )
            )}

            <MenuRow
              label="Block"
              destructive
              disabled={pending}
              onClick={() => {
                setMenuOpen(false);
                setBlockOpen(true);
              }}
            />
            <MenuRow
              label="Report"
              destructive
              disabled={pending}
              onClick={() => {
                // Close first: the report dialog is its own layer, and stacking
                // it on the open sheet fights over focus.
                setMenuOpen(false);
                setReportOpen(true);
              }}
            />
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Blocking hides you from each other and drops the friendship, and it
          navigates away — too much to sit behind one tap in a menu. */}
      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block @{target.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won&rsquo;t see each other&rsquo;s sessions or profiles, and
              any friendship between you is removed. You can unblock them from
              Friends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                run(() => blockUser(target.userId), {
                  okMsg: "User blocked",
                  then: () => router.push("/friends"),
                })
              }
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportButton
        targetType="profile"
        targetId={target.userId}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}

// One line in the gear sheet. Same hairline-separated rhythm as the Settings
// rows, so the sheet reads as part of the app rather than a system menu.
function MenuRow({
  label,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border-divider flex w-full items-center border-t py-3.5 text-left text-[15px] font-medium transition-transform first:border-t-0 active:scale-[.99] disabled:opacity-50 ${
        destructive ? "text-destructive" : "text-body"
      }`}
    >
      {label}
    </button>
  );
}
