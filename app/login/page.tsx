import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata = {
  title: "Sign in - Progra",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  const params = await searchParams;
  if (data.user) {
    redirect(params.next ?? "/clock");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-24">
      <main className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-sm">Sign in to continue</p>
        </header>

        <GoogleSignInButton next={params.next} />

        {params.error && (
          <p className="text-destructive text-center text-sm">{params.error}</p>
        )}
      </main>
    </div>
  );
}
