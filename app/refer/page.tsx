import { notFound } from "next/navigation";

import { BackLink } from "@/components/v2/back-link";
import { InviteShare } from "@/components/v2/invite-share";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { REFER_ENABLED } from "@/lib/flags";

export const metadata = {
  title: "Refer a friend - Progra",
};

// The share screen behind Progress's "Refer a friend" button. Hands out the App
// Store link — the same InviteShare the onboarding invite step uses, so the two
// can't drift apart. Deliberately a separate surface from /i/{username}: that
// route is the PUBLIC landing for links already sent, and opening your own
// handle there just bounces you to /me.
export default async function ReferPage() {
  if (!REFER_ENABLED) notFound();
  await requireUser();

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
            and you&rsquo;ll see them. Send them the app; once they&rsquo;re in,
            add each other from Friends.
          </p>
        </header>

        <Card>
          <CardContent className="py-5">
            <InviteShare />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
