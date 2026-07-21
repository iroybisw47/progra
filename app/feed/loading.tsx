import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Feed"
      subtitle="What your friends are working on."
      blocks={3}
    />
  );
}
