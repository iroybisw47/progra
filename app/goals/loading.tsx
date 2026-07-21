import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Goals"
      subtitle="Weekly quotas and progress."
      blocks={3}
    />
  );
}
