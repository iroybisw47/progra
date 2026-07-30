import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/v2/back-link";
import { InviteShare } from "@/components/v2/invite-share";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";
import { REFER_ENABLED } from "@/lib/flags";

export const metadata = {
  title: "Refer a friend - Progra",
};

// The share screen behind Progress's "Refer a friend" button. Deliberately a
// separate surface from /i/{username}: that route is the PUBLIC landing the
// recipient sees, and opening your own handle there just bounces you to /me.
// This one shows you your link so you can send it — same InviteShare component
// the onboarding invite step uses, so the two can't drift apart.
export default async function ReferPage() {
  if (!REFER_ENABLED) notFound();
  await requireUser();

  const profile = await getProfile();
  // Defensive: Progress redirects to /onboarding while onboarded_at is null and
  // onboarding claims a handle, so a signed-in user reaching here always has
  // one. Without a handle there is no link to share.
  if (!profile?.username) redirect("/");

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-28">
      <main className="flex w-full max-w-md flex-col gap-4">
        <BackLink href="/" label="Progress" />
        <header className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-bold tracking-tight">
            Refer a friend
          </h1>
          <p className="text-caption text-sm text-pretty">
            Progra&rsquo;s better with friends — they&rsquo;ll see you show up,
            and you&rsquo;ll see them. Anyone who joins from your link becomes a
            friend automatically.
          </p>
        </header>

        <Card>
          <CardContent className="py-5">
            <InviteShare username={profile.username} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
