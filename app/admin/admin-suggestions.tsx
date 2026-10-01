"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { resolveSuggestion } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SUGGESTION_STATUS_LABELS,
  type SuggestionStatus,
} from "@/lib/suggestions";

export type AdminSuggestion = {
  id: string;
  suggesterEmail: string | null;
  suggesterUsername: string | null;
  suggesterDisplayName: string | null;
  body: string;
  status: SuggestionStatus;
  createdAt: string;
};

export function AdminSuggestions({
  suggestions,
  installed,
}: {
  suggestions: AdminSuggestion[];
  installed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // An empty list and a missing migration look identical on screen, and only
  // one of them means "nothing to read" — so say which.
  if (!installed) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <div className="w-full max-w-md">
          <p className="text-caption text-sm">
            Suggestions unavailable — the admin RPCs aren&apos;t installed.
          </p>
        </div>
      </div>
    );
  }

  function setStatus(id: string, status: SuggestionStatus, okMsg: string) {
    startTransition(async () => {
      const r = await resolveSuggestion(id, status);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(okMsg);
    });
  }

  const open = suggestions.filter((s) => s.status === "open").length;

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Suggestions</h1>
          <p className="text-caption text-sm">
            {suggestions.length === 0
              ? "No suggestions yet."
              : `${open} open · ${suggestions.length} total.`}
          </p>
        </header>

        {suggestions.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    s.status === "open"
                      ? "bg-brand/10 text-brand rounded-full px-2.5 py-0.5 text-xs font-bold"
                      : "bg-track text-caption rounded-full px-2.5 py-0.5 text-xs font-bold"
                  }
                >
                  {SUGGESTION_STATUS_LABELS[s.status]}
                </span>
                <span className="text-caption text-xs">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Who asked. Handle leads where there is one — unlike the
                  waitlist, a suggester has completed onboarding — with the
                  display name and email behind it, so a reply needs no lookup. */}
              <p className="text-caption text-xs break-words">
                {s.suggesterUsername
                  ? `@${s.suggesterUsername}`
                  : (s.suggesterDisplayName ?? s.suggesterEmail ?? "a former user")}
                {s.suggesterUsername && s.suggesterDisplayName
                  ? ` · ${s.suggesterDisplayName}`
                  : ""}
                {s.suggesterUsername && s.suggesterEmail
                  ? ` · ${s.suggesterEmail}`
                  : ""}
              </p>

              <p className="bg-track rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap">
                {s.body}
              </p>

              <div className="border-divider flex flex-wrap gap-2 border-t pt-3">
                <div className="ml-auto flex gap-2">
                  {s.status === "open" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setStatus(s.id, "accepted", "Marked accepted.")
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setStatus(s.id, "declined", "Declined.")
                        }
                      >
                        Decline
                      </Button>
                    </>
                  ) : (
                    /* Same undo as the bug queue: a call on someone's idea turns
                       out to be wrong often enough to need reopening. */
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(s.id, "open", "Reopened.")}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
