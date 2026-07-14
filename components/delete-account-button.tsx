"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteAccount } from "@/app/actions/account";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CONFIRM_WORD = "delete";

// Type-to-confirm account deletion. Destructive and irreversible, so the button
// only arms once the user types the confirm word. On success the auth cookies
// are already cleared server-side; we send them to "/" (proxy redirects to
// /login) with a full navigation to drop any stale client state.
export function DeleteAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const armed = confirm.trim().toLowerCase() === CONFIRM_WORD;

  function submit() {
    if (!armed) return;
    startTransition(async () => {
      const r = await deleteAccount();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setOpen(false);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirm("");
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="ghost" className="text-destructive h-10 w-full">
            Delete account
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes your profile, sessions, photos, goals,
            habits, comments, and friendships. It can&rsquo;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="confirm-delete">
            Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
          </label>
          <Input
            id="confirm-delete"
            className="h-10"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!armed || pending}
          >
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
