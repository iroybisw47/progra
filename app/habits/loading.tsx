import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Habits"
      subtitle="Today's check-list."
      blocks={3}
    />
  );
}
