import Link from "next/link";

import { SURVEY, type Survey } from "@/lib/survey";
import type { SurveyResults } from "@/lib/survey-results";
import { pct } from "@/lib/admin-dashboard";

import { HBars } from "./charts";
import { Section, Tile, fmtPct } from "./ui";

// The in-app survey (lib/survey.ts): who has answered, each question's split,
// and every respondent's answers. The dashboard's filters apply (internal,
// segment, cohort); the date range doesn't, since a survey is answered once.
export function SurveyTab({
  survey,
  results,
  choices = [],
}: {
  survey: Survey | null;
  results: SurveyResults | null;
  // Every shipped survey, for the picker; the current one is `survey`.
  choices?: { id: string; href: string }[];
}) {
  if (!survey) {
    return <p className="text-caption text-sm">No survey is running (SURVEY is null in lib/survey.ts).</p>;
  }
  if (!results) {
    return (
      <p className="text-caption text-sm">
        Survey results unavailable — <code>admin_survey_results</code> isn&apos;t installed yet (run{" "}
        <code>.claude/plans/survey.sql</code>).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {choices.length > 1 && (
        <nav className="flex flex-wrap gap-1.5 text-xs" aria-label="Survey">
          {choices.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              aria-current={c.id === survey.id ? "page" : undefined}
              className={
                "rounded-full border px-2.5 py-1 font-semibold " +
                (c.id === survey.id ? "border-ink text-ink" : "border-hairline text-caption")
              }
            >
              {c.id}
            </Link>
          ))}
        </nav>
      )}
      <Section
        title={survey.title}
        hint={
          survey.id === SURVEY?.id
            ? `Survey ${survey.id}. Onboarded members in this slice are eligible; it opens on their next Progress load and can't be skipped.`
            : `Survey ${survey.id}. No longer asked; these are the answers it collected.`
        }
      >
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Eligible" value={String(results.eligible)} />
          <Tile
            label="Started"
            value={String(results.started)}
            sub={fmtPct(pct(results.started, results.eligible))}
          />
          <Tile
            label="Finished"
            value={String(results.completed)}
            sub={fmtPct(pct(results.completed, results.eligible))}
          />
        </div>
      </Section>

      {results.questions.map((q, i) => (
        <Section key={q.id} title={`Q${i + 1} · ${q.answered} answered`} hint={q.prompt}>
          {q.answered === 0 ? (
            <p className="text-caption text-sm">No answers yet.</p>
          ) : (
            <>
              <HBars
                label="Answers"
                rows={q.options.map((o) => ({
                  label: o.short,
                  value: o.n,
                  note: fmtPct(o.pct),
                }))}
              />
              <p className="text-caption text-[11px] tabular-nums">
                {q.options.map((o) => `${o.short} ${fmtPct(o.pct)}`).join(" · ")}
              </p>
            </>
          )}
        </Section>
      ))}

      <Section
        title={`Respondents · ${results.started}`}
        hint="Newest answer first. A blank cell is a question they haven't reached yet."
      >
        {results.respondents.length === 0 ? (
          <p className="text-caption text-sm">Nobody has answered yet.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-max border-collapse text-xs">
              <thead>
                <tr className="text-caption">
                  <th className="py-1.5 pr-3 text-left font-semibold">Member</th>
                  {survey.questions.map((q, i) => (
                    <th key={q.id} className="py-1.5 pr-3 text-left font-semibold">
                      Q{i + 1}
                    </th>
                  ))}
                  <th className="py-1.5 text-left font-semibold">Answered</th>
                </tr>
              </thead>
              <tbody>
                {results.respondents.map((r) => (
                  <tr key={r.id} className="border-hairline border-t">
                    <td className="py-1.5 pr-3 font-medium">
                      <Link href={`/admin/analytics/user/${r.id}`} className="underline-offset-2 hover:underline">
                        {r.name}
                      </Link>
                      {r.segment === "uw" && <span className="text-caption"> · UW</span>}
                    </td>
                    {r.answers.map((a, i) => (
                      <td key={survey.questions[i].id} className="py-1.5 pr-3">
                        {a ?? <span className="text-caption">—</span>}
                      </td>
                    ))}
                    <td className="text-caption py-1.5 tabular-nums">
                      {r.lastAnsweredAt.replace("T", " ").slice(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
