import { notFound, redirect } from "next/navigation";

import { AvatarInitials } from "@/components/avatar-initials";
import { SignInButtons } from "@/app/login/sign-in-buttons";
import { APP_STORE_URL } from "@/lib/app-store";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getPublicProfileByUsername } from "@/lib/db/profiles";
import { createClient } from "@/lib/supabase/server";
import { SOCIAL_ENABLED } from "@/lib/flags";

export const metadata = {
  title: "You're invited - Progra",
};

// Public invite landing (social v2). Reachable while signed out — uses
// getOptionalUser, never requireUser. A stranger taps /i/{username}, signs up
// with Google, and lands already friends with the inviter (the referrer rides
// through OAuth as `?ref=`, consumed by /auth/callback → claim_invite).
//
// Since 2026-09-17 a new share hands out the App Store link instead of this
// route, so what arrives here is a link already in the wild. It keeps working —
// and keeps attributing, which an App Store install can't — so the sign-in path
// below stays the primary action, with the store offered alongside it.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  if (!SOCIAL_ENABLED) notFound();
  const { username } = await params;

  const me = await getOptionalUser();
  const target = await getPublicProfileByUsername(username);

  // Their own invite link is meaningless → send them home.
  if (me && target && me.id === target.userId) redirect("/me");

  // Already signed in as a different user: claim the invite now (friendship +
  // attribution) and land on the inviter's profile. claim_invite is idempotent
  // and rejects self/blocked, so a repeat or a stale link is harmless.
  if (me && target) {
    const supabase = await createClient();
    try {
      await supabase.rpc("claim_invite", { p_username: username });
    } catch {
      // never block navigation on attribution
    }
    redirect(`/profile/${target.username}`);
  }

  // Unknown handle (signed out or in). A plain public page — NOT notFound(),
  // which isn't a friendly logged-out landing for a mistyped link.
  if (!target) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-24 text-center">
        <main className="flex w-full max-w-sm flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Invite not found
          </h1>
          <p className="text-caption text-sm text-pretty">
            This invite link isn&rsquo;t valid. Double-check it, or continue to
            Progra to sign in.
          </p>
          <SignInButtons next="/" />
          {/* A dead end otherwise: they tapped a Progra link and the handle
              doesn't exist. The store is the best recovery, but a text link so
              it doesn't compete with sign-in. */}
          <a
            href={APP_STORE_URL}
            className="text-caption text-xs underline underline-offset-2"
          >
            Or get Progra on the App Store
          </a>
        </main>
      </div>
    );
  }

  // Signed out + a real inviter → the invite landing.
  const name = target.displayName || `@${target.username}`;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-24">
      <main className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <AvatarInitials
            name={target.displayName}
            username={target.username}
            avatarUrl={target.avatarUrl}
            className="size-20 text-2xl"
          />
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="text-muted-foreground text-sm">@{target.username}</p>
          </div>
          {target.bio && <p className="text-sm text-pretty">{target.bio}</p>}
        </header>

        <p className="text-caption text-center text-sm text-pretty">
          {name} is tracking their study time on Progra. Join and you&rsquo;ll be
          friends automatically.
        </p>

        <SignInButtons referrer={target.username} next="/" />

        {/* Replaces AddToHomeHint, which rendered for exactly one audience —
            iOS Safari, not installed — that the native app now serves better.
            Showing both would put two conflicting install instructions on one
            screen. Sign-in stays first: it's the only path that attributes. */}
        <div className="flex flex-col items-center gap-2">
          <a
            href={APP_STORE_URL}
            className="border-hairline text-body flex h-12 w-full items-center justify-center rounded-[15px] border-[1.5px] text-sm font-semibold"
          >
            Get Progra on the App Store
          </a>
          <span className="text-faint text-center text-[11px]">
            On iPhone, the app is the full experience.
          </span>
        </div>
      </main>
    </div>
  );
}
