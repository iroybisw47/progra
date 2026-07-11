import { SearchIcon } from "lucide-react";

// Placeholder surface — the nav tab exists ahead of the feature to tease it.
export default function SearchPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-1 flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-24 text-center">
          <span className="bg-brand/10 text-brand flex size-16 items-center justify-center rounded-full">
            <SearchIcon className="size-7" strokeWidth={1.9} />
          </span>
          <p className="text-xl font-semibold tracking-tight">
            Big things coming soon…
          </p>
        </div>
      </main>
    </div>
  );
}
