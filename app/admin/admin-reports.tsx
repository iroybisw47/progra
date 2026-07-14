"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteReportedComment,
  resolveReport,
  takeDownStory,
} from "@/app/actions/admin";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/social/reports";

type Result = { ok: true } | { error: string };

export type AdminReport = {
  id: string;
  reporterUsername: string | null;
  reason: string;
  note: string | null;
  createdAt: string;
  target:
    | {
        kind: "story";
        sessionId: string;
        label: string;
        isGoal: boolean;
        beforeUrl: string | null;
        afterUrl: string | null;
        ownerUsername: string | null;
        gone: boolean;
      }
    | {
        kind: "comment";
        commentId: string;
        body: string | null;
        authorUsername: string | null;
        gone: boolean;
      }
    | {
        kind: "profile";
        userId: string;
        username: string | null;
        displayName: string | null;
      };
};

function reasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason as ReportReason] ?? reason;
}

export function AdminReports({ reports }: { reports: AdminReport[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<Result>, okMsg: string) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Moderation</h1>
          <p className="text-muted-foreground text-sm">
            {reports.length === 0
              ? "No open reports."
              : `${reports.length} open report${reports.length === 1 ? "" : "s"}.`}
          </p>
        </header>

        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {reasonLabel(report.reason)}
                </span>
                <span className="text-muted-foreground text-xs capitalize">
                  {report.target.kind}
                </span>
              </div>

              <p className="text-muted-foreground text-xs">
                Reported by{" "}
                {report.reporterUsername ? (
                  <Link
                    href={`/profile/${report.reporterUsername}`}
                    className="hover:underline"
                  >
                    @{report.reporterUsername}
                  </Link>
                ) : (
                  "a former user"
                )}
              </p>

              {report.note && (
                <p className="bg-muted/40 rounded-md px-3 py-2 text-sm break-words">
                  {report.note}
                </p>
              )}

              <TargetPreview target={report.target} />

              <div className="border-border/60 flex flex-wrap gap-2 border-t pt-3">
                {report.target.kind === "story" && !report.target.gone && (
                  <TakeDownButton
                    label="Take down photos"
                    disabled={pending}
                    onConfirm={() =>
                      run(
                        () =>
                          takeDownStory(
                            (report.target as { sessionId: string }).sessionId
                          ),
                        "Story taken down"
                      )
                    }
                  />
                )}
                {report.target.kind === "comment" && !report.target.gone && (
                  <TakeDownButton
                    label="Delete comment"
                    disabled={pending}
                    onConfirm={() =>
                      run(
                        () =>
                          deleteReportedComment(
                            (report.target as { commentId: string }).commentId
                          ),
                        "Comment deleted"
                      )
                    }
                  />
                )}

                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => resolveReport(report.id, "actioned"),
                        "Marked actioned"
                      )
                    }
                  >
                    Mark actioned
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => resolveReport(report.id, "dismissed"),
                        "Dismissed"
                      )
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}

function TargetPreview({ target }: { target: AdminReport["target"] }) {
  if (target.kind === "story") {
    if (target.gone) {
      return (
        <p className="text-muted-foreground text-sm italic">
          Photos already removed.
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm">
          {target.isGoal && (
            <span className="text-muted-foreground">Goal: </span>
          )}
          {target.label}
          {target.ownerUsername && (
            <span className="text-muted-foreground">
              {" "}
              · @{target.ownerUsername}
            </span>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[target.beforeUrl, target.afterUrl].map((url, i) =>
            url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={i === 0 ? "Before" : "After"}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <div
                key={i}
                className="bg-muted aspect-square w-full rounded-md"
              />
            )
          )}
        </div>
      </div>
    );
  }

  if (target.kind === "comment") {
    if (target.gone) {
      return (
        <p className="text-muted-foreground text-sm italic">
          Comment already deleted.
        </p>
      );
    }
    return (
      <div className="bg-muted/40 flex flex-col gap-1 rounded-md px-3 py-2">
        {target.authorUsername && (
          <span className="text-muted-foreground text-xs">
            @{target.authorUsername}
          </span>
        )}
        <span className="text-sm break-words">{target.body}</span>
      </div>
    );
  }

  // profile
  return (
    <p className="text-sm">
      {target.username ? (
        <Link
          href={`/profile/${target.username}`}
          className="font-medium hover:underline"
        >
          {target.displayName || `@${target.username}`}
        </Link>
      ) : (
        <span className="text-muted-foreground italic">Account gone</span>
      )}
    </p>
  );
}

function TakeDownButton({
  label,
  disabled,
  onConfirm,
}: {
  label: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm" disabled={disabled}>
            {label}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This hides the content from everyone immediately. It can&rsquo;t be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
