"use client";

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

// Deleting a top-level comment deletes its replies too (FK cascade) — other
// people's words — so that one case asks first. Lazy-loaded by
// DeleteCommentButton; a comment without replies still deletes on one tap.
export function DeleteThreadDialog({
  open,
  onOpenChange,
  replyCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyCount: number;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete comment?</AlertDialogTitle>
          <AlertDialogDescription>
            This also deletes its {replyCount === 1 ? "reply" : `${replyCount} replies`}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
