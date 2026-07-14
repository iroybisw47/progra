"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { deleteComment } from "@/app/actions/comments";

// Small inline "remove my comment" control. Shown only when the server marked
// the comment deletable (author, or session owner). RLS is the real gate.
export function DeleteCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label="Delete comment"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await deleteComment(commentId);
          if ("error" in r) {
            toast.error(r.error);
            return;
          }
          router.refresh();
        })
      }
      className="text-muted-foreground hover:text-foreground shrink-0 transition-colors disabled:opacity-50"
    >
      <XIcon className="size-3.5" />
    </button>
  );
}
