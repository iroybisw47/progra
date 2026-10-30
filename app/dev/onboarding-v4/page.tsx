import { notFound } from "next/navigation";

import { SignInV4 } from "@/app/login/sign-in-v4";
import { UW } from "@/lib/flags";
import { parseV4PreviewParams } from "@/lib/onboarding-v4-preview";

import { OnboardingV4Client } from "./onboarding-v4-client";

// DEV ONLY: onboarding v4 with no sign-in and no database, for screenshots and
// for checking each screen in a browser. lib/onboarding-v4-preview.ts lists
// the URL's options. It renders the real wizard on v3's fake services, as
// app/dev/onboarding-v3 does, and 404s in production for the same reasons.
// `?signin=1` shows the sign-in screen instead (it needs no account).
export default async function OnboardingV4PreviewPage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const raw = await searchParams;
  if (raw.signin === "1") return <SignInV4 />;
  const params = parseV4PreviewParams(raw);
  return <OnboardingV4Client key={params.fixture} {...params} uw={params.uw ?? UW} />;
}
