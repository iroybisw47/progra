import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageSkeletonProps = {
  title: string;
  subtitle: string;
  blocks?: number;
  showDayStrip?: boolean;
};

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-3 rounded-md bg-muted animate-pulse", className)}
      aria-hidden
    />
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <ShimmerBar className="h-4 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ShimmerBar className="h-7 w-24" />
        <div className="flex flex-col gap-2">
          <ShimmerBar className="w-full" />
          <ShimmerBar className="w-5/6" />
          <ShimmerBar className="w-4/6" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PageSkeleton({
  title,
  subtitle,
  blocks = 3,
  showDayStrip = false,
}: PageSkeletonProps) {
  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-24 sm:pt-12">
      <main className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{subtitle}</p>
        </header>

        {showDayStrip && (
          <div className="h-14 rounded-lg bg-muted/60 animate-pulse" aria-hidden />
        )}

        {Array.from({ length: blocks }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </main>
    </div>
  );
}
