"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { deleteComment } from "@/app/actions/comments";

// Lazy, per the repo's dialog rule — only a comment with replies ever opens it.
const DeleteThreadDialog = dynamic(() =>
  import("@/components/v2/delete-thread-dialog").then((m) => m.DeleteThreadDialog)
);

// Small inline "remove my comment" control. Shown only when the server marked
// the comment deletable (author, or session owner). RLS is the real gate.
// A top-level comment with replies confirms first: deleting it deletes them.
export function DeleteCommentButton({
  commentId,
  replyCount = 0,
}: {
  commentId: string;
  replyCount?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    startTransition(async () => {
      const r = await deleteComment(commentId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Delete comment"
        disabled={pending}
        onClick={() => (replyCount > 0 ? setConfirming(true) : remove())}
        className="text-disabled hover:text-ink shrink-0 transition-colors disabled:opacity-50"
      >
        <XIcon className="size-3.5" />
      </button>
      {confirming && (
        <DeleteThreadDialog
          open={confirming}
          onOpenChange={setConfirming}
          replyCount={replyCount}
          onConfirm={() => {
            setConfirming(false);
            remove();
          }}
        />
      )}
    </>
  );
}
