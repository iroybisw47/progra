"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { resolveBugReport } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BUG_STATUS_LABELS, type BugStatus } from "@/lib/bug-reports";

export type AdminBugReport = {
  id: string;
  reporterEmail: string | null;
  reporterUsername: string | null;
  description: string;
  route: string | null;
  platform: string | null;
  userAgent: string | null;
  viewport: string | null;
  commitSha: string | null;
  status: BugStatus;
  createdAt: string;
};

export function AdminBugReports({
  reports,
  installed,
}: {
  reports: AdminBugReport[];
  installed: boolean;
}) {
  const [pending, startTransition] = useTransition();

  // An empty list and a missing migration look identical on screen, and only
  // one of them means "nothing to do" — so say which.
  if (!installed) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <div className="w-full max-w-md">
          <p className="text-caption text-sm">
            Bug reports unavailable — the admin RPCs aren&apos;t installed.
          </p>
        </div>
      </div>
    );
  }

  function setStatus(id: string, status: BugStatus, okMsg: string) {
    startTransition(async () => {
      const r = await resolveBugReport(id, status);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(okMsg);
    });
  }

  const open = reports.filter((r) => r.status === "open").length;

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">Bug reports</h1>
          <p className="text-caption text-sm">
            {reports.length === 0
              ? "Nothing reported yet."
              : `${open} open · ${reports.length} total.`}
          </p>
        </header>

        {reports.map((report) => (
          <Card key={report.id}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    report.status === "open"
                      ? "bg-brand/10 text-brand rounded-full px-2.5 py-0.5 text-xs font-bold"
                      : "bg-track text-caption rounded-full px-2.5 py-0.5 text-xs font-bold"
                  }
                >
                  {BUG_STATUS_LABELS[report.status]}
                </span>
                <span className="text-caption text-xs">
                  {new Date(report.createdAt).toLocaleString()}
                </span>
              </div>

              {/* Who, and where it happened — the two things you need before
                  reading the description. */}
              <p className="text-caption text-xs break-words">
                {report.reporterUsername
                  ? `@${report.reporterUsername}`
                  : (report.reporterEmail ?? "a former user")}
                {report.route ? ` · ${report.route}` : ""}
                {report.platform ? ` · ${report.platform}` : ""}
              </p>

              <p className="bg-track rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap">
                {report.description}
              </p>

              {/* Reference detail, deliberately quiet — you only read it once
                  you're actually reproducing. */}
              {(report.viewport || report.commitSha || report.userAgent) && (
                <p className="text-caption text-[11px] break-words">
                  {[
                    report.viewport,
                    report.commitSha ? report.commitSha.slice(0, 7) : null,
                    report.userAgent,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              <div className="border-divider flex flex-wrap gap-2 border-t pt-3">
                <div className="ml-auto flex gap-2">
                  {report.status === "open" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setStatus(report.id, "resolved", "Marked resolved.")
                        }
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          setStatus(report.id, "dismissed", "Dismissed.")
                        }
                      >
                        Dismiss
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(report.id, "open", "Reopened.")}
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
