import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { getOptionalUser } from "@/lib/auth/require-user";

export default async function Page() {
  const user = await getOptionalUser();

  return (
    <div className="flex flex-1 items-center justify-center px-5 pb-24">
      <main className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">
            Plan your week. Track deep work. See where your time goes.
          </p>
        </header>

        {user ? (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-medium">Welcome back</p>
              <p className="text-muted-foreground text-sm">{user.email}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              <Link href="/clock" className={buttonVariants({ className: "h-11 w-full text-base" })}>
                Open clock
              </Link>
              <Link
                href="/planner"
                className={buttonVariants({ variant: "secondary", className: "h-11 w-full text-base" })}
              >
                Open planner
              </Link>
              <form action="/auth/signout" method="post" className="w-full">
                <Button type="submit" variant="ghost" className="h-10 w-full">
                  Sign out
                </Button>
              </form>
            </div>
          </>
        ) : (
          <Link
            href="/login"
            className={buttonVariants({ className: "h-11 w-full text-base" })}
          >
            Sign in with Google
          </Link>
        )}
      </main>
    </div>
  );
}
