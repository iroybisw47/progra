import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Progra",
};

// Public legal page — must render for logged-out visitors, so no auth helpers.
export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-muted-foreground text-sm">
            Effective date: July 22, 2026
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Acceptance of terms
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            By creating an account or using Progra, you agree to these terms.
            If you do not agree, do not use the app.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Eligibility</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You must be at least 13 years old to use Progra. The app is built
            for students planning and tracking their study time.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Your account
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You are responsible for your account and for everything that
            happens under it. Keep your Google account secure, and let us know
            if you believe your account has been compromised.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Acceptable use
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Don&rsquo;t misuse Progra: no unlawful content or activity, no
            harassment of other users, no attempts to break, overload, or
            reverse-engineer the service, and no accessing other people&rsquo;s
            data without permission.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Your content
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You own the content you create in Progra — your sessions, photos,
            and notes. You grant us a limited license to host, store, and
            display that content within the app so we can provide the service
            (for example, showing your sessions to friends you&rsquo;ve
            connected with, subject to your privacy settings).
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Termination</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You can stop using Progra and delete your account at any time. We
            may suspend or terminate accounts that violate these terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Disclaimer of warranties
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Progra is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo;, without warranties of any kind, express or
            implied. We do not guarantee the app will be uninterrupted,
            error-free, or that data will never be lost.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Limitation of liability
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To the maximum extent permitted by law, Progra and its operators
            are not liable for any indirect, incidental, or consequential
            damages arising from your use of the app.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Changes to these terms
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We may update these terms from time to time. If we make material
            changes, we&rsquo;ll update the effective date above. Continuing to
            use Progra after changes take effect means you accept the updated
            terms.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Contact</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Questions about these terms? Email{" "}
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
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </footer>
      </main>
    </div>
  );
}
