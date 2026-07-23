import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Progra",
};

// Public legal page — must render for logged-out visitors, so no auth helpers.
export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm">
            Effective date: July 22, 2026
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            What we collect
          </h2>
          <ul className="text-muted-foreground flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
            <li>
              Your Google account name, email address, and profile picture,
              provided when you sign in with Google.
            </li>
            <li>
              Your Google Calendar events — titles and times only — via
              read-only access. Progra never creates or edits calendar events.
            </li>
            <li>
              Content you create in Progra, such as study sessions and the
              photos you attach to them.
            </li>
            <li>Basic usage data needed to operate and improve the app.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            How Google user data is used
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Google user data is used only to provide user-facing features
            inside Progra — signing you in, showing your calendar events
            alongside your tracked time, and building your personal summaries.
            We do not use it for advertising, and we never sell it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            AI processing
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To automatically categorize your calendar events, event titles are
            processed by a third-party AI provider (Anthropic). This processing
            happens solely to categorize events for you. The data is not used
            for advertising and is not used to train AI models.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Google Limited Use
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Progra&rsquo;s use and transfer to any other app of information
            received from Google APIs will adhere to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="underline underline-offset-2"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Storage</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your data is stored with our infrastructure providers, Supabase and
            Vercel, and is encrypted in transit and at rest.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Sharing</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We do not sell your data. We share it only with the service
            providers that operate the app on our behalf, or when required by
            law.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Revoking access &amp; deleting your data
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You can revoke Progra&rsquo;s access to your Google account at any
            time from{" "}
            <a
              href="https://myaccount.google.com/permissions"
              className="underline underline-offset-2"
            >
              myaccount.google.com/permissions
            </a>
            . To delete your Progra data, email{" "}
            <a
              href="mailto:support@progra.world"
              className="underline underline-offset-2"
            >
              support@progra.world
            </a>{" "}
            — deletion requests are fulfilled within 30 days.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Children</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Progra is intended for users aged 13 and older. We do not knowingly
            collect data from children under 13.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Contact</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Questions about this policy? Email{" "}
            <a
              href="mailto:support@progra.world"
              className="underline underline-offset-2"
            >
              support@progra.world
            </a>
            .
          </p>
        </section>

        <footer className="text-muted-foreground border-border flex gap-4 border-t pt-6 text-sm">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </footer>
      </main>
    </div>
  );
}
