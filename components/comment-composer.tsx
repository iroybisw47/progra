"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addComment } from "@/app/actions/comments";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";

// Compose box under a feed item. Optimistic-free but snappy: disables while
// pending, clears + refreshes the server component (which re-reads comments) on
// success. Mirrors the run()/toast/transition pattern in friends-client.
export function CommentComposer({ sessionId }: { sessionId: string }) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const body = value.trim();
    if (!body) return;
    startTransition(async () => {
      const r = await addComment(sessionId, body);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      setValue("");
    });
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        className="border-control-border text-ink focus:border-brand h-11 min-w-0 flex-1 rounded-[13px] border-[1.5px] px-3.5 text-sm outline-none placeholder:text-disabled disabled:opacity-50"
        placeholder="Add a comment…"
        maxLength={COMMENT_MAX_LENGTH}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
      />
      <button
        type="submit"
        disabled={pending || value.trim().length === 0}
        className="bg-brand text-primary-foreground h-11 shrink-0 rounded-[13px] px-4 text-sm font-semibold transition-transform active:scale-[.97] disabled:opacity-40"
      >
        Post
      </button>
    </form>
  );
}
