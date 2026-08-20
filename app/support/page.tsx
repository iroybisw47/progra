import Link from "next/link";

export const metadata = {
  title: "Support — Progra",
};

// Public support page — must render for logged-out visitors, so no auth
// helpers, matching /privacy and /terms.
//
// This exists because App Store Connect requires a Support URL and it is a
// mandatory field. Pointing it at the landing page wouldn't do: a reviewer
// following the link would land on a sign-in screen with no way to contact
// anyone, which reads as a dead end.
export default function SupportPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Support</h1>
          <p className="text-muted-foreground text-sm">
            Progra is a small beta. Email reaches a person, usually the same
            day.
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Get in touch</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Email{" "}
            <a
              href="mailto:support@progra.world"
              className="underline underline-offset-2"
            >
              support@progra.world
            </a>{" "}
            for anything at all — a bug, a question, an account problem, or a
            request to delete your data.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            If you&rsquo;re signed in, the fastest route for a bug is{" "}
            <strong className="text-foreground font-semibold">
              Settings → Help → Report a bug
            </strong>
            . It attaches your device details and the screen you came from, so
            we can usually reproduce it without a back-and-forth.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Reporting content or a user
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Every session, comment, and profile can be reported from the app
            using the report control on the item itself, and you can block any
            user from their profile. We review reported content and act on it{" "}
            <strong className="text-foreground font-semibold">
              within 24 hours
            </strong>
            .
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Deleting your account
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Settings → Delete account removes your account and everything in it
            — sessions, photos, habits, goals, and comments. It takes effect
            immediately and cannot be undone. If you can&rsquo;t reach the app,
            email us and we&rsquo;ll do it for you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Notifications
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Progra only sends notifications you asked for: reminders while
            you&rsquo;re clocked in, a daily habit nudge, and alerts when a
            friend reacts to your session. All of them can be turned off in
            Settings, or in iOS Settings → Notifications → Progra.
          </p>
        </section>

        <footer className="text-muted-foreground border-border flex gap-4 border-t pt-6 text-sm">
          <Link href="/" className="hover:underline">
            Home
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </footer>
      </main>
    </div>
  );
}
