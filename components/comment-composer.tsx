"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addComment } from "@/app/actions/comments";
import { COMMENT_MAX_LENGTH } from "@/lib/social/comments";

// Compose box under a feed item. Optimistic-free but snappy: disables while
// pending, clears + refreshes the server component (which re-reads comments) on
// success. Mirrors the run()/toast/transition pattern in friends-client.
export function CommentComposer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
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
      router.refresh();
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
  );
}
