import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/require-user";
import { AddToHomeHint } from "@/components/add-to-home-hint";

import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata = {
  title: "Sign in - Progra",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; deleted?: string }>;
}) {
  const user = await getCurrentUser();

  const params = await searchParams;
  if (user) {
    // Default to home, not /clock, so the onboarding gate on `/` still fires
    // for an authenticated-but-not-yet-onboarded visitor (e.g. a stale bookmark).
    redirect(params.next ?? "/");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-24">
      <main className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1.5 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Progra</h1>
          <p className="text-caption text-sm text-pretty">
            Log study sessions, see your calendar, and share progress with
            friends.
          </p>
        </header>

        {params.deleted != null && (
          <p className="border-hairline text-caption rounded-xl border px-4 py-3 text-center text-sm">
            Your account was deleted. Sign in again any time to start fresh.
          </p>
        )}

        <GoogleSignInButton next={params.next} />

        {params.error && (
          <p className="text-destructive text-center text-sm">{params.error}</p>
        )}

        <AddToHomeHint />
      </main>
    </div>
  );
}
