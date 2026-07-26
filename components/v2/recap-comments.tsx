"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addRecapComment,
  deleteRecapComment,
} from "@/app/actions/recap-social";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";
import type { RecapComment } from "@/lib/db/recap-social";

// Inline comment thread + composer for a recap feed card. Snappy (disable while
// pending, clear + revalidate on success) — mirrors CommentComposer, with the
// list rendered inline (recaps are infrequent enough that a full thread on the
// card is fine, and recap posts have no detail page to link out to).
export function RecapComments({
  recapId,
  comments,
}: {
  recapId: string;
  comments: RecapComment[];
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await addRecapComment(recapId, body);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setValue("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await deleteRecapComment(id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {comments.map((c) => (
        <div
          key={c.id}
          className="flex items-baseline justify-between gap-2 text-sm"
        >
          <span className="min-w-0">
            <Link
              href={`/profile/${c.author.username}`}
              className="font-bold hover:underline"
            >
              {c.author.displayName || `@${c.author.username}`}
            </Link>{" "}
            <span className="text-body break-words">{c.body}</span>
          </span>
          {c.canDelete && (
            <button
              type="button"
              onClick={() => remove(c.id)}
              disabled={pending}
              className="text-faint hover:text-body shrink-0 text-xs"
            >
              Delete
            </button>
          )}
        </div>
      ))}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          className="h-9"
          placeholder="Add a comment…"
          maxLength={COMMENT_MAX_LENGTH}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={pending || value.trim().length === 0}
        >
          Post
        </Button>
      </form>
    </div>
  );
}
