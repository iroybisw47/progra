import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Recap"
      subtitle="Your week in review."
      blocks={3}
    />
  );
}
