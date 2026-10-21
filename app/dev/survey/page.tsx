import { notFound } from "next/navigation";

import { SurveyPreviewClient } from "./survey-client";

// DEV ONLY: the in-app survey modal (lib/survey.ts) with no sign-in and no
// database, for screenshots.
//
//   /dev/survey?at=1    start at question 2 (0-based index of answered count)
//   /dev/survey?fail=1  every answer fails, so the toast and the stay-put show
//
// Answers go to a fake that responds after 150ms and is logged under the
// modal. It can never serve in production: `next build` runs with NODE_ENV
// "production", so the route 404s there before reading anything.
export default async function SurveyPreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const p = await searchParams;
  const fail = p.fail === "1";
  const at = Math.max(0, Number(p.at) || 0);
  return <SurveyPreviewClient key={`${fail}-${at}`} fail={fail} at={at} />;
}
