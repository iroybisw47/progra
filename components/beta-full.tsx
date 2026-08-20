// The 250-seat beta is full and this user didn't get a seat.
//
// Rendered by the root layout IN PLACE OF the whole app tree — not as a
// redirect to a /full route, because the layout can't read the pathname and a
// redirect would loop on that route itself. Swapping the children also means a
// waitlisted user never receives an app shell to soft-navigate from.
export function BetaFull({ position }: { position: number | null }) {
  return (
    <div className="flex flex-1 flex-col items-center px-5">
      {/* Mirrors SignedOutLanding's hero geometry so the wall reads as part of
          the product rather than an error page. */}
      <main className="my-auto flex w-full max-w-sm flex-col items-center gap-6 pt-16 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-secondary-ink text-sm">The beta is full.</p>
        </header>

        <p className="text-secondary-ink text-sm leading-relaxed">
          Every spot is taken right now.{" "}
          {position != null
            ? `You're #${position} in line — we'll`
            : "You're on the list — we'll"}{" "}
          let you in as soon as one opens up.
        </p>

        <form action="/auth/signout" method="post" className="w-full">
          <button
            type="submit"
            className="border-control-border text-body h-12 w-full rounded-[15px] border-[1.5px] text-sm font-semibold transition-transform active:scale-[.98]"
          >
            Sign out
          </button>
        </form>
      </main>

      <footer className="text-secondary-ink pt-6 pb-[max(env(safe-area-inset-bottom),24px)] text-xs">
        © 2026 Progra
      </footer>
    </div>
  );
}
