import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">Progra</h1>
          <p className="text-muted-foreground text-base">
            Plan the week. Clock in. Recap on Sunday.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Clock-in coming soon</CardTitle>
            <CardDescription>
              v0 ships a single screen: categories with a clock-in / clock-out timer and weekly totals.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Scaffolding only — PWA manifest, iOS meta tags, and shadcn components are wired up.
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
