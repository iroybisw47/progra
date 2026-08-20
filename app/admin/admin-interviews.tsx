"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type InterviewConsent = {
  userId: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  consentedAt: string | null;
  seatNo: number | null;
};

// One CSV field. Quoting everything and doubling internal quotes is the whole
// escaping story — without it a display name containing a comma shifts every
// column after it, silently, and you don't notice until the mail merge is wrong.
function field(value: string | number | null): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function toCsv(rows: InterviewConsent[]): string {
  const header = ["email", "username", "display_name", "consented_at", "seat_no"];
  const lines = rows.map((r) =>
    [r.email, r.username, r.displayName, r.consentedAt, r.seatNo]
      .map(field)
      .join(",")
  );
  // CRLF: Excel still wants it, and every other reader tolerates it.
  return [header.join(","), ...lines].join("\r\n");
}

export function AdminInterviews({
  consents,
  installed,
}: {
  consents: InterviewConsent[];
  installed: boolean;
}) {
  // An empty list and a missing migration look identical, and only one of them
  // means "nobody opted in" — so say which.
  if (!installed) {
    return (
      <div className="flex w-full flex-col items-center px-5 pt-8">
        <div className="w-full max-w-md">
          <p className="text-caption text-sm">
            Interview consents unavailable — the admin RPCs aren&apos;t
            installed.
          </p>
        </div>
      </div>
    );
  }

  function download() {
    try {
      const blob = new Blob([toCsv(consents)], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "progra-interview-consents.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Page-initiated downloads are unreliable inside the iOS WebView. Say so
      // rather than leaving a button that appears to do nothing.
      toast.error("Couldn't download — try this from a desktop browser.");
    }
  }

  return (
    <div className="flex w-full flex-col items-center px-5 pt-8">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[26px] font-bold tracking-tight">
            Interview consents
          </h1>
          <p className="text-caption text-sm">
            {consents.length === 0
              ? "Nobody has opted in yet."
              : `${consents.length} ${consents.length === 1 ? "person is" : "people are"} open to being contacted.`}
          </p>
        </header>

        {consents.length > 0 && (
          <Button variant="outline" onClick={download} className="w-full">
            Download CSV ({consents.length})
          </Button>
        )}

        {consents.map((entry) => (
          <Card key={entry.userId}>
            <CardContent className="flex flex-col gap-1.5 py-3.5">
              <div className="flex items-baseline justify-between gap-2">
                {/* Email leads: it's what you'd actually paste into a To: field. */}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {entry.email ?? "no email on file"}
                </span>
                {entry.seatNo != null && (
                  <span className="text-caption shrink-0 text-xs tabular-nums">
                    seat {entry.seatNo}
                  </span>
                )}
              </div>
              <p className="text-caption text-xs break-words">
                {entry.displayName ?? entry.username ?? "no name set"}
                {entry.username ? ` · @${entry.username}` : ""}
                {entry.consentedAt
                  ? ` · ${new Date(entry.consentedAt).toLocaleDateString()}`
                  : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
